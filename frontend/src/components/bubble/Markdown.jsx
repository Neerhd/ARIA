import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

// Renders ARIA's replies with real hierarchy — headings, lists, code blocks,
// tables — instead of a flat wall of pre-wrapped text. remark-breaks keeps
// single newlines behaving like the old plain-text rendering (a soft line
// break) since models often don't bother with proper blank-line-separated
// markdown paragraphs. Code blocks get real syntax highlighting via
// rehype-highlight + a fixed dark IDE-style theme (github-dark) — like
// Tooltip, deliberately not theme-driven, since a syntax theme needs to
// stay internally consistent regardless of the app's light/dark mode.
const COMPONENTS = {
  p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
  h1: ({ children }) => <h1 className="mt-3 mb-1.5 text-base font-bold first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mt-3 mb-1.5 text-[15px] font-bold first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mt-2.5 mb-1 text-sm font-bold first:mt-0">{children}</h3>,
  h4: ({ children }) => <h4 className="mt-2 mb-1 text-sm font-semibold first:mt-0">{children}</h4>,
  h5: ({ children }) => <h5 className="mt-2 mb-1 text-sm font-semibold first:mt-0">{children}</h5>,
  h6: ({ children }) => <h6 className="mt-2 mb-1 text-sm font-semibold first:mt-0">{children}</h6>,
  ul: ({ children }) => <ul className="mb-1.5 list-disc space-y-0.5 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-1.5 list-decimal space-y-0.5 pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="leading-normal">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mb-1.5 border-l-2 border-input-border pl-3 text-muted-foreground italic last:mb-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-input-border" />,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-button-primary underline underline-offset-2 hover:no-underline">
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  // Fenced code blocks get a hljs/language-* className from rehype-highlight;
  // inline `code` never does — that's the v10-safe way to tell them apart
  // (react-markdown no longer passes an `inline` prop).
  code: ({ className, children, ...props }) =>
    className ? (
      <code className={className} {...props}>
        {children}
      </code>
    ) : (
      <code className="rounded bg-avatar px-1 py-0.5 text-[0.85em] text-avatar-foreground" {...props}>
        {children}
      </code>
    ),
  pre: ({ children }) => <pre className="mb-1.5 overflow-hidden rounded-lg text-xs last:mb-0">{children}</pre>,
  table: ({ children }) => (
    <div className="mb-1.5 overflow-x-auto last:mb-0">
      <table className="border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-input-border px-2 py-1 text-left font-bold">{children}</th>,
  td: ({ children }) => <td className="border border-input-border px-2 py-1">{children}</td>,
};

export default function Markdown({ children }) {
  return (
    <div className="text-sm leading-normal">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} rehypePlugins={[rehypeHighlight]} components={COMPONENTS}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
