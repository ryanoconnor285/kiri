import { cards, createDb, decks, reviewStates, users } from "@kiri/db";
import { eq } from "drizzle-orm";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/kiri";

const db = createDb(connectionString);

const DEMO_EMAIL = "demo@kiri.app";

const sampleCards = [
  {
    front: "\\text{H}_2\\text{SO}_4",
    back: "Sulfuric acid — strong acid, diprotic",
  },
  {
    front: "E = mc^2",
    back: "Mass-energy equivalence (Einstein)",
  },
  {
    front: "\\Delta G = \\Delta H - T\\Delta S",
    back: "Gibbs free energy equation",
  },
  {
    front: "What is the rate-determining step?",
    back: "The slowest step in a reaction mechanism that limits overall rate",
  },
  {
    front: "\\text{CH}_3\\text{COOH}",
    back: "Acetic acid — weak organic acid (vinegar)",
  },
];

async function seed() {
  console.log("Seeding database...");

  let [user] = await db.select().from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);

  if (!user) {
    [user] = await db
      .insert(users)
      .values({
        email: DEMO_EMAIL,
        name: "Demo User",
        emailVerified: true,
      })
      .returning();
    console.log(`Created demo user: ${DEMO_EMAIL}`);
  }

  const existingDecks = await db
    .select()
    .from(decks)
    .where(eq(decks.userId, user!.id));

  if (existingDecks.length > 0) {
    console.log("Demo deck already exists, skipping card seed.");
    process.exit(0);
  }

  const [deck] = await db
    .insert(decks)
    .values({
      userId: user!.id,
      title: "STEM Fundamentals",
      description: "Sample deck with KaTeX chemistry and physics cards",
    })
    .returning();

  for (const sample of sampleCards) {
    const [card] = await db
      .insert(cards)
      .values({
        deckId: deck!.id,
        frontText: sample.front,
        backText: sample.back,
      })
      .returning();

    await db.insert(reviewStates).values({
      cardId: card!.id,
      userId: user!.id,
    });
  }

  console.log(`Seeded deck "${deck!.title}" with ${sampleCards.length} cards.`);
  process.exit(0);
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
