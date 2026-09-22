"use client";

import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Scale the face so a whole flashcard fits the frame — no poster-size desktop cards. */
export function FitCardBody({
  children,
  contentKey,
}: {
  children: ReactNode;
  contentKey: string;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState("none");

  const fit = useCallback(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const availableH = outer.clientHeight;
    const availableW = outer.clientWidth;
    const neededH = inner.scrollHeight;
    const neededW = inner.scrollWidth;
    if (availableH <= 0 || availableW <= 0 || neededH <= 0 || neededW <= 0) {
      setTransform("none");
      return;
    }
    const scale = Math.max(
      0.4,
      Math.min(1, availableH / neededH, availableW / neededW),
    );
    const offsetY =
      scale >= 0.999 ? Math.max(0, (availableH - neededH) / 2) : 0;
    setTransform(`translateY(${offsetY}px) scale(${scale})`);
  }, []);

  useLayoutEffect(() => {
    fit();
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const ro = new ResizeObserver(() => fit());
    ro.observe(outer);
    ro.observe(inner);

    const onLoad = () => fit();
    const images = inner.querySelectorAll("img");
    images.forEach((img) => {
      if (!img.complete) img.addEventListener("load", onLoad);
    });

    return () => {
      ro.disconnect();
      images.forEach((img) => img.removeEventListener("load", onLoad));
    };
  }, [fit, contentKey, children]);

  return (
    <div ref={outerRef} className="flashcard-fit">
      <div ref={innerRef} className="flashcard-fit-inner" style={{ transform }}>
        {children}
      </div>
    </div>
  );
}
