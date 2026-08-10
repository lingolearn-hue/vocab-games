# Story authoring & translation logic

Companion to `REVIEW-TEXTS.md` (which tracks survey findings and fix
history). This file is the how-to: the rules to follow *while writing*
new Graded Reader content, so we don't create new congruence debt the
same way the original 36 passages did.

Scope: Graded Reader only, same as `REVIEW-TEXTS.md`. Campaign/Adventure
Mode is not covered here.

## Process order

1. **Author in English first.** English is the benchmark language (see
   `REVIEW-TEXTS.md`) — every other language is a sentence-by-sentence
   translation of the English, not an independent composition. Writing
   English first means the level-appropriate structure gets decided once,
   correctly, before translation has to preserve it.
2. Get the English signed off (content, level-appropriateness, paragraph
   count) before translating. Fixing structure after five languages exist
   costs five times as much as fixing it before any of them do.
3. Translate sentence-by-sentence into each target language. See
   "Translation rules" below.
4. Verify sentence-count congruence programmatically (see "Verification"
   below) before considering a passage done.
5. Log the batch (what was added, which languages, any deviations) in
   `REVIEW-TEXTS.md`.

## Level rules

Vocabulary and sentence structure must be **driven by the target level**,
not by what feels natural to write. A1 fairy tales are the highest-risk
case for this — fairy-tale register (past tense, scene-setting,
subordinate clauses: "once upon a time, in a small house at the edge of
a large forest, there lived...") is naturally B1+, and has to be
deliberately restrained to read as A1. When a sentence wants to be
complex, split it — don't compromise the level to preserve one elegant
sentence.

### A1
- Present tense throughout. Avoid past tense narration even for stories —
  simple present ("The wolf knocks on the door.") is the norm at this
  level; save past-tense narration for A2+.
- One clause per sentence. No subordinate clauses (no "because," "when,"
  "which," "that" introducing a clause; no relative clauses).
- Sentences 4–8 words.
- Only high-frequency, concrete vocabulary — everyday objects, family,
  animals, numbers, colors, basic actions. No abstract nouns.
- Repetition is a feature. Fairy tales already lean on repeated phrases
  ("He knocks. No one answers. He knocks again.") — lean into this
  rather than varying phrasing for its own sake.
- No idioms, no figurative language.

### A2
- Past tense is introduced (simple past narration is now appropriate for
  stories) but keep it simple and regular where possible.
- Basic connectors allowed: "and," "but," "because," "when," "then."
- One light subordinate clause per sentence is fine; avoid nesting two.
- Sentences 8–12 words.
- Everyday narrative vocabulary; can introduce a small number of new
  concrete nouns per passage if glossed by context.

### B1
- Mixed tenses (present, past, present perfect) as natural.
- Coordinated and subordinated clauses are normal now.
- Opinions, reasoning, and simple abstract concepts can appear.
- Sentences 12–18 words.
- Vocabulary can include common abstract nouns and moderately
  low-frequency words, still without requiring specialist knowledge.

### B2
- Complex sentence structures, multiple clauses, passive voice,
  conditional/subjunctive as needed.
- Abstract, analytical, or argumentative content is appropriate.
- Idiomatic expressions are fine.
- Sentence length is not artificially capped — natural register for the
  topic.

### C1
- Full natural register: academic or literary complexity, low-frequency
  vocabulary, rhetorical structure, dense information, nested
  subordination.
- No artificial constraints beyond what genuinely serves the topic.

## Translation rules

- **Translation must stay close to the English original** — this is a
  sentence-by-sentence parallel corpus, not a set of independent
  retellings that happen to cover the same plot. Don't drop a clause
  because it's awkward in the target language; find a faithful rendering
  instead. Don't add content (explanatory asides, extra examples,
  culturally-adapted references) that isn't in the English.
- **One English sentence = one sentence in every other language**, in
  the same order, covering the same content. Splitting or merging is
  sometimes unavoidable for grammatical reasons (see "Verification"
  below) but should be the exception, done deliberately, not a byproduct
  of loose translation.
- **Paragraph breaks must also align.** If English has 6 paragraphs,
  every language has 6 paragraphs at the same points. This didn't come
  up as an issue in the single-paragraph passages fixed so far, but
  fairy tales will be multi-paragraph from the start.
- **Character and place names**: classic fairy tales (Rotkäppchen,
  Hänsel und Gretel, etc.) have fixed, canonical names in their language
  of origin — use those, not invented equivalents. This is different
  from the existing "Xiao Ming / Max / Carlos" pattern in the non-fairy-
  tale passages, where localizing an everyday character's name across
  languages was a deliberate earlier choice. Don't extend that pattern
  to fairy tales; keep canonical names as-is in every language and only
  translate the surrounding text.
- **Never fabricate content to fill a gap, and never silently drop
  content that's inconvenient to translate.** Both happened in the
  original 36 passages and both were real bugs, not stylistic choices —
  see `REVIEW-TEXTS.md` for the specific cases (a fabricated sentence
  about Li Bai's influence on Japanese poetry; several sentences dropped
  outright). If a sentence is genuinely hard to translate faithfully,
  that's a signal to slow down, not to improvise.

## Level-label mapping across languages (CEFR / JLPT / HSK)

English is the benchmark for *content and structure*, but each language
keeps its own native level scale as the `level` field (CEFR for
German/English/Spanish/French, JLPT N5–N1 for Japanese, HSK for
Chinese) — matching how the existing 36 passages already work.

The complication: **HSK has finer granularity than CEFR at the low end**,
so a single CEFR level doesn't always map to a single HSK number. Rough
accepted equivalence:

| CEFR | JLPT | HSK (approx.) |
|---|---|---|
| A1 | N5 | HSK1–2 |
| A2 | N4 | HSK2–3 |
| B1 | N3 | HSK3–4 |
| B2 | N2 | HSK4–5 |
| C1 | N1 | HSK5–6 |

Since the `level` field takes a single value, not a range, use this rule
when labeling Chinese passages: **pick the closer of the two HSK levels
based on the actual vocabulary used in that specific passage, defaulting
to the lower one when genuinely unsure.** Presenting content slightly
below a learner's assumed level is a minor inconvenience; presenting it
above is a comprehension failure. Don't force a passage's Chinese
vocabulary to hit a specific HSK number if it distorts the translation —
translate faithfully first, then label honestly based on what came out.

This table is approximate pedagogical convention, not a strict
certification-body mapping — treat it as a labeling heuristic, not a
constraint that overrides faithful translation.

## Verification

Use `tools/check_reader_congruence.py` — checks every language's
sentence counts per paragraph against English across the whole corpus,
not just one passage.

Sentences are split on sentence-ending punctuation (`.!?` for most
languages, `。！？` for Japanese/Chinese). Two known false-positive
classes are already handled by the tool itself, not just documented as
manual exceptions:

- **French**: closing guillemets are preceded by a space in French
  typography (`...grandes ? », dit...`), which fires a false split at
  the `?`/`!` before the closing `»`. The tool merges any fragment
  starting with `»` back into the previous one.
- **Japanese/Chinese**: closing quote marks (`」`/`』`) come *after* the
  sentence-ending punctuation rather than before it — the mirror image
  of the French case — causing the same kind of false split. Handled
  the same way.

One class is *not* auto-handled and still needs manual judgement: a
quote mark sitting immediately before a sentence-ending period in
English/German/Spanish (`do.' Only...`) suppresses the split there,
since straight quotes don't distinguish open from close, making
automatic correction unreliable. This has caused a growing list of
confirmed false positives (`s5`, `s7`, `p38`, `nf7`/es, and `ft1`/es,
`ft2`/es, `ft4`/es, `ft5`/es+fr, `ft6`/ja+es — see `REVIEW-TEXTS.md`) —
always manually inspect a flagged mismatch involving dialogue before
assuming it's a real gap. In practice this is almost always English
itself that's undercounting (its straight quotes plus a mid-sentence
dialogue tag create the ambiguous case most often), so when only English
looks "low" relative to several other languages agreeing with each
other, that's a strong hint it's this pattern rather than a real gap in
those other languages.

## File & schema conventions

- All Graded Reader content lives in `public/reader/{lang}-en.json`, one
  file per language, `passages` array, no separate files for special
  series (fairy tales included) — keeps the existing tooling working
  without modification.
- `id`: `{lang}-p{n}` for the main series, `{lang}-s{n}` for standalone
  fiction, `{lang}-nf{n}` for non-fiction, `{lang}-ft{n}` for fairy
  tales — new prefix, open to changing if a better one comes up but not
  worth blocking on.
- `titleTranslation` is always the English title, regardless of the
  passage's own language — this is what non-English passages use to
  cross-reference back to the English benchmark.
- `series`: same story name (or a stable series identifier) across all
  levels/languages of a multi-part story, for the app's series grouping
  feature.
- `tags`: keep the existing pattern (`fiction`/`non-fiction`,
  `topic:...`, `beginner`/`intermediate`/`advanced`, `series:...`).

## Length

**Fairy tales target 5–6 paragraphs minimum, at every level including
A1.** This is a genre-specific override, not a change to A1 rules in
general — the existing single-paragraph A1 passages (My Friend, My Cat,
etc.) stay as they are. Fairy tales need enough room for a real
beginning/middle/end (setup, complication, resolution) to read as an
actual story rather than a vocabulary drill, so length is driven by the
genre, while sentence-level constraints (tense, clause structure,
vocabulary, sentence length) are still driven by the level as described
above. In practice this means an A1 fairy tale is 5–6 paragraphs of
short, simple, present-tense sentences — more paragraphs than a typical
A1 passage, but no more complex per sentence.

## Tagging

Since the goal is to expand this into fairy tales from multiple
countries over time, tag liberally from the start rather than retrofitting
later:

- `genre:fairytale` — identifies the content type, parallel to the
  existing `fiction`/`non-fiction` split but more specific. Keep
  `fiction` too; `genre:fairytale` is additive, not a replacement.
- `origin:{country}` — country/culture of origin, e.g. `origin:germany`,
  `origin:france`, `origin:japan`. Lowercase, single word where possible,
  consistent naming from the first entry since this is meant to scale.
- Existing conventions still apply: `topic:...`, `beginner` /
  `intermediate` / `advanced`, `series:...` for grouping parts of the
  same tale together if a story is split across a level progression the
  way My Friend/My Cat/The Market are.
- `level:{CEFR}` — e.g. `level:A1`. This is the important one for
  cross-language consistency: each language's native `level` field
  differs in scale (CEFR for German/English/Spanish/French, JLPT for
  Japanese, HSK for Chinese — see the mapping table above), so it can't
  be used to reliably group "the same difficulty" across languages.
  `level:{CEFR}` uses the English benchmark's CEFR level on *every*
  language's version of a given story, so filtering/grouping works
  uniformly regardless of each language's own scale.

## Level strategy

Fairy tales are capped at **A1–B2**. No C1/C2 fairy tales — by that level,
"retelling a children's story" stops being the right register; C1/C2
content (if ever added for this genre) should shift to writing *about*
tales (folklore, cultural comparison) rather than retelling them, and
that's a separate future decision, not committed to here.

**Pairing, not a six-level ladder.** Retelling the same tale six times
(A1 through C1) goes stale fast — there's only so much narrative material
in one story. Instead:

- **A1 + B1 pair**: the same three tales, retold at both levels. A1 gets
  the simple/present-tense version (see Level rules above); B1 retells
  the identical plot with fuller sentence structure, past tense
  narration, and the grammar headroom B1 allows — same events, richer
  telling.
- **A2 + B2 pair**: a *different* three tales get the same treatment —
  one simple version at A2, one fuller retelling at B2.

This means six tales total get fully developed (A1/B1 pair × 3 stories,
A2/B2 pair × 3 different stories), rather than one tale stretched thin
across every level.

**Current status:**
- **A1 + B1 pair** (origin: Germany): Little Red Riding Hood, The Bremen
  Town Musicians, Hansel and Gretel. A1 versions exist for all three; B1
  retellings are the next piece of work, not yet written.
- **A2 + B2 pair**: Snow White, Cinderella, Rumpelstiltskin — chosen, not
  yet written at either level. Still open: whether this trio stays
  German/Grimm (matching the A1/B1 trio) or is the point to diversify
  origin country.

## Country strategy

Goal: pull fairy tales from each of the six supported languages' own
cultural traditions, so every language gets a turn as source culture, not
just translation target. Germany is the first origin (all three current
tales are Grimm). Suggested remaining five: Spain, France, Japan, China,
and a specific English-language tradition (a named British/Irish tale or
American folklore, rather than "generic English") — not finalized, open
to discussion when we get there. Work one country at a time rather than
committing to the full six-country matrix up front.

## Non-fiction & biographies

Worth trying earlier rather than later — not gated on finishing the
fairy-tale pipeline first. A small pilot batch (a few titles, not a full
build-out) is a reasonable thing to run in parallel, mainly to see
whether the same process (English first, sentence-by-sentence
translation, congruence check) holds up for a genre with a different
register and no built-in repetition/simplicity crutches the way fairy
tales have.

Unlike fairy tales, non-fiction topics here don't need `origin:{country}`
tagging — these are universal-knowledge subjects, not culture-specific
tales, so no origin tag applies.

**Pilot batch, decided:**
- **A1 + B1 pair**: Elephants, Trees, Bread
- **A2 + B2 pair**: My Body, The Ocean, Weather

Same pairing logic as fairy tales (see Level strategy above) — each
topic gets a simple version at the lower level and a fuller retelling
at the higher level, not stretched across the full A1–C1 range.

