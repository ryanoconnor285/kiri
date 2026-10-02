import { mediaAssets } from "@kiri/db";
import { and, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { db, getSessionFromRequest } from "../context.js";

const MAX_BYTES = 15 * 1024 * 1024;

/** POST /api/media/upload — stores small blobs inline (storage_key data URI) until object storage is wired. */
export async function handleMediaUpload(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.writeHead(405);
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const user = await getSessionFromRequest(req);
  if (!user) {
    res.writeHead(401);
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > MAX_BYTES) {
      res.writeHead(413);
      res.end(JSON.stringify({ error: "File too large" }));
      return;
    }
    chunks.push(buf);
  }
  const body = Buffer.concat(chunks);
  const mimeType = String(req.headers["content-type"] ?? "application/octet-stream");
  const hash = createHash("sha256").update(body).digest("hex");
  const dataUri = `data:${mimeType};base64,${body.toString("base64")}`;

  const [existing] = await db
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.userId, user.userId),
        eq(mediaAssets.contentHash, hash),
      ),
    )
    .limit(1);

  const [row] = existing
    ? [existing]
    : await db
        .insert(mediaAssets)
        .values({
          userId: user.userId,
          contentHash: hash,
          storageKey: dataUri,
          mimeType,
          byteSize: body.length,
        })
        .returning();

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ id: row!.id, url: row!.storageKey }));
}
