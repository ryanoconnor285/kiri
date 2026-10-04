"use client";

import { splitBlankSegments } from "@kiri/card-templates";
import { useEffect, useState } from "react";
import { CardFace } from "./CardFace";

type Props = {
  text: string;
  revealed?: boolean;
  /** When false, blanks stay covered (browse preview). */
  interactive?: boolean;
};

export function BlankedFace({ text, revealed = false, interactive = true }: Props) {
  const parts = splitBlankSegments(text);
  const [open, setOpen] = useState<Set<number>>(new Set());

  useEffect(() => {
    setOpen(new Set());
  }, [text]);

  if (parts.every((part) => part.type === "text")) {
    return <CardFace text={text} />;
  }

  return (
    <span className="kiri-blanked-face">
      {parts.map((part, index) => {
        if (part.type === "text") {
          return <CardFace key={`${index}:${part.value}`} text={part.value} inline />;
        }
        const shown = revealed || open.has(index);
        if (!interactive && !revealed) {
          return (
            <span key={index} className="kiri-blank is-covered" aria-label="Hidden word">
              {part.value}
            </span>
          );
        }
        return (
          <button
            key={index}
            type="button"
            className={`kiri-blank ${shown ? "is-open" : "is-covered"}`}
            onClick={(e) => {
              e.stopPropagation();
              if (revealed || shown) return;
              setOpen((prev) => new Set(prev).add(index));
            }}
            aria-label={shown ? part.value : "Hidden word, tap to reveal"}
          >
            {shown ? part.value : part.value}
          </button>
        );
      })}
    </span>
  );
}
