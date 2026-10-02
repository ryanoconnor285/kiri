/** Example cards that parse correctly in Kiri (also used as the paste placeholder). */
export const KIRI_IMPORT_EXAMPLE = `What lowers enthalpy ($\\Delta H < 0$)?
Protonating $R-O^{-}$ to $R-OH$ (stronger O–H bond).

Question: Which change increases entropy? Check all that apply.

Choices:
Cleaving a polymer into monomer units
Folding a protein into a compact globule
Mixing two ideal gases

Correct: 0

AllowMultiple: no`;

export const KIRI_IMPORT_PROMPT = `Format the material below for import into Kiri (flashcard app).

YOU decide the content: what to test, how many items, basic Q&A vs multiple choice, and how much to split or combine. The only requirement is that your reply uses one of the exact text layouts below so Kiri can parse it.

HOW KIRI SHOWS TEXT (read this so math pastes correctly):
• Kiri is not a LaTeX document. It shows normal typing for plain text and uses KaTeX only inside math delimiters.
• Write English (or labels) as normal characters. Do not wrap whole questions or answers in $...$.
• Put ONLY the symbolic part in dollars: e.g. When $\\Delta H < 0$ the reaction is exothermic.
• Full line that is mostly an equation: use $$...$$ on that line alone, or a short bare formula line like S = k \\ln W.
• In your output, use single backslashes in LaTeX (\\Delta, \\alpha, \\ln). Do not double-escape for JSON or code.
• Avoid Unicode sub/superscripts (H₂O, x²) in import text; use $H_2O$ or plain words instead.
• Do not mention KaTeX, LaTeX, or rendering in the output—only the card text.

STRICT OUTPUT RULES:
• Output ONLY the import text. No intro, no outro, no commentary, no markdown headings, no \`\`\` fences.
• One blank line between each card or each multiple-choice note.

FORMAT 1 — Basic question and answer (most common)
Line 1 = prompt (question or cue). Following lines until the blank line = answer.

What is the one-letter code for methionine?
Met (M at protein termini)

Alternatives that also parse:
• Front: … / Back: … on separate lines in the same block
• One line per card: Term | definition

FORMAT 2 — Multiple choice (use when options and “check all that apply” fit the material)
Repeat this block for each question; blank line between blocks.

Question: (stem; may include inline $...$ math)

Choices:
(first choice; optional leading 0. or 1.)
(second choice, one per line)
…

Correct: 0,2,3
(comma-separated indices, 0 = first choice line)

AllowMultiple: yes
(use yes when more than one index is correct; no for single-select)

NOTES TO CONVERT:
(paste below)
`;
