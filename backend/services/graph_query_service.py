"""Natural-language querying of the knowledge graph (M13) — NL question ->
generated read-only Cypher -> executed -> results.

Safety boundary: only MATCH/RETURN-style Cypher may ever execute. This is
enforced at two layers, not by prompting alone:
  1. A string-literal-aware keyword denylist, applied right after generation
     (fast, user-facing "reject and retry once" per the M13 spec).
  2. Every query — regardless of what layer 1 concluded — executes inside a
     Neo4j read-only transaction (`session.execute_read`). The database
     server itself refuses any write clause in that mode
     (Neo.ClientError.Statement.AccessMode), independent of query text. This
     is the actual structural guarantee; layer 1 only makes failures fast
     and legible instead of a raw database error.
"""
import json
import logging
import re

from database.neo4j_client import get_neo4j_driver

logger = logging.getLogger(__name__)

_MAX_RESULT_ROWS = 30

_SCHEMA_DESCRIPTION = """\
Node types:
- Episode {id, conversation_id, project_id, prompt, response, timestamp, recall_count, last_recalled}
  A single chat exchange. Scoped to a project via project_id.
- Concept {name, episode_count, created_at}
  A topic. Global — NOT scoped to any project, no project_id property.
- Reflection {id, concept, text, created_at, episode_count}
  A synthesised pattern across a cluster of Episodes about one Concept.
- Fact {id, text, raw_message, created_at, user_pinned}
  A user-pinned permanent fact. Global — no project_id property.

Relationship types:
- (Episode)-[:DISCUSSES]->(Concept)
- (Episode)-[:NEXT]->(Episode)         previous episode -> next episode, same conversation
- (Reflection)-[:SYNTHESISED_FROM]->(Episode)
- (Reflection)-[:ABOUT]->(Concept)

Scoping rule: when matching Episode or Reflection nodes, filter Episodes by
`e.project_id = $project_id` (Reflections via their SYNTHESISED_FROM episodes,
since Reflection itself has no project_id). Concept and Fact matches are
never filtered by project_id — they are global by design.
"""

_GENERATION_SYSTEM_PROMPT = f"""\
You translate a natural-language question into a single read-only Cypher \
query for a Neo4j knowledge graph, using this exact schema:

{_SCHEMA_DESCRIPTION}

Rules:
- Output ONLY the Cypher query. No explanation, no markdown code fences.
- The query MUST be read-only: only MATCH, OPTIONAL MATCH, WHERE, WITH,
  RETURN, ORDER BY, LIMIT, UNWIND. Never CREATE, MERGE, DELETE, SET, REMOVE,
  or DETACH DELETE, under any circumstances, even if the question asks you
  to change, delete, or update something — if so, generate a query that
  reads the relevant data instead; the caller will explain the limitation.
- Reference the project scope with the parameter $project_id exactly as
  named (already bound by the caller) — do not invent a different name.
- Prefer LIMIT 20 or fewer unless the question clearly needs more.
- Always alias RETURN fields with clear, descriptive names using AS (e.g.
  `RETURN e.prompt AS episode_text, c.name AS topic`, not raw property
  paths) — the results are handed to another model to answer the question
  in natural language, and clear field names make that answer more accurate.
- Use `CONTAINS`/`toLower()` for fuzzy text matching on prompt/response/text
  fields rather than exact equality, since user questions are informal.
"""

_RETRY_SUFFIX = """

Your previous attempt contained a write clause (CREATE/MERGE/DELETE/SET/REMOVE), \
which is never allowed. Generate a strictly read-only query instead — only \
MATCH/OPTIONAL MATCH/WHERE/WITH/RETURN/ORDER BY/LIMIT/UNWIND.
"""

_WRITE_CLAUSE_RE = re.compile(r"\b(CREATE|MERGE|DELETE|SET|REMOVE|DROP|DETACH)\b", re.IGNORECASE)
_CODE_FENCE_RE = re.compile(r"^```(?:cypher)?\s*|\s*```$", re.IGNORECASE | re.MULTILINE)


def _strip_strings_and_comments(cypher: str) -> str:
    """Blank out string literal contents and comments so a write keyword
    appearing as DATA (e.g. WHERE e.prompt CONTAINS 'delete') never
    triggers a false-positive rejection — only structural keywords do.
    """
    text = re.sub(r"'(?:[^'\\]|\\.)*'", "''", cypher)
    text = re.sub(r'"(?:[^"\\]|\\.)*"', '""', text)
    text = re.sub(r"//.*", "", text)
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)
    return text


def is_read_only(cypher: str) -> bool:
    """Fast structural check — the string-literal-aware denylist. Not the
    safety boundary itself (see module docstring); used for fast rejection
    and the Phase-1 retry flow before ever touching the database.
    """
    if not cypher or not cypher.strip():
        return False
    return not _WRITE_CLAUSE_RE.search(_strip_strings_and_comments(cypher))


def _extract_cypher(raw: str) -> str:
    """Strip markdown code fences the model sometimes wraps the query in."""
    text = raw.strip()
    text = _CODE_FENCE_RE.sub("", text).strip()
    return text


async def generate_cypher(question: str, retry_after_rejection: bool = False) -> str:
    from services.router_service import default_provider, default_model, send

    provider = default_provider()
    if provider is None:
        raise RuntimeError("No AI provider configured — cannot query the memory graph.")

    system = _GENERATION_SYSTEM_PROMPT + (_RETRY_SUFFIX if retry_after_rejection else "")
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": question},
    ]
    raw = await send(provider, default_model(provider), messages, purpose="graph_query")
    return _extract_cypher(raw)


async def run_readonly_query(cypher: str, project_id: str) -> list[dict]:
    """Execute cypher in a Neo4j read-only transaction. Raises if it's not
    read-only (belt-and-suspenders — callers should already have checked
    is_read_only, but this function never trusts that alone) or if Neo4j
    itself rejects a write the text check missed.
    """
    if not is_read_only(cypher):
        raise ValueError("Refusing to execute: query contains a write clause.")

    driver = await get_neo4j_driver()
    async with driver.session() as session:
        async def _tx(tx):
            result = await tx.run(cypher, project_id=project_id)
            return await result.data()
        return await session.execute_read(_tx)


def _format_rows(rows: list[dict]) -> str:
    """Format result rows for the model to synthesise into a natural-language
    answer. Truncates by row count (never mid-object) so the model always
    receives valid, parseable JSON even when a query returns more than
    expected.
    """
    total = len(rows)
    shown = rows[:_MAX_RESULT_ROWS]
    text = json.dumps(shown, default=str, indent=2)
    if total > len(shown):
        text += f"\n\n[showing {len(shown)} of {total} results]"
    return text


async def query_graph(question: str, project_id: str) -> str:
    """Top-level orchestrator: generate -> validate (reject+retry once) ->
    execute -> return results, formatted for the calling model to turn into
    a natural-language answer (never shown to the user as raw graph data —
    only the model's final synthesised reply is).
    """
    cypher = await generate_cypher(question)

    if not is_read_only(cypher):
        logger.warning(f"query_graph: rejected write-containing query, retrying once: {cypher!r}")
        cypher = await generate_cypher(question, retry_after_rejection=True)
        if not is_read_only(cypher):
            logger.warning(f"query_graph: retry still contained a write clause: {cypher!r}")
            return (
                "I generated a query that would have modified the memory graph, which "
                "isn't allowed — this tool is read-only. Try rephrasing your question as "
                "something that only looks up information rather than changes it."
            )

    try:
        rows = await run_readonly_query(cypher, project_id)
    except Exception as e:
        logger.warning(f"query_graph: execution failed for {cypher!r}: {e}")
        return f"I couldn't run that query against the memory graph: {e}"

    if not rows:
        return "No matching memories found for that question."

    return _format_rows(rows)
