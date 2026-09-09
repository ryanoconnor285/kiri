"use client";

import "katex/dist/katex.min.css";
import { BlockMath, InlineMath } from "react-katex";

type KatexRendererProps = {
  text: string;
  block?: boolean;
};

function renderSegment(segment: string, key: number, block: boolean) {
  const trimmed = segment.trim();
  if (!trimmed) return null;

  const isBlock = block || trimmed.includes("\\") || trimmed.includes("^") || trimmed.includes("_");

  if (isBlock) {
    return <BlockMath key={key} math={trimmed} errorColor="#cc0000" />;
  }
  return <InlineMath key={key} math={trimmed} errorColor="#cc0000" />;
}

export function KatexRenderer({ text, block = false }: KatexRendererProps) {
  const segments = text.split("\n");

  return (
    <div className="katex-content">
      {segments.map((segment, index) => renderSegment(segment, index, block))}
    </div>
  );
}
