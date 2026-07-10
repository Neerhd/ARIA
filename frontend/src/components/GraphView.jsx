import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import R3fForceGraph from "r3f-forcegraph";
import { X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGraphData } from "@/hooks/useGraphData";

// Achromatic-only node/edge colors, per M9's zero-chroma token system — shape
// and size carry the type distinction, color is only a secondary lightness cue.
const NODE_STYLE = {
  concept:    { geometry: () => new THREE.BoxGeometry(2.4, 2.4, 2.4), colorLight: 0x1a1a1a, colorDark: 0xf2f2f2 },
  reflection: { geometry: () => new THREE.OctahedronGeometry(1.5),   colorLight: 0x555555, colorDark: 0x9a9a9a },
  episode:    { geometry: () => new THREE.SphereGeometry(1, 12, 12), colorLight: 0x9a9a9a, colorDark: 0x707070 },
};

const LINK_STYLE = {
  DISCUSSES:         { width: 0.4, colorLight: 0xcccccc, colorDark: 0x444444 },
  NEXT:              { width: 1.0, colorLight: 0x999999, colorDark: 0x888888 },
  SYNTHESISED_FROM:  { width: 0.7, colorLight: 0xaaaaaa, colorDark: 0x666666 },
  ABOUT:             { width: 0.4, colorLight: 0xcccccc, colorDark: 0x555555 },
};

const DIM_OPACITY = 0.12;

// Above this many total nodes, collapse to Concept-only and reveal a
// Concept's Episodes/Reflections on click, rather than rendering everything
// at once. Confirmed in M12 Phase 0 against real graph size (~150-160 nodes).
export const COLLAPSE_THRESHOLD = 300;

function isDarkMode() {
  return document.documentElement.classList.contains("dark");
}

function endpointId(endpoint) {
  return typeof endpoint === "object" && endpoint !== null ? endpoint.id : endpoint;
}

// Pure, framework-free so it's independently testable: given the full
// node/edge set and which Concepts the user has expanded, return only the
// nodes/edges that should actually be rendered.
export function deriveVisibleGraph(nodes, edges, expandedConceptIds) {
  const conceptIds = new Set(nodes.filter((n) => n.type === "concept").map((n) => n.id));
  const visibleIds = new Set(conceptIds);

  // Settle which nodes are visible first, in dependency order (episodes
  // depend on expanded concepts; reflections depend on visible episodes) —
  // before touching edges at all, so edge filtering below can't be affected
  // by array ordering between these two passes.
  edges.forEach((e) => {
    if (e.type === "DISCUSSES" && expandedConceptIds.has(e.target)) visibleIds.add(e.source);
  });
  edges.forEach((e) => {
    if (e.type === "SYNTHESISED_FROM" && visibleIds.has(e.target)) visibleIds.add(e.source);
  });

  // Node visibility is now final — an edge is visible iff both endpoints are.
  const visibleEdges = edges.filter((e) => visibleIds.has(endpointId(e.source)) && visibleIds.has(endpointId(e.target)));

  return {
    nodes: nodes.filter((n) => visibleIds.has(n.id)),
    edges: visibleEdges,
  };
}

function getNeighborIds(links, nodeId) {
  const ids = new Set([nodeId]);
  links.forEach((l) => {
    const s = endpointId(l.source);
    const t = endpointId(l.target);
    if (s === nodeId) ids.add(t);
    if (t === nodeId) ids.add(s);
  });
  return ids;
}

function ForceGraph({ graphData, focusedId, onNodeClick, onNodeHover }) {
  const fgRef = useRef();

  useFrame(() => fgRef.current?.tickFrame());

  useEffect(() => {
    if (!fgRef.current) return;
    // Concept nodes act as visual hubs: DISCUSSES edges pull tight to their
    // Concept, Concepts repel each other strongly so hubs stay well separated.
    fgRef.current.d3Force("link").distance((l) => (l.type === "DISCUSSES" ? 14 : 30));
    fgRef.current.d3Force("charge").strength((n) => (n.type === "concept" ? -160 : -20));
    fgRef.current.d3ReheatSimulation();
  }, [graphData]);

  const neighborIds = useMemo(
    () => (focusedId ? getNeighborIds(graphData.links, focusedId) : null),
    [focusedId, graphData]
  );

  // Re-generate node/link 3D objects whenever the focused neighborhood changes,
  // so createNodeObject/linkColor below (closures over neighborIds) take effect.
  useEffect(() => { fgRef.current?.refresh(); }, [neighborIds]);

  const createNodeObject = useCallback((node) => {
    const style = NODE_STYLE[node.type] || NODE_STYLE.episode;
    const dark = isDarkMode();
    const geometry = style.geometry();
    const dimmed = neighborIds && !neighborIds.has(node.id);
    const material = new THREE.MeshStandardMaterial({
      color: dark ? style.colorDark : style.colorLight,
      roughness: 0.6,
      transparent: true,
      opacity: dimmed ? DIM_OPACITY : 1,
    });
    const mesh = new THREE.Mesh(geometry, material);
    if (node.id === focusedId) mesh.scale.setScalar(1.35);
    return mesh;
  }, [neighborIds, focusedId]);

  const linkStyleFor = useCallback((link) => LINK_STYLE[link.type] || LINK_STYLE.DISCUSSES, []);

  const linkWidth = useCallback((link) => linkStyleFor(link).width, [linkStyleFor]);

  const linkColor = useCallback((link) => {
    const style = linkStyleFor(link);
    return isDarkMode() ? style.colorDark : style.colorLight;
  }, [linkStyleFor]);

  const linkOpacity = useCallback((link) => {
    if (!neighborIds) return 0.5;
    const inFocus = neighborIds.has(endpointId(link.source)) && neighborIds.has(endpointId(link.target));
    return inFocus ? 0.9 : DIM_OPACITY;
  }, [neighborIds]);

  const linkArrowLength = useCallback((link) => (link.type === "NEXT" ? 2 : 0), []);

  return (
    <R3fForceGraph
      ref={fgRef}
      graphData={graphData}
      nodeThreeObject={createNodeObject}
      linkWidth={linkWidth}
      linkColor={linkColor}
      linkOpacity={linkOpacity}
      linkDirectionalArrowLength={linkArrowLength}
      linkDirectionalArrowRelPos={1}
      onNodeClick={onNodeClick}
      onNodeHover={onNodeHover}
    />
  );
}

const METADATA_FIELDS = {
  episode: [["recall_count", "Recalled"], ["timestamp", "When"]],
  concept: [["project_episode_count", "In this project"], ["episode_count", "Total episodes"]],
  reflection: [["episode_count", "Episodes synthesised"], ["created_at", "Created"]],
};

function NodeInfoPanel({ node, onJumpToMemory, onClose }) {
  const fields = METADATA_FIELDS[node.type] || [];
  return (
    <Card className="absolute bottom-4 left-4 z-10 w-72">
      <CardContent className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">{node.type}</div>
            <div className="truncate text-sm font-medium">{node.label}</div>
          </div>
          <Button size="icon-sm" variant="ghost" onClick={onClose} title="Close"><X className="size-3.5" /></Button>
        </div>
        {fields.map(([key, label]) => (
          node.metadata?.[key] != null && (
            <div key={key} className="text-[11px] text-muted-foreground">
              {label}: <span className="font-mono tabular-nums text-foreground">{String(node.metadata[key])}</span>
            </div>
          )
        ))}
        <Button size="sm" className="w-full" onClick={() => onJumpToMemory(node.type, node.metadata?.ref_id)}>
          View in Memory Browser
        </Button>
      </CardContent>
    </Card>
  );
}

function HoverTooltip({ node, pos }) {
  if (!node) return null;
  return (
    <div
      className="pointer-events-none absolute z-10 rounded border border-border bg-popover px-2 py-1 text-[11px] text-popover-foreground shadow-lg"
      style={{ left: pos.x + 12, top: pos.y + 12 }}
    >
      <div className="font-medium">{node.label}</div>
      <div className="text-muted-foreground">
        {node.type}
        {node.metadata?.recall_count != null && ` · recalled ${node.metadata.recall_count}×`}
      </div>
    </div>
  );
}

export default function GraphView({ active, projectId, onJumpToMemory }) {
  const [scope, setScope] = useState("project");
  const { nodes, edges, loading } = useGraphData(active, projectId, scope);

  const [focusedNode, setFocusedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [pointerPos, setPointerPos] = useState({ x: 0, y: 0 });
  const [expandedConceptIds, setExpandedConceptIds] = useState(new Set());

  const isCollapsed = nodes.length > COLLAPSE_THRESHOLD;

  const { nodes: visibleNodes, edges: visibleEdges } = useMemo(
    () => (isCollapsed ? deriveVisibleGraph(nodes, edges, expandedConceptIds) : { nodes, edges }),
    [nodes, edges, isCollapsed, expandedConceptIds]
  );

  const graphData = useMemo(() => ({
    nodes: visibleNodes.map((n) => ({ ...n })),
    links: visibleEdges.map((e) => ({ ...e })),
  }), [visibleNodes, visibleEdges]);

  useEffect(() => {
    setFocusedNode(null);
    setExpandedConceptIds(new Set());
  }, [scope, projectId]);

  const handleNodeClick = (node) => {
    if (isCollapsed && node.type === "concept") {
      setExpandedConceptIds((prev) => {
        const next = new Set(prev);
        if (next.has(node.id)) next.delete(node.id); else next.add(node.id);
        return next;
      });
      return;
    }
    setFocusedNode((prev) => (prev?.id === node.id ? null : node));
  };

  const bg = isDarkMode() ? "#252525" : "#ffffff";

  return (
    <div
      className="relative flex-1 overflow-hidden bg-background"
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setPointerPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
    >
      <div className="absolute top-3 left-3 z-10 flex gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className={scope === "project" ? "border-primary bg-primary/10 text-primary" : ""}
          onClick={() => setScope("project")}
        >
          This Project
        </Button>
        <Button
          size="sm"
          variant="outline"
          className={scope === "all" ? "border-primary bg-primary/10 text-primary" : ""}
          onClick={() => setScope("all")}
        >
          All Projects
        </Button>
        {isCollapsed && (
          <span className="flex items-center rounded border border-border bg-popover px-2 text-[11px] text-muted-foreground">
            {nodes.length} nodes — showing concepts only, click one to expand
          </span>
        )}
      </div>

      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-muted-foreground">
          Loading graph…
        </div>
      )}
      {!loading && nodes.length === 0 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-muted-foreground">
          No episodes yet in this project. Start chatting to build the graph.
        </div>
      )}

      <Canvas camera={{ position: [0, 0, 220], far: 5000 }}>
        <color attach="background" args={[bg]} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[100, 100, 100]} intensity={0.6} />
        <ForceGraph
          graphData={graphData}
          focusedId={focusedNode?.id ?? null}
          onNodeClick={handleNodeClick}
          onNodeHover={(node) => setHoveredNode(node)}
        />
        <OrbitControls enableDamping dampingFactor={0.15} minDistance={20} maxDistance={2000} />
      </Canvas>

      <HoverTooltip node={hoveredNode} pos={pointerPos} />

      {focusedNode && (
        <NodeInfoPanel
          node={focusedNode}
          onJumpToMemory={onJumpToMemory}
          onClose={() => setFocusedNode(null)}
        />
      )}
    </div>
  );
}
