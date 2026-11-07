"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Bezpečné vykreslení Markdownu od AI (HTML se ignoruje). */
export function Markdown({ text }: { text: string }) {
  return (
    <div className="space-y-2 leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ href, children }) => <a href={href} target={href?.startsWith("/") ? undefined : "_blank"} rel="noreferrer" className="text-gold underline">{children}</a>,
          table: ({ children }) => <div className="overflow-x-auto"><table className="w-full min-w-[320px] text-xs">{children}</table></div>,
          th: ({ children }) => <th className="py-1 pr-3 text-left font-medium text-ink-3">{children}</th>,
          td: ({ children }) => <td className="num border-t border-white/[0.06] py-1 pr-3">{children}</td>,
          ul: ({ children }) => <ul className="list-disc space-y-0.5 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-0.5 pl-5">{children}</ol>,
          h1: ({ children }) => <p className="font-semibold text-ink">{children}</p>,
          h2: ({ children }) => <p className="font-semibold text-ink">{children}</p>,
          h3: ({ children }) => <p className="font-semibold text-ink">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
          code: ({ children }) => <code className="rounded bg-white/10 px-1 text-xs">{children}</code>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
