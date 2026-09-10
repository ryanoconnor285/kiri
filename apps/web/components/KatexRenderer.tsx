"use client";

import "katex/dist/katex.min.css";
import { BlockMath, InlineMath } from "react-katex";

type KatexRendererProps = {
  text: string;
  block?: boolean;
};

type Segment =
  | { type: "text"; value: string }
  | { type: "math"; value: string; display: boolean };

const DELIM_RE =
  /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$/g;

function splitSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(DELIM_RE.source, "g");
  while ((match = re.exec(text))) {
    if (match.index > last) {
      segments.push({ type: "text", value: text.slice(last, match.index) });
    }
    const display = Boolean(match[1] ?? match[2]);
    const value = match[1] ?? match[2] ?? match[3] ?? match[4] ?? "";
    segments.push({ type: "math", value, display });
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    segments.push({ type: "text", value: text.slice(last) });
  }
  if (segments.length === 0) {
    segments.push({ type: "text", value: text });
  }
  return segments;
}

function isBareLatex(text: string): boolean {
  const trimmed = text.trim();
  return /\\[a-zA-Z]+\{/.test(trimmed) && !/\$|\\\(|\\\[/.test(trimmed);
}

export function KatexRenderer({ text, block = false }: KatexRendererProps) {
  if (isBareLatex(text)) {
    return (
      <div className="katex-content">
        <BlockMath math={text.trim()} errorColor="#cc0000" />
      </div>
    );
  }

  const segments = splitSegments(text);
  const onlyText = segments.every((s) => s.type === "text");

  if (onlyText) {
    return <div className="card-prose">{text}</div>;
  }

  return (
    <div className="katex-content">
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          if (!segment.value) return null;
          return (
            <span key={index} className="card-prose-inline">
              {segment.value}
            </span>
          );
        }
        const MathEl = segment.display || block ? BlockMath : InlineMath;
        return <MathEl key={index} math={segment.value} errorColor="#cc0000" />;
      })}
    </div>
  );
}
