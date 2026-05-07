import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import "katex/dist/katex.min.css";

interface Props {
  content: string;
}

// Normalize \[ \] and \( \) delimiters into $$...$$ / $...$ that remark-math understands.
function normalizeMath(src: string): string {
  return src
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, expr) => `\n$$\n${expr.trim()}\n$$\n`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, expr) => `$${expr.trim()}$`);
}

export function MarkdownMessage({ content }: Props) {
  const normalized = normalizeMath(content);
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:p-0 prose-pre:bg-transparent prose-pre:my-2 prose-p:my-2 prose-headings:my-3 prose-table:my-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            const text = String(children).replace(/\n$/, "");
            if (!inline && match) {
              return (
                <SyntaxHighlighter
                  language={match[1]}
                  style={oneDark}
                  PreTag="div"
                  customStyle={{ margin: 0, borderRadius: "0.5rem", fontSize: "0.85em" }}
                >
                  {text}
                </SyntaxHighlighter>
              );
            }
            return (
              <code className="rounded bg-black/10 dark:bg-white/10 px-1 py-0.5 text-[0.85em]" {...props}>
                {children}
              </code>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto">
                <table className="border-collapse border border-border">{children}</table>
              </div>
            );
          },
          th({ children }) {
            return <th className="border border-border px-2 py-1 bg-muted">{children}</th>;
          },
          td({ children }) {
            return <td className="border border-border px-2 py-1">{children}</td>;
          },
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}
