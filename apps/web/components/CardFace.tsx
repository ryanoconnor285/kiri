"use client";

import { useMemo } from "react";
import DOMPurify from "dompurify";
import { KatexRenderer } from "./KatexRenderer";

const ALLOWED_TAGS = [
  "p",
  "br",
  "div",
  "span",
  "b",
  "i",
  "u",
  "em",
  "strong",
  "ul",
  "ol",
  "li",
  "img",
  "sub",
  "sup",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
  "blockquote",
  "code",
  "pre",
];

function looksLikeHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text) || /data:image\//i.test(text);
}

export function CardFace({ text, block = false }: { text: string; block?: boolean }) {
  const html = useMemo(() => {
    if (!looksLikeHtml(text)) return null;
    return DOMPurify.sanitize(text, {
      ALLOWED_TAGS,
      ALLOWED_ATTR: ["src", "alt", "class", "id", "colspan", "rowspan"],
      ALLOW_DATA_ATTR: false,
    });
  }, [text]);

  if (html) {
    return <div className="card-html" dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return <KatexRenderer text={text} block={block} />;
}
