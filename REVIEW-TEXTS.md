# Story content survey (Graded Reader, Dialogues, Adventure Mode)

First pass at this content, done cold (no prior session context on stories,
unlike the vocab data). Structural survey only — no prose-quality read-through
yet, no per-passage accuracy spot-checks. Treat the numbers below as a map of
what exists and what's missing, not a quality judgment on the text itself.

## Core design rule (set by V)

- **Benchmark language: English.** Every language's `translation` field
  already points to English, so this formalizes the existing de facto hub
  rather than changing anything structurally.
- Every Graded Reader text must exist in **all six languages**.
- All six versions of a text must be **sentence-level congruent** with the
  English benchmark: sentence N in any language corresponds to sentence N
  in English.
- Campaign/Adventure Mode is explicitly **out of scope** for this rule for
  now.

### Status: full realignment complete — 34/36 exactly congruent, 2 confirmed-correct false positives

All 6 languages are at 39/39 passages (French Graded Reader was built from
scratch this session; a 3-passage "Windsurfing" mini-series that only
Chinese originally had was translated into all 5 other languages). This
section covers the deeper pass: realigning the original 36 passages'
German/Spanish/Japanese/Chinese text to be sentence-level congruent with
English, not just present.

Went through all 31 originally-mismatched passages (of 36) and realigned
German, Spanish, Japanese, and Chinese to English sentence-by-sentence.
This wasn't just re-punctuating — the process surfaced real content bugs
along the way, not just splitting differences:

- **Missing content**: several DE/ES/JA passages were missing an entire
  sentence — usually the last one (nf6, nf7, nf9, nf10 in DE/ES; nf8/nf9
  in JA) or a whole paragraph's worth of argument (p2f's Chinese-philosophy
  paragraph was entirely absent from both ES and JA; nf10's "unification
  of script under Qin" sentence was missing from both DE and ES).
- **Wrong content, not just missing**: p3e's Japanese text said "Japan's
  traditional market culture" where it should have said China's; s3's
  Japanese text described a *Japanese* festival night market with
  Japanese foods (yakitori, takoyaki) instead of Taiwan's night market
  (grilled squid, stinky tofu, bubble milk tea) — a real mistranslation,
  not a splitting artifact.
- **Fabricated content**: nf7's Japanese text ended with an invented claim
  about Li Bai's influence on Japanese kanshi poetry that has no
  counterpart in English at all, while dropping three real English
  sentences (his troubled official career, his retreat to nature, his
  legendary drowning death) in the process.
- **A genuine truncation**: p3f's Japanese text simply stopped two
  sentences short of the English original, plus had a typo (missing "land"
  from a "land, labour, and money" list).
- **Localized names/places kept as-is where already established**: e.g.
  Xiao Ming becomes Max (DE) / Carlos (ES) / Kenta (JA) consistently
  within a passage — a deliberate localization choice already present
  before this pass, not something this realignment changed.

Only 2 passages still show a sentence-count difference (`s5`, `s7`),
confirmed by manual inspection to be a splitter limitation, not a real
gap: English's regex undercounts by one in both because of a quote mark
sitting immediately before the sentence-ending period (`do.' Only...`),
which suppresses the split. Spanish/Japanese/Chinese's higher count is
the semantically correct one.

### Known remaining gap: the original 36 passages aren't congruent with each other

Checked all 36 passages across the 5 existing languages (splitting on
sentence-ending punctuation, `。！？` for ja/zh and `.!?` for the rest) and
compared sentence counts per passage:

- **31/36 (86%) have a sentence-count mismatch** between at least two
  languages — meaning the current "parallel" passages are topic/paragraph
  parallel, not sentence-level parallel, despite having matching titles and
  covering the same content.
- Severity: mostly off by 1 sentence (20 passages), but 9 are off by 2 and
  2 are off by 3.
- Japanese is the most frequent outlier — it has *more* split sentences than
  the other four languages in the large majority of mismatches, suggesting
  either a more clause-heavy translation style or a splitter difference
  worth double-checking (some of this could be real, some could be
  punctuation-detection noise — worth a manual look at a few examples before
  assuming it's all real).
- This is not a new problem: the reader already has a documented
  "per-passage mismatch guard" for sentence-level tap-to-translate, which is
  a runtime workaround for exactly this — the data doesn't guarantee
  congruence, so the UI has to defensively handle it not matching. Fixing
  the data properly would let that guard eventually become unnecessary.

### Structural implication

Passages currently store `text` and `translation` as flat strings, split
into sentences at render time. Enforcing sentence-level congruence properly
likely means either:
- storing text as an explicit array of sentences per language (so
  congruence is checkable by array length, and each index is a designed
  pairing, not an accident of matching punctuation), or
- keeping flat strings but adding an automated congruence check to the
  authoring/review pipeline (similar in spirit to the vocab review-status
  system) that flags mismatches before they ship.

Not decided yet — flagging as the first real design decision before any
rewrite work starts.

## Biggest opportunities, ranked

1. **Adventure Mode is far less complete than it looks.** `campaigns.json`
   advertises 2 campaigns x 12 chapters = 24 chapters total. Only **6 chapters
   have been authored at all** (Crystal of Light: 2/12, Wandering Scholar:
   4/12), and only **one compiled, deployable per-language file exists**
   (`ja-campaign.json`, itself only 2/12 chapters). Practically: Adventure
   Mode is barely playable in Japanese and not deployed in any other language,
   despite the source `.tsv`/chapter-json files having en/de/es/ja/zh content
   already authored for the 6 chapters that exist. The compile step
   (`convert.py`) hasn't been run for most of what's already written.
2. **French has zero story content of any kind** — no reader passages, no
   dialogues, no campaign chapter text. Campaign *metadata* (titles/
   subtitles) does include French, which will show a French title in the
   campaign picker that then has nothing to open — worth fixing or hiding
   before this is user-facing. The lemmatizer setup (`SETUP.txt`) already
   references `fr_core_news_sm`, so French support was planned for this
   pipeline, just never populated.
3. **English dialogues are nearly empty** — 1 dialogue vs. 8 for every other
   language.
4. **Graded Reader level coverage is thin at the extremes** for every
   language — see table below. A1/N5/HSK1 and C1/N1/HSK6 have roughly a
   third as many passages as the mid-range levels.

## Graded Reader (`public/reader/*.json`)

**Note: the table below is stale** — written before French was fully
built out and before the fairy-tale genre existed. As of this session,
all six languages are at 48 passages each (45 + 3), including French,
which the table below still shows as empty. Treat this table as a
historical snapshot of the original 36-passage survey, not current
state; a fresh structural survey would be needed for accurate current
numbers.

### France fairy-tale trio added (this session)

Bluebeard, Puss in Boots, Tom Thumb — `ft7`/`ft8`/`ft9` (A1) and
`ft10`/`ft11`/`ft12` (B1) in every `public/reader/{lang}-en.json`,
`origin:france`. Japanese uses full kanji at both levels (deliberate
deviation from the `ft1`–`ft6` kana-only convention — see
`AUTHORING-TEXTS.md`); one mid-edit slip caught and fixed where a
kanji rewrite accidentally substituted the condensed B1 sentence
structure into an A1 paragraph (12 sentences collapsed to 6) —
caught by the congruence checker, not by inspection, which is exactly
what that tool is for. Written English-first, reviewed and revised (see
`AUTHORING-TEXTS.md` for the content-edit log), then translated
sentence-by-sentence into DE/ES/FR/JA/ZH. Verified congruent via
`tools/check_reader_congruence.py` — zero mismatches on the A1 set;
the B1 set has three Japanese/Chinese mismatches (`ft10`/ja, `ft11`/ja,
`ft11`/zh), all confirmed as known tool-counting artifacts, not real
translation gaps (see `AUTHORING-TEXTS.md`). The other 13 flagged mismatches across both
sets are all pre-existing issues on `ft1`–`ft6`/`s5`/`s7`/`p38`,
untouched by this work.

### Japan fairy-tale trio added (this session)

Momotarō, Urashima Tarō, The Grateful Crane — `ft13`/`ft14`/`ft15` in
every `public/reader/{lang}-en.json`, `origin:japan`, A2 (written
directly at A2, no A1 companion). Full kanji in Japanese, matching the
France trio's convention. Sentence-length and connector-vocabulary
audit run *before* translation this time — direct lesson from the
France B1 miscalibration — verified 8–12 word sentences and past-tense
narration up front rather than after the fact; caught and fixed 3
uses of "however" (not on the A2-approved connector list) during that
pre-translation audit. One real translation-structure bug still came
up during congruence verification despite the earlier audit: the
Japanese Momotarō translation split one English sentence into two,
breaking sentence alignment — caught by
`tools/check_reader_congruence.py`, not by inspection, and fixed by
merging back into one natural Japanese sentence. Final check: zero new
mismatches beyond the existing documented set of 16 (13 pre-existing +
3 from the France B1 set, all previously catalogued).

### Japan B2 trio added (this session)

Momotarō, Urashima Tarō, The Grateful Crane — `ft16`/`ft17`/`ft18` in
every `public/reader/{lang}-en.json`, `origin:japan`, B2 companion
pieces to the A2 trio above. Content fidelity checked against
multiple independent web sources before translation — see
`AUTHORING-TEXTS.md` for the Grateful Crane finding (a genuine fork in
the source material under the identical tale title, not an error;
flagged to the user and resolved by explicit choice). DE/ES/FR/ZH
translation was clean on first pass. Japanese needed a real, multi-
paragraph rework: B2's colon- and em-dash-joined complex sentences had
been split into multiple Japanese sentences during translation across
all three stories (worst case 3→8 sentences in one paragraph) —
identified and fixed paragraph-by-paragraph against the actual
`tools/check_reader_congruence.py` output. Final state: 17 total
mismatches, exactly the 16 pre-existing/documented ones plus one new
instance of the already-catalogued Latin quote-before-period artifact
(`ft17`), not a translation gap. Japanese was initially drafted with normal
kanji before catching that this corpus's existing fairy tales are pure
hiragana, word-spaced, no kanji — see `AUTHORING-TEXTS.md`
country-strategy section for the full note. The first B1 English draft
also overshot to B2 register on the first pass (long stacked-clause
sentences, idioms) and had to be rewritten with actual measurement
rather than by feel — also logged in `AUTHORING-TEXTS.md`.

| Language | Passages | Levels (count) | Avg text length | Series | Unique topics |
|---|---|---|---|---|---|
| German | 36 | A1:3 A2:8 B1:14 B2:6 C1:5 | 825 chars | 3 | 27 |
| English | 36 | A1:3 A2:8 B1:14 B2:6 C1:5 | 836 chars | 3 | 27 |
| Spanish | 36 | A1:3 A2:8 B1:14 B2:6 C1:5 | 816 chars | 3 | 27 |
| Japanese | 36 | N5:3 N4:8 N3:14 N2:6 N1:5 | 397 chars | 3 | 27 |
| Chinese | 39 | HSK1:4 HSK2:9 HSK3:8 HSK4:7 HSK5:6 HSK6:5 | 209 chars | 4 | 28 |
| French | **0** | — | — | — | — |

- Genre split is consistent across languages: ~58% fiction / ~42%
  non-fiction.
- No duplicate passage IDs in any file — structurally clean.
- All passages have a translation (100%).
- German/English/Spanish/Japanese passage sets appear to be direct
  translations of each other (same level distribution, same topic count,
  same series count) — Chinese has 3 more passages and a 4th series not
  present elsewhere, meaning it's not a perfect mirror of the other four.
- Japanese passages run much shorter per-character than the alphabetic
  languages, which is expected (kanji density), not necessarily shorter in
  actual content — didn't verify word-count equivalence.

## Dialogues (`public/dialogues/*.json`)

| Language | Dialogues | Levels |
|---|---|---|
| German | 8 | A1:1 A2:2 B1:2 B2:2 C1:1 |
| Spanish | 8 | A1:1 A2:2 B1:2 B2:2 C1:1 |
| Japanese | 8 | N5:1 N4:2 N3:3 N2:1 N1:1 |
| Chinese | 8 | HSK1:1 HSK2:2 HSK3:1 HSK4:2 HSK5:2 |
| English | **1** | A2:1 |
| French | **0** | — |

## Adventure Mode / Campaign (`public/campaign/`)

- 2 campaigns declared in `campaigns.json`: **Crystal of Light** (beginner,
  N5/A1, 12 chapters) and **Two Philosophers Walk Into a Study** /
  Wandering Scholar (A1/A2, 12 chapters).
- **Authored chapters** (source `campaign_XXXX.json`/`.tsv` files, each with
  en/de/es/ja/zh content already written): Crystal of Light 2/12
  (`A0101`, `A0102`), Wandering Scholar 4/12 (`B0101`-`B0104`). **18 of 24
  declared chapters have no content at all yet.**
- **Compiled/deployable files**: only `ja-campaign.json` exists, and it only
  contains Crystal of Light's 2 authored chapters — Wandering Scholar has
  never been compiled into a playable file for any language, despite 4
  chapters of source content existing for it.
- No intermediate/advanced campaign exists at all — both campaigns are
  beginner-tier.
- Chapter structure itself (per authored chapter) looks solid: `storyIntro`/
  `storyOutro`, sectioned content, a grammar-artifact tie-in, vocab lesson
  linkage — the format isn't the gap, the volume is.

## Suggested next steps (not yet started)

- Decide whether to prioritize *compiling* what's already authored (6
  chapters -> multi-language deployable files, likely the fastest win) or
  *authoring* more chapters to fill the other 18.
- French: either build out reader/dialogue/campaign content from scratch, or
  explicitly scope it out and hide French from the story-mode language
  picker until content exists, to avoid a dead-end UI state.
- English dialogues: 1 vs. 8 elsewhere is a clear, bounded gap to close.
- No accuracy/quality read-through has been done yet on any existing
  passage, dialogue, or chapter — that's a separate pass from this
  structural survey.
