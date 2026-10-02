"use client";

import { shuffleIndices } from "@kiri/card-templates";
import { useEffect, useMemo, useState } from "react";
import { CardFace } from "./CardFace";

type Props = {
  questionHtml: string;
  choices: string[];
  allowMultiple: boolean;
  correctIndices: number[] | null;
  explanationHtml: string;
  modelCss: string;
  shuffleSeed: number;
  revealed: boolean;
  onReveal: () => void;
};

export function MultipleChoiceStudy({
  questionHtml,
  choices,
  allowMultiple,
  correctIndices,
  explanationHtml,
  modelCss,
  shuffleSeed,
  revealed,
  onReveal,
}: Props) {
  const order = useMemo(
    () => shuffleIndices(choices.length, shuffleSeed),
    [choices.length, shuffleSeed],
  );
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    setSelected(new Set());
  }, [shuffleSeed]);

  function toggle(index: number) {
    if (revealed) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (allowMultiple) {
        if (next.has(index)) next.delete(index);
        else next.add(index);
      } else {
        next.clear();
        next.add(index);
      }
      return next;
    });
  }

  function optionClass(index: number): string {
    const classes = ["kiri-mc-option"];
    if (selected.has(index)) classes.push("is-selected");
    if (revealed && correctIndices) {
      if (correctIndices.includes(index)) classes.push("is-correct");
      else if (selected.has(index)) classes.push("is-incorrect");
    }
    return classes.join(" ");
  }

  return (
    <div className="kiri-mc-shell">
      {modelCss ? <style>{modelCss}</style> : null}
      <div className="kiri-mc-question">
        <CardFace text={questionHtml} />
      </div>
      <p className="muted small">
        {allowMultiple ? "Check all that apply." : "Select one answer."}
      </p>
      <div className="kiri-mc-options" role="group">
        {order.map((choiceIndex) => (
          <button
            key={`${shuffleSeed}-${choiceIndex}`}
            type="button"
            className={optionClass(choiceIndex)}
            onClick={() => toggle(choiceIndex)}
          >
            {choices[choiceIndex]}
          </button>
        ))}
      </div>
      {!revealed && (
        <button type="button" className="btn btn-primary" onClick={onReveal}>
          Check answer
        </button>
      )}
      {revealed && explanationHtml.trim() && (
        <div className="kiri-mc-explanation">
          <CardFace text={explanationHtml} />
        </div>
      )}
    </div>
  );
}
