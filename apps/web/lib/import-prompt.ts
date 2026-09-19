/** Example cards that parse correctly in Kiri (also used as the paste placeholder). */
export const KIRI_IMPORT_EXAMPLE = `What lowers enthalpy ($\\Delta H < 0$)?
Protonating $R-O^{-}$ to $R-OH$ (stronger O–H bond).

What raises entropy ($\\Delta S > 0$)?
Cleaving a polymer into monomer units.

Methionine | Met (M at protein termini)`;

export const KIRI_IMPORT_PROMPT = `Convert the notes below into flashcards for Kiri (STEM / pre-med recall practice).

OUTPUT — follow exactly or import will fail:
• Output ONLY the cards. No intro, no outro, no "Here are your cards", no markdown headings.
• Do NOT wrap the cards in a code block.
• One blank line between cards (required).
• Each card: first line = front (prompt). All following lines until the blank line = back (answer).

CARD DESIGN:
• One testable idea per card — split dense notes into many small cards.
• Front: a short retrieval question or cue (prefer ending with "?").
• Back: the shortest answer that confirms recall (term, value, mechanism step, etc.).
• Do not put front and back on the same line unless using "Front | Back" (see below).

MATH / CHEMISTRY (KaTeX):
• Inline math inside a sentence: single dollars, e.g. When is $\\Delta H < 0$?
• Standalone equation as the whole back (or front): either bare text (S = k\\ln W) OR display dollars ($$S = k\\ln W$$) — both work.
• Use $$...$$ (or bare formula) for a full-line equation; use $...$ only for math inside prose.
• Prefer $H_2SO_4$ over Unicode subscripts. Keep normal spaces between English words.

ALLOWED FORMATS (pick one style and stay consistent):

A) Question + answer (preferred)
What is the one-letter code for methionine?
Met (M at protein termini)

B) Labelled lines (within one card block)
Front: What product forms when $S_N2$ attacks primary alkyl halides?
Back: Inverted substitution product ($R-$Nu with inverted stereochemistry).

C) One line per card (good for vocab)
Methionine | Met (M at protein termini)
Glycine | Gly (G)

NEVER DO:
• Numbered/bulleted lists without a blank line between each card
• "Card 1:", "###", or other markdown structure
• A single paragraph of notes with no line breaks
• Commentary ("Note:", "Explanation:", "Source:") outside the back text

Example output:

What lowers enthalpy ($\\Delta H < 0$)?
Protonating $R-O^{-}$ to $R-OH$ (stronger O–H bond).

What raises entropy ($\\Delta S > 0$)?
Cleaving a polymer into monomer units.

Notes to convert:
(paste below)
`;
