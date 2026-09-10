import type { IncomingMessage, ServerResponse } from "node:http";
import { parseApkg } from "@kiri/apkg";
import { cards, decks, reviewStates } from "@kiri/db";
import { and, eq } from "drizzle-orm";
import { db, getSessionFromRequest } from "./context.js";

const MAX_BYTES = 50 * 1024 * 1024;
const MAX_CARDS = 5_000;
const INSERT_CHUNK = 100;

async function readBody(req: IncomingMessage, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > maxBytes) {
      throw new Error("FILE_TOO_LARGE");
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks, size);
}

export async function handleImportApkg(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const user = await getSessionFromRequest(req);
  if (!user) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  const url = new URL(req.url ?? "/", "http://localhost");
  const deckId = url.searchParams.get("deckId") ?? "";
  if (!deckId) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Missing deckId" }));
    return;
  }

  const [deck] = await db
    .select({ id: decks.id })
    .from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.userId, user.userId)))
    .limit(1);
  if (!deck) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Deck not found" }));
    return;
  }

  let body: Buffer;
  try {
    body = await readBody(req, MAX_BYTES);
  } catch (err) {
    if (err instanceof Error && err.message === "FILE_TOO_LARGE") {
      res.writeHead(413, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "File too large (max 50MB)" }));
      return;
    }
    throw err;
  }

  if (body.length === 0) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Empty file" }));
    return;
  }

  let parsed;
  try {
    parsed = await parseApkg(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse Anki package";
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: message }));
    return;
  }

  if (parsed.cards.length === 0) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "No cards found in this Anki package" }));
    return;
  }
  if (parsed.cards.length > MAX_CARDS) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: `This package has ${parsed.cards.length} cards; the limit is ${MAX_CARDS}`,
      }),
    );
    return;
  }

  let importedCount = 0;
  for (let i = 0; i < parsed.cards.length; i += INSERT_CHUNK) {
    const chunk = parsed.cards.slice(i, i + INSERT_CHUNK);
    const inserted = await db
      .insert(cards)
      .values(
        chunk.map((card) => ({
          deckId,
          frontText: card.frontText,
          backText: card.backText,
        })),
      )
      .returning({ id: cards.id });

    if (inserted.length > 0) {
      await db.insert(reviewStates).values(
        inserted.map((card) => ({
          cardId: card.id,
          userId: user.userId,
        })),
      );
    }
    importedCount += inserted.length;
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      importedCount,
      skippedCount: parsed.skippedCount,
    }),
  );
}
