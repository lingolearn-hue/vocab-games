# TODO / Future Improvements

## Data quality
- [x] German `pos` field cleanup — done. `Vogelsang` fixed (`unclear`→`noun`),
      `adjektiv`→`adj` (79 words) and `num`→`numeral` (5 words) unified.
      Corresponding example-sentence keys migrated, zero gaps. One stray
      `number`→`numeral` value (`neunzig`) found later and fixed too.
- [x] French `pos` field has corrupted values in `fr-en.json` — fixed
      (32 rows: `verbs`→`verb`, `adverbs`→`adv`, `nom`→`noun`, `num`→
      `numeral`, plus 9 leaked-word values mapped to correct POS).
- [x] Japanese `pos` field — 100% coverage across all JLPT levels (N5-N1,
      7,922 words). Pipeline: direct match against vbvss199's
      Language-Learning-decks dataset (~5,350 words), then JMdict
      (scriptin/jmdict-simplified) matched by kanji headword *and* kana
      reading with a ≥60% sense-agreement threshold (~1,070 words), then
      manual classification for the ~150 remaining edge cases (idioms,
      set greetings, する-compound verbs).
- [x] Confirmed all other vocab lists (German, Spanish, French, Chinese,
      English) already had 100% `pos` coverage — only Japanese needed work.
      Full list of `pos` values in use across all 6 languages: `noun`,
      `verb`, `adj`, `adv`, `pron`, `conj`, `interj`, `numeral`, `none`,
      `other`, `phrase` (Chinese only), `classifier` (Chinese only).
- [x] Removed `es-a1.json` and `zh-hsk1.json` — 15-entry leftover stub files
      with a different (no-`pos`) schema, unreferenced anywhere in `src/`.
      Superseded by the real `es-en.json`/`zh-en.json` long ago.
- [x] Vulgarity/sensitive-term scan across all 6 vocab lists — done. Profanity
      + sensitive biological terms tagged `vulgar` in `categories` (filtered
      out by default, toggle in Settings → Content). Identity-based slurs
      (`marica` es, `玻璃` zh) removed outright. Mistagged gloss fixed
      (`だらしない` ja had a stray "a slut" sense in its translation).
- [x] German example sentences — 100% coverage, all levels.
- [x] Japanese example sentences — 100% coverage, all JLPT levels (N5-N1).
- [x] Chinese example sentences — 100% coverage through HSK1-6.
- [ ] Chinese HSK7 (~577 words, mostly idioms/advanced vocab) + "old-X" legacy
      level tail (~39 words) still missing example sentences — the only
      remaining gap across all six languages.

## Facets / Leitner
- [ ] StrokeOrder doesn't have a `facetsByBox` equivalent — could tie its
      existing "show character / recall from memory" toggle to the box
      instead of manual control, matching the other games.
- [ ] Per-facet accuracy breakdown in Stats (e.g. "weakest at reading-only
      recall") — box already implies which facet was tested, so this is
      mostly a reporting task on existing data.

## Content coverage
- [x] Japanese N4/N5 "thin coverage" — turned out to be a data bug, not a
      real gap. 2,128 of 7,972 words had the wrong JLPT level (mostly N3
      words mistagged N2). Rebuilt every level directly from the elzup
      source CSVs. Corrected distribution: N5: 749, N4: 682, N3: 2,131,
      N2: 1,741, N1: 2,669 (was N5: 532, N4: 7, N3: 401, N2: 3,409, N1: 2,951).
- [ ] `?` help buttons not yet added to Adventure/AdventureChapter, Settings,
      Stats screens.

## Motivation / retention
- [ ] Streak/heatmap using the day-lock mechanism — box selection is already
      day-aware, so "days practiced" data is basically already there.
- [ ] One-time nudge/tooltip pointing returning users at `facetsByBox` (🧩)
      so it doesn't sit undiscovered behind a small icon.

## English vocab list
- [ ] `en-en.json` is a 20-entry stub, not a real list. Considered adopting
      vbvss199's `english.json` directly (20,708 words, real CEFR/POS/example
      sentences) — open design question is what goes in `translation` since
      the word already *is* English (duplicate word / definition / skip).
- [ ] Considered "reverse index" idea (pick a source language, learn English
      via its existing translation glosses) — decided against for now:
      requires 5 new generated files + per-source reverse indexes + new
      "pick source language" UI concept, uneven/unknown match rates per
      language. If revisited, pilot with German only first (most developed
      list) before committing to all five.

## Category system (topic tagging)
- [x] Taxonomy designed: 8 parents with ~25 leaves initially, per-language
      display labels. Lives in `src/engine/categories.js` — see its header
      comment and `README.md` "Category system" section for the design
      rationale.
- [x] Two-level chooser UI (parent row + on-demand leaf drill-down), wired
      into Setup (global filter) and Vocab Browser (local filter).
- [x] German A1 (678 words) — tagged, high precision.
- [x] Japanese N5/N4 (1,415 words) — tagged, high precision.
- [x] Chinese HSK1-3 (1,210 words) — tagged, high precision.
- [x] German A2 (2,057 words) — tagged; first pass leaned too hard on a
      generic fallback bucket (62% landed in "Concepts"), caught via spot
      check and redone by hand — now ~14% Concepts, in line with the others.
      Lesson: always spot-check a random sample before trusting a
      keyword-driven tagging pass, especially at >1000 words.
- [x] Taxonomy restructured (round 1): removed "Time" as its own parent,
      added "Culture" parent (time/politics/music/art leaves), added
      "traffic" leaf under Places.
- [x] German B1 (6,441 words) — tagged via keyword pass against English
      glosses + heavy iterative spot-checking (~10 rounds). Concepts
      fallback down from 62.5% to 54.5%. Found and fixed ~35 polysemy bugs
      (short/boot/field/little/degree/bill/bear/bat/right/player/show/
      button/plant/course/article/nail/jam/taste/branch/law/clip/country/
      head-shower/and/or/while, etc.) — single English keywords collide
      constantly with unrelated senses; multi-word phrase requirements and
      targeted idiom-scrub lists (see `IDIOM_SCRUBS` in `tools/
      tag_categories.py`) fixed most of it. ~54.5% Concepts is treated as
      B1's real ceiling, not a bug — B1 vocab is structurally more abstract
      than A1/A2.
- [x] Leaf rebalance (round 2): merged `numbers`+`quantifiers`→`quantity`
      and `questions`+`connectors`→`function_words`; fixed the orphaned
      `calendar`/`time` duplicate-id issue (A1/A2/N5/N4/HSK1-3 were tagged
      with the old `calendar` id before the round-1 rename — migrated
      370+238+199 entries across the three data files to the merged/renamed
      ids). `tools/tag_categories.py` updated to emit the new ids directly
      (keyword patterns + pos-based fallback both fixed — the fallback was
      missed on the first pass and still emitted old ids).
- [x] Parent rebalance (round 3): moved `health`→Life, `media`→Culture,
      `technology`→Science (all three parents now land at 4-5 leaves each,
      versus Society's original 7). Taxonomy now: **8 parents, 30 leaves**
      — Nature(4), People(4), Life(5), Places(4), Society(4), Culture(5),
      Science(4), Abstract(5).
- [x] Category filter UX: parent row is now single-select (tap active parent
      again to clear — no separate button needed there); leaf row stays
      multi-select with its own "✕" clear chip (added a generic `prefixChip`
      slot to `ChoiceChips` for this rather than duplicating its toggle
      logic). Vocab Browser's filter made independent of the Setup screen's
      global filter (was incorrectly inheriting it via `visibleEntries`;
      now uses `vulgarFilteredEntries` + its own two `<select>` dropdowns,
      matching its existing status/level/POS dropdown style instead of
      chips).
- [ ] Continue category tagging: German B2/C1/C2, Chinese HSK4-7, Spanish,
      French, English (entirely untagged). Reuse `tools/tag_categories.py`
      as a starting point but expect a fresh round of spot-check-driven
      fixes per language/level — polysemy bugs are language- and
      vocab-specific.
- [ ] Check existing categories: A1/A2 (German), N5/N4 (Japanese), HSK1-3
      (Chinese) were tagged before both taxonomy restructures (Culture
      parent, traffic/music/art leaves, calendar→time, the quantity/
      function_words merges, health/media/technology re-parenting) and
      before the polysemy-bug lessons learned during B1. Worth a fresh spot
      check to see if any of that earlier work has the same class of bugs,
      and whether words now belonging in the newer leaves (music/art/
      traffic/quantity/function_words) got missed or mis-bucketed under the
      taxonomy as it existed when they were tagged.
- [ ] Science parent (Physics/Chemistry/Biology/Technology leaves) is still
      light on real content outside Technology — will fill in naturally as
      higher levels (which contain more hard-science vocab) get tagged.

## Options menu
- [x] Checked export/import function — found a real bug: `BACKUP_KEYS` in
      `Settings.jsx` was a hardcoded list that didn't include any of the
      Leitner spaced-repetition keys (`leitnerScores_<game>`/
      `leitnerSession_<game>`, dynamically keyed per game in
      `LEITNER_GAMES`) or `adventureProgress`. Export/import silently
      dropped all Flashcard/PairMatch/StrokeOrder progress, and "Reset all
      scores" didn't actually reset Leitner state at all. Fixed: added
      `leitnerStorageKeys()` export to `engine/leitner.js` as the single
      source of truth, `Settings.jsx` now builds its key list from that
      instead of a hardcoded array — matches the storage-discipline
      principle that was already written down but not followed here.

## Groundskeeping
- [x] Removed dead code found via `eslint`/grep sweep: `PosChips.jsx`
      (unused component, superseded by inline `<select>` dropdowns
      elsewhere) and its only consumer, `posLabel()`/`POS_LABELS` in
      `settings.js`; the `.pos-chip` CSS block in `index.css`; stale
      comment references to both. `storyOutro` and `artifact` in
      `AdventureChapter.jsx` — computed, never read anywhere, removed
      (the `artifact` prop chain through `ChapterHub` too).
- [ ] `AdventureChapter.jsx`'s `setDoneParts` is still unused (only
      `doneParts` is read) — looks like an incomplete feature (some 'vocab'/
      'grammar' single-item phase completion tracking never got wired up),
      not simple dead code, so left alone rather than removed.
- [ ] Pre-existing `react-hooks/purity` and `react-hooks/refs` lint errors
      in `Flashcard.jsx` and `GrammarTrainer.jsx` (`Math.random()` inside
      `useMemo`, a ref read during render) — not touched this pass, out of
      scope for a groundskeeping sweep, but worth a dedicated look since
      they're real (if likely low-impact) violations of React's rules.

## Session hygiene
- [ ] This chat has been running very long (multiple big features across
      many turns) and has started showing reliability issues. Plan: start a
      fresh conversation after each natural milestone (e.g. right after a
      push) rather than continuing indefinitely in one thread. Memory
      carries durable facts/preferences across chats; this TODO + the repo
      itself is the source of truth a new chat should read first.

- [ ] Main repo (`vocab-games`) `dev` branch is stale (~v0.46, pre-dates all
      the lost-session recovery work) — decide whether to retire it or
      fast-forward it from the current `main`/recovered line.
- [ ] Document the `vendor/language-decks/` + `tools/extract-examples.js`
      pattern as "the process" for future language/example data work
      (currently only documented in `vendor/language-decks/README.md`).
