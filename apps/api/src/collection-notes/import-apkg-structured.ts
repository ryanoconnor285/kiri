import { parseApkgStructured } from "@kiri/apkg";
import type { Database } from "@kiri/db";
import type { GraphQLContext } from "../context.js";
import { createNoteModel, upsertCollectionNote } from "./service.js";
import { ensureBuiltinNoteModels } from "./seed-models.js";

function ctx(db: Database, userId: string): GraphQLContext {
  return { db, user: { userId, email: "" } } as GraphQLContext;
}

export async function importApkgStructuredToDeck(
  db: Database,
  userId: string,
  deckId: string,
  body: Buffer,
): Promise<{ importedNotes: number; skippedCount: number }> {
  const parsed = await parseApkgStructured(body);
  const context = ctx(db, userId);
  await ensureBuiltinNoteModels(db, userId);

  const modelCache = new Map<string, string>();
  let importedNotes = 0;

  for (const note of parsed.notes) {
    let modelId = modelCache.get(note.ankiModelName);
    if (!modelId) {
      const fieldNames = Object.keys(note.fieldValues);
      const created = await createNoteModel(context, userId, {
        name: `Imported · ${note.ankiModelName}`,
        kind: note.ankiModelType === 1 ? "cloze" : "basic",
        css: "",
        fields: fieldNames.map((name, ord) => ({
          name,
          ord,
          isSort: ord === 0,
        })),
        templates: note.templates,
      });
      modelId = created.id;
      modelCache.set(note.ankiModelName, modelId);
    }

    await upsertCollectionNote(context, userId, {
      modelId,
      deckId,
      fieldValues: note.fieldValues,
    });
    importedNotes += 1;
  }

  return { importedNotes, skippedCount: parsed.skippedCount };
}
