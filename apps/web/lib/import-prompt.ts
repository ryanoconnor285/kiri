export const KIRI_IMPORT_PROMPT = `Turn the notes below into flashcards for Kiri. Output only the cards, no commentary.

Format:
- First line is the front (question). Following lines are the back (answer).
- Put a blank line between cards.
- Keep normal English spacing. Do not smash words together.
- Put formulas inline in the sentence using single-dollar KaTeX, for example: a decrease in enthalpy ($\\Delta H < 0$).
- Use $$...$$ only for a standalone equation on its own line, never inside a sentence.

Notes:
\`\`\`
(paste notes here)
\`\`\`
`;
