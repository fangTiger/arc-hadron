import type { ReactNode } from "react";

interface AiMarkdownProps {
  markdown: string;
}

function renderStrong(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let partIndex = 0;

  while (cursor < text.length) {
    const start = text.indexOf("**", cursor);

    if (start === -1) {
      nodes.push(text.slice(cursor));
      break;
    }

    const end = text.indexOf("**", start + 2);

    if (end === -1) {
      nodes.push(text.slice(cursor));
      break;
    }

    if (start > cursor) {
      nodes.push(text.slice(cursor, start));
    }

    const content = text.slice(start + 2, end);

    if (content.length > 0) {
      nodes.push(
        <strong key={`${keyPrefix}:strong:${partIndex}`}>
          {content}
        </strong>,
      );
      partIndex += 1;
    }

    cursor = end + 2;
  }

  return nodes;
}

export function AiMarkdown({ markdown }: AiMarkdownProps) {
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];
  let paragraphLines: string[] = [];

  function flushList() {
    if (listItems.length === 0) {
      return;
    }

    const blockIndex = blocks.length;

    blocks.push(
      <ul className="space-y-2 pl-4" key={`ul:${blockIndex}`}>
        {listItems.map((item, index) => (
          <li
            className="list-disc pl-1 text-sm leading-6 text-text-dim marker:text-neon-dim"
            key={`li:${blockIndex}:${index}`}
          >
            {renderStrong(item, `li:${blockIndex}:${index}`)}
          </li>
        ))}
      </ul>,
    );
    listItems = [];
  }

  function flushParagraph() {
    if (paragraphLines.length === 0) {
      return;
    }

    const text = paragraphLines.join(" ").trim();

    if (text.length > 0) {
      blocks.push(
        <p className="text-sm leading-6 text-text-dim" key={`p:${blocks.length}`}>
          {renderStrong(text, `p:${blocks.length}`)}
        </p>,
      );
    }

    paragraphLines = [];
  }

  // 仅支持 AI 面板需要的安全子集，所有 HTML/链接语法都作为普通文本交给 React 转义。
  for (const line of markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n")) {
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      flushParagraph();
      flushList();
      continue;
    }

    if (trimmed.startsWith("### ")) {
      flushParagraph();
      flushList();
      blocks.push(
        <h3
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-neon-dim"
          key={`h3:${blocks.length}`}
        >
          {renderStrong(trimmed.slice(4).trim(), `h3:${blocks.length}`)}
        </h3>,
      );
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push(
        <h2
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-text"
          key={`h2:${blocks.length}`}
        >
          {renderStrong(trimmed.slice(3).trim(), `h2:${blocks.length}`)}
        </h2>,
      );
      continue;
    }

    if (trimmed.startsWith("- ")) {
      flushParagraph();
      listItems.push(trimmed.slice(2).trim());
      continue;
    }

    flushList();
    paragraphLines.push(trimmed);
  }

  flushParagraph();
  flushList();

  return <div className="space-y-3">{blocks}</div>;
}
