"use client";

import katex from "katex";
import "katex/dist/katex.min.css";
import { isFormulaLine, splitKatexSegments } from "@/lib/katex-segments";

type KatexRendererProps = {
  text: string;
  /** Display mode only for a whole-card formula line. Never applied to $...$ in prose. */
  block?: boolean;
};

function renderMathHtml(tex: string, display: boolean): string {
  return katex.renderToString(tex, {
    displayMode: display,
    throwOnError: false,
    errorColor: "#cc0000",
  });
}

export function KatexRenderer({ text, block = false }: KatexRendererProps) {
  if (isFormulaLine(text)) {
    const trimmed = text.trim();
    return (
      <div
        className={block ? "katex-content katex-block-math" : "katex-content katex-inline-math"}
        dangerouslySetInnerHTML={{ __html: renderMathHtml(trimmed, block) }}
      />
    );
  }

  const segments = splitKatexSegments(text);
  const onlyText = segments.every((s) => s.type === "text");

  if (onlyText) {
    return <div className="card-prose">{text}</div>;
  }

  return (
    <div className="card-prose katex-inline">
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          if (!segment.value) return null;
          return (
            <span key={index} className="card-prose-inline">
              {segment.value}
            </span>
          );
        }
        return (
          <span
            key={index}
            className={segment.display ? "katex-block-math" : "katex-inline-math"}
            dangerouslySetInnerHTML={{
              __html: renderMathHtml(segment.value, segment.display),
            }}
          />
        );
      })}
    </div>
  );
}
