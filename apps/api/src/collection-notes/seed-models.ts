import {
  BUILTIN_NOTE_MODELS,
  type BuiltinNoteModel,
} from "@kiri/card-templates";
import {
  cardTemplates,
  modelFields,
  noteModels,
  type Database,
} from "@kiri/db";
import { and, eq } from "drizzle-orm";

async function insertModelFromBuiltin(db: Database, userId: string, builtin: BuiltinNoteModel) {
  const [model] = await db
    .insert(noteModels)
    .values({
      userId,
      name: builtin.name,
      kind: builtin.kind,
      css: builtin.css,
      builtinSlug: builtin.slug,
    })
    .returning();
  if (!model) return null;

  for (const field of builtin.fields) {
    await db.insert(modelFields).values({
      modelId: model.id,
      name: field.name,
      ord: field.ord,
      isSort: field.isSort ?? false,
    });
  }
  for (const tmpl of builtin.templates) {
    await db.insert(cardTemplates).values({
      modelId: model.id,
      ord: tmpl.ord,
      name: tmpl.name,
      qfmt: tmpl.qfmt,
      afmt: tmpl.afmt,
    });
  }
  return model;
}

/** Ensure built-in note types exist for this user (idempotent). */
export async function ensureBuiltinNoteModels(db: Database, userId: string) {
  for (const builtin of BUILTIN_NOTE_MODELS) {
    const [existing] = await db
      .select({ id: noteModels.id })
      .from(noteModels)
      .where(and(eq(noteModels.userId, userId), eq(noteModels.builtinSlug, builtin.slug)))
      .limit(1);
    if (existing) continue;
    await insertModelFromBuiltin(db, userId, builtin);
  }
}

export async function getLegacyBasicModel(db: Database, userId: string) {
  await ensureBuiltinNoteModels(db, userId);
  const [model] = await db
    .select()
    .from(noteModels)
    .where(and(eq(noteModels.userId, userId), eq(noteModels.builtinSlug, "basic")))
    .limit(1);
  return model ?? null;
}

const LEGACY_SLUG = "legacy-imported";

export async function getOrCreateLegacyWrapModel(db: Database, userId: string) {
  const [existing] = await db
    .select()
    .from(noteModels)
    .where(and(eq(noteModels.userId, userId), eq(noteModels.builtinSlug, LEGACY_SLUG)))
    .limit(1);
  if (existing) return existing;

  const basic = await getLegacyBasicModel(db, userId);
  const [created] = await db
    .insert(noteModels)
    .values({
      userId,
      name: "Basic (legacy)",
      kind: "basic",
      css: basic?.css ?? "",
      builtinSlug: LEGACY_SLUG,
    })
    .returning();
  if (!created) throw new Error("Could not create legacy model");

  await db.insert(modelFields).values([
    { modelId: created.id, name: "Front", ord: 0, isSort: true },
    { modelId: created.id, name: "Back", ord: 1 },
  ]);
  await db.insert(cardTemplates).values({
    modelId: created.id,
    ord: 0,
    name: "Card 1",
    qfmt: "{{Front}}",
    afmt: "{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}",
  });
  return created;
}
