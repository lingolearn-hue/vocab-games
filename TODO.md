# TODO / Future Improvements

## Repo state (as of this writing — check git log for current truth)
- `vocab-games` (production, `main` branch): **v0.68** — full resync
  from `vocab-games-dev` at dev v0.66bc. Carries: Japanese Grammar
  Dictionary dynamic quiz expansion, Daily Challenge feature (new,
  never shipped to prod before this push — see its own gap note below),
  Listening game reverse-English TTS fix, Graded Reader France + Japan
  fairy-tale trios (12 new passages total, all 6 languages), vocab
  quality pass (752 translation-formatting fixes, ß/ss dedup, CEFR
  A1/A2 coverage, niebla/neblinoso fix), and various UI refinements.
  Below this line, references to "vocab-games-dev" / dev version
  numbers describe the state at the time each entry was written on the
  dev side — kept as historical log, not re-labeled per resync.
- **Known gap shipping to prod for the first time with this resync**:
  Daily Challenge has no schema-version guard on its localStorage —
  if this ever matters on prod (unlikely on a first ship, no prior
  prod data in that shape to collide with), old-shaped state would
  silently render a blank task instead of regenerating. Low risk here
  specifically because prod never had a pre-refactor version of this
  feature, but noting it since the gap itself is still unfixed upstream.
- **v0.66bc**: Vocab — fixed one imprecise synonym-gap fix from the prior
  pass: `niebla` (ES, fog/noun) had "foggy" wrongly added as an
  adjective-sense synonym; removed, and a proper `neblinoso` (adj)
  entry created instead. Graded Reader — two new `origin:japan`
  fairy-tale trios: Momotarō, Urashima Tarō, The Grateful Crane, at A2
  (`ft13`–`ft15`) and B2 (`ft16`–`ft18`), all 6 languages, full kanji
  in Japanese. Content fidelity checked against multiple web sources
  before translation (see `AUTHORING-TEXTS.md` for a genuine fork found
  in Grateful Crane's source material — the same tale title covers two
  substantially different tellings). The A2 English draft was audited
  for sentence length and connector vocabulary *before* translation
  this time, a direct process improvement from the France B1
  miscalibration. Japanese B2 translation needed a real multi-paragraph
  fix after first pass — long colon/em-dash-joined English sentences
  had been split into multiple Japanese sentences during translation
  across all three stories; corrected against actual
  `tools/check_reader_congruence.py` output paragraph-by-paragraph, not
  by assumption. Full details in `AUTHORING-TEXTS.md` and
  `REVIEW-TEXTS.md`.
- **v0.66bb**: Graded Reader — new `origin:france` (Perrault) fairy-tale
  trio: Bluebeard, Puss in Boots, Tom Thumb, at both A1 and B1
  (`ft7`–`ft12`), written English-first and translated sentence-by-
  sentence into DE/ES/FR/JA/ZH, verified via
  `tools/check_reader_congruence.py`. Japanese uses full kanji at both
  levels — a deliberate deviation from the existing `ft1`–`ft6`
  (German-origin) kana-only convention; a toggleable furigana reading
  aid was requested but does not exist as an engine feature yet, flagged
  as a follow-up for the engine/UI thread. Full methodology, the B1
  English draft's overshoot-to-B2 correction (sentence-length and
  CEFR-J vocabulary re-verification), and the known congruence-checker
  artifact classes (Latin quote-before-period on the English side,
  JA/ZH closing-quote merge-chaining on back-to-back quoted
  exclamations) are documented in `AUTHORING-TEXTS.md` and
  `REVIEW-TEXTS.md`.
- **v0.66ba**: vocab quality pass from a parallel session — ß/ss dedup,
  CEFR A1/A2 coverage fixes for DE/JA/ES/FR, 752 translation-formatting
  bugs fixed (paren-split import artifact) across DE/ES/FR/JA. Full
  methodology and per-language status in `REVIEW-VOCAB.md`. Note: that
  session's commit message called itself v0.66ba but never actually
  bumped `public/version.json` (still read 0.66az) — corrected here as
  part of this push.
- **v0.66az**: Daily Challenge — replaced the horizontal tab-label legend
  with a single vertical rail (icon-only for inactive tabs, active tab's
  button also shows its label so the sub-menu title only appears for the
  open section). Listening game — fixed a real bug: when learning English
  (which reverse-builds its list from another language, e.g. German),
  the translation-step utterance was hardcoded to the 'en' voice even
  though `entry.translation` holds the *source*-language word in that mode,
  so it was mispronouncing German/French/etc. words with an English voice.
  Now uses `reverseSourceLanguage` from context when active. Verified live
  via Playwright with a patched speechSynthesis capturing utterance
  text+lang: reverse-English case now correctly speaks the source word
  with the source-language voice (e.g. "prüfen" / de-DE); normal direction
  (e.g. learning German) unaffected, translation step still en-US.
- `vocab-games` (production, `main` branch): **v0.66** — several commits
  behind dev (not yet synced forward). Next production push should carry
  all of this session's work forward.
- Both repos' `dev`/`master` branches (stale, pre-dating a lot of this work)
  were deleted — see "Groundskeeping" below. Production now only has `main`
  and `gh-pages`. `vocab-games-dev` also had a stale, unrelated `source`
  branch (last touched at v0.63ac) — also deleted; `main` was always the
  real working branch there.
- Version tracking moved to a single source of truth: `public/version.json`
  (`{version, date, repo}`). The footer in `Setup.jsx` now fetches it at
  runtime instead of a hardcoded string; `README.md`'s `Version: X.X —
  YYYY-MM-DD` line is kept in sync with it manually for now.
- **Pending, not yet applied**: a merge of the `zh-g-023`/`zh-g-026`
  duplicate ("既然…就") was found sitting uncommitted in the working tree
  with no record of being intentionally authored — reverted out of this
  push rather than shipped unreviewed. Saved at `/tmp/zh-en-pending.diff`
  in the working container for review; apply with `git apply` if it turns
  out to be wanted, otherwise redo the merge decision from scratch.

## Japanese Grammar Dictionary: dynamic quiz expansion + Daily Challenge feature (v0.66ax)
- [x] Japanese Grammar Dictionary: 14 new quiz generators covering 15 static
      patterns (は/が/を/も, なければならない-family particles, ように/ために,
      としては/にしては, に/で, and others). Renamed
      `generateGermanPrepositionQuestion` → `generateClosedSetQuestion` in
      `grammarQuiz.js` (confirmed language-agnostic, all German call sites
      updated) and added a new generic `generateFixedAnswerQuestion` helper
      for single-fixed-answer patterns tested across varied example
      sentences. `quizType` wired into `ja-en.json` for all 15 patterns.
      Caught and fixed a few real grammar/naturalness bugs in example
      sentences during curation (blank placement, awkward word choice).
      See `grammar-dictionary-logic.md` for full generator documentation.
- [x] New feature: **Daily Challenge** ("Thiede function") — a real-world,
      phone-free daily micro-exercise, deliberately separate from the
      in-app games. No correctness checking, no time limit; entirely
      user-attested. New 🎯 button in the top nav row next to Adventure.
      - `src/engine/dailyChallenge.js`: weekday → fixed "core idea" mapping
        (Monday=naming, Tuesday=colour/category constraint, Wednesday=
        narrating actions, Thursday="previously in my workday" recap,
        Friday=signs/notices, Saturday=post-it labeling, Sunday=describe
        your day), each with several rotating "flavor" variants.
        localStorage-backed state per language: today's pick (date-scoped),
        open/accepted challenges, cumulative completion counts, favorites.
      - `src/components/DailyChallenge.jsx` + `.css`: overlay with a
        4-item left rail (Task of the day / Open challenges / Browse all
        grid / Favorite tasks), accept + mark-done flow, star favoriting
        with gold-border treatment in the grid, "change task"/"change
        flavor" controls (flavor change has a glowing-orb animation).
      - `src/engine/dailyChallengeExamples.js`: two example sentences per
        flavor, per language (all 6 languages, 29 flavors — 348 sentences
        total), shown inline under the flavor text and in the open-
        challenges list.
      - Full design discussion captured in
        `daily-challenge-function-design.md` (see chat history / outputs).
      - Verified via Playwright in a real browser: today's task (weekday-
        correct), accept/finish/cancel flow, grid browser, favoriting,
        flavor-change animation, mark-done counter, examples rendering
        correctly for German and Japanese. No console errors.

## Graded Reader: small polish (v0.66aw)
- [x] Passage cards in the library list shortened (padding/gap trimmed).
- [x] Read-aloud now speaks the story title first, before the sentence-
      by-sentence narration.
- [x] Story-type filter chips (Fiction/Non-fiction/Fairy tale) changed
      from multi- to single-select — tapping the active one clears it
      (unlike the level chooser, "no type filter" is a meaningful state
      here). Persisted prefs shape changed from `tags: []` to `tag: null`.

## Graded Reader: filters, layout, and reading-flow polish (v0.66av)
- [x] Level filter: single-select (was multi), persistent per-language,
      defaults to the lowest available level rather than "all."
- [x] "Hide finished" toggle (👁/🙈) in the header, persistent per-language.
- [x] Tag filter row cut down to a fixed 3: Fiction / Non-fiction / Fairy
      tale (was: every tag in the data, including a long unpredictable
      topic: tail) — persistent per-language. "Clear filters" moved to a
      compact button to the left of the tag row instead of a separate
      block below it.
- [x] Continue-reading button (reveal-as-you-go) now actually scrolls to
      the newly-revealed paragraph. If the user scrolls back up to reread
      something, it relabels to "↓ Back to last paragraph" and just
      scrolls them back rather than confusingly revealing new content
      off-screen.
- [x] Layout pass: progress-summary pill moved beside the Continue-reading
      banner (same pill shape, both ~10% shorter); level chips ~10%
      shorter (scoped to the reader only, not a global change); vertical
      spacing trimmed generally — addresses "50% of the screen lost
      before the text even starts."

## Grammar Dictionary: B1 coverage + UX fixes (v0.66av)
- [x] Accordion behavior: only one pattern's content open at a time —
      opening another collapses whichever was open (was: several cards
      could be expanded simultaneously, cluttering the screen).
- [x] Fixed a real ambiguity bug: "sie" (she/they) and "Sie" (formal) all
      render as identical text once composed into a sentence and
      capitalized at the start — worse, sie_sg/sie_pl take *different*
      conjugated forms. Generators building a full sentence around one of
      these three now exclude the other reading's correct form from the
      distractor pool, so only one plausible answer is ever on screen.
- [x] Accusative/dative article quizzes now use real carrier sentences
      ("Ich sehe ___ Hund.", "Ich helfe ___ Frau.") instead of a bare
      word — case only means something in context of what requires it.
      Nominative stays a bare word deliberately (citation form).
- [x] Level filter defaults to A1 on first open (or the lowest available
      level, e.g. HSK1) and persists per-language, matching the same
      pattern already built for the Graded Reader.
- [x] Fixed a real UX bug in `TileOrderExercise` (shared by Grammar
      Trainer's static patterns and both dynamic tile-order quiz
      families): the tile bank removed placed tiles from the list,
      causing the remaining tiles to reflow/jump on every tap. Bank now
      stays at fixed positions — placed tiles grey out and become
      unclickable instead of disappearing.
- [x] New B1 content: Perfekt (participle formation + sein-vs-haben
      auxiliary choice, reusing the same 7 curated regular stems as the
      conjugation quiz), subordinate clause word order (verb-final,
      dual-mode MC + tile-order), causal conjunctions weil-vs-denn.
      `de-g-007` ("V2 with place") pointed at the existing V2 generator —
      same rule, different lead word, no new logic needed.
- [x] `grammar-dictionary-logic.md` updated throughout.
- **Discussed, not yet built**: B2/C1 German content (~11 patterns) — a
  leveled proposal was given (verb-final tile-order, Perfekt/passive
  sentence-blank, and a generalized closed-set-in-sentence shape cover
  most of it); other languages (ES/JA/ZH/EN) have zero dynamic quiz
  coverage and would need a similar-sized project of their own.



## Graded Reader UI fixes (v0.66au)
- [x] Fixed the "Vocab Quiz" button landing on top of the text for short
      passages — was `position: absolute` against the content column
      (whose height is just "however long the passage is"), so short
      passages didn't have room for `bottom: 1.2rem` to clear the text.
      Moved it (and added a new "🔗 Matching game" button alongside it,
      reusing the same `sessionEntries` scoping PairMatch already
      supports) into the header row as compact icon buttons instead of a
      floating FAB.
- [x] Reveal-as-you-go: passages open showing only the first paragraph,
      with a "Continue reading ↓" button to reveal one more at a time —
      addresses passages reading as an intimidating wall of text on open.
      Still one continuous scroll (deliberately not building real
      pagination — see reasoning below); a thin progress bar + "Paragraph
      N of M" sits above the text for multi-paragraph passages. Read-aloud
      reveals everything immediately (it can land on any sentence);
      "Continue reading" (resume-last-passage) restores reveal progress
      alongside scroll position.
- [x] Fixed a real duplicate-content bug: single-entry "series" (most
      fairy tales currently — one passage per tale) were rendering a
      "📚 Title · 1 level" header directly above a card repeating the same
      title. Now folded into the plain standalone list; genuine multi-
      level series (Mein Freund, Meine Katze, Der Markt, Windsurfen) keep
      the grouped header.
- [x] Found and fixed: `.gr-series`/`.gr-series-header`/`.gr-series-cards`
      had zero CSS rules anywhere — rendering as unstyled default divs
      with no visual grouping at all. Added proper spacing/typography.
- [x] Read-aloud pacing: added a 500ms pause between sentences (previously
      back-to-back with zero gap). Added Screen Wake Lock during playback
      so the screen doesn't dim/lock during hands-free listening
      (best-effort — silently no-ops on unsupported browsers).
- [x] Unified the Flashcard icon on 📇 everywhere (main menu, Adventure
      chapter game picker) — was 🃏 (joker/playing card), which didn't
      mean anything; 📇 (card index) was already established for the same
      concept inside Graded Reader's vocab-quiz button.
- **Discussed, deliberately not built**: real page-based pagination
  (scroll-vs-pages) and a horizontal level-carousel for series. Scroll
  stays the reading model — pagination would need dynamic page-height
  measurement and would make every position-aware feature (read-aloud
  auto-scroll, tap-to-translate, last-read-spot) page-aware for little
  real benefit on a phone. The series carousel idea was dropped as
  over-engineering: a learner filtered to their own level only ever sees
  one card per series anyway, so cross-level browsing barely comes up.

## Grammar Dictionary: A1–A2 German practice coverage (v0.66au)
- [x] können/müssen: full-sentence prompts ("Ich ___ Klavier spielen."),
      reusing the curated verb/object pairs from the V2 generator for the
      infinitive half of the sentence. Added conjugation tables matching
      the sein/haben treatment.
- [x] Accusative/dative prepositions: one hand-curated, correctly-cased
      example sentence per preposition rather than one shared template
      crossed against all of them — distractors drawn from the same
      case-family so the exercise tests knowing which preposition fits,
      not just noticing the noun phrase's case.
- [x] Modal word order (dual-mode MC + tile-order on "Modal verb sentence
      structure"): same shape as V2 word order, with the infinitive fixed
      at the very end after the modal.
- [x] "Inversion after adverb" pointed at the existing V2 generators
      instead of duplicating logic — it tests the identical rule. Flagged
      as a content-level duplicate alongside the other duplicate-pattern
      flags (see grammar-dictionary-logic.md).
- [x] `de-g-014`'s explanation expanded (was one terse sentence); `de-g-010`
      through `de-g-013` already solid from the earlier German audit.
- [x] `grammar-dictionary-logic.md` updated throughout with the new
      question shapes, all new generators, the TileOrderExercise
      extraction, and a refreshed gaps list.

## Grammar Dictionary: verb conjugation + V2 word order (v0.66at)
- [x] sein/haben/regular-verb conjugation quizzes: 9-pronoun prompts (with
      sie/Sie forms disambiguated in the label), 3 options drawn from the
      verb's own real forms. 10 hand-picked fully-regular stems for the
      regular-verb quiz (no vowel change, no -e- spelling insertion).
      Added conjugation tables to the explanation area for all three.
- [x] Verb-second (V2) word order, dual-mode: "🎯 Multiple choice" and
      "🔀 Arrange the words" buttons, both derived from the same curated
      compositional sentence builder (5 subjects × 7 curated verb/object
      pairs × 3 adverbs) so MC distractors and the tile-order answer can
      never drift out of sync.
- [x] Extracted the tap-to-place tile-order interaction out of Grammar
      Trainer into a shared `components/TileOrderExercise.jsx`, so both
      the static pattern pool and the new dynamic quiz use the same
      component (scoring/advancement left to the caller via callbacks).
- [x] Article quiz options now always ordered m/f/n (never shuffled);
      genders sharing a surface form (nominative/dative indefinite "ein"/
      "dem") get disambiguated labels ("Ein (m)" / "Ein (n)").
- [x] Practice sessions: correct answers auto-advance after a brief flash;
      wrong picks turn that option red and stay on the same question for
      retry (other options remain pickable) instead of a dead-end.

## Grammar Dictionary practice overhaul (v0.66at)
- [x] Fixed two real article-quiz bugs: nominative indefinite offered an
      invalid `einen` distractor, dative definite offered an invalid `den`
      distractor. Nominative indefinite now correctly offers only
      `ein`/`eine` (masc/neut share `ein`).
- [x] Removed the category filter chip row from Grammar Dictionary (was
      illegible) — `category` stays in the data, just unused in this UI.
- [x] Level filter changed from multi-select to single-select. Added a
      `single` prop to `ChoiceChips`/`LevelChooser` (default off, so other
      screens using multi-select are unaffected).
- [x] Quiz vocab pool is now level-scoped: an A1 pattern draws from A1
      vocab first, only falling back to the full pool if the scoped pool
      has fewer than 4 eligible entries. `generateQuestion()` and
      `QuizOverlay` now take a `level` param.
- [x] `de-g-001` explanation rewritten to introduce German's three-gender
      system before the specific article forms — the intended model for
      "explanation should be sufficient to understand the topic on its
      own" going forward. Added a new `examples` field (clean sentence
      pairs) rendered in place of the raw bracket `template` string when
      present; other article patterns still fall back to the raw template.
- [x] Practice sessions are now endless — no round cap. Runs until the
      user stops it (✕ or "Stop"), with a running `Round N · X correct`
      tally and a `correct / roundsPlayed` summary on stop.
- [x] Correct answers auto-advance to the next question after a brief
      flash — no button tap needed.
- [x] Wrong picks turn that option red and stay on the same question —
      other options remain pickable, so the user retries until correct
      rather than being shown a static "wrong" dead end.
- [x] `grammar-dictionary-logic.md` drafted, covering data schema, the two
      parallel exercise systems (Grammar Trainer vs. Grammar Dictionary's
      dynamic quiz), quiz generation/level-scoping, and design principles
      (explanation completeness, endless practice). Shared with V as a
      draft for discussion — see file for open items (only German articles
      have generators so far; `examples` only added to one pattern).

## Vocab Browser word-detail overlay
- [x] Tapping a word row now opens a full detail overlay — translations,
      POS/level, example sentence, and an editable mnemonic — matching
      Flashcard's detail panel. Built as a new shared component,
      `components/WordDetail.jsx` (+ `WordDetail.css`, own `wd-*` class
      names), rather than literally reusing Flashcard's — Flashcard's
      panel also drives its review flow (pendingAdvance, isRevealed,
      Known/Unknown/Master actions) which don't apply in a browse context,
      so forcing them into one shared component would've made both worse.
      Kept visually/functionally identical for the shared parts instead.
      Replaced the old row-level 💡 mnemonic-only inline expand (which only
      showed the raw mnemonic text, no edit capability) — the mnemonic
      indicator is still shown on the row, now just a static hint that
      tapping the row opens the full detail. Verified in real-browser
      Playwright: opens correctly, add/edit/save mnemonic flow persists
      and shows correctly on reopen, and the row's own click-to-open
      doesn't interfere with the independent Reset button (already had
      `stopPropagation()`).

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
      out always, everywhere — this was a Settings toggle at one point,
      removed since the product decision is just to hide this content).
      Identity-based slurs (`marica` es, `玻璃` zh) removed outright.
      Mistagged gloss fixed (`だらしない` ja had a stray "a slut" sense in
      its translation).
- [x] German example sentences — 100% coverage, all levels.
- [x] Japanese example sentences — 100% coverage, all JLPT levels (N5-N1) —
      but this broke silently after the Japanese POS-tagging pass above and
      had to be fixed again: sentences were extracted before Japanese vocab
      had real `pos` values, so every stored key was `<lemma>::unknown`.
      Once real pos values landed, `getExampleSentence()`'s lookup key
      changed to `<lemma>::<realpos>` and stopped matching anything — every
      single Japanese sentence lookup silently returned `null`, no error
      anywhere. Fixed by trying the real-pos key first, falling back to
      `::unknown` (see `engine/examples.js`). German/Chinese don't have this
      problem (already keyed with real pos when generated). Worth
      remembering for any future language where POS tags get added/changed
      *after* example sentences already exist.
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

## Graded Reader — further ideas
- [x] Auto-scroll during read-aloud, so the active sentence stays in view
      on long passages — makes read-aloud usable hands-free, not just as an
      on-screen follow-along. Implemented via a `sentenceRefs` array +
      `scrollIntoView({behavior:'smooth', block:'center'})` on
      `readingIndex` change. Verified in real-browser Playwright: scrollTop
      advanced 0→956px tracking playback on a long passage.
- [x] Reading progress on the passage list ("✓ N of M finished") using the
      "Finished" tracking already built — sits above the filters. Not a
      day-to-day streak (that'd need date-based tracking, not attempted),
      just a completion count against the full per-language library.
- [x] "Continue where you left off" — a banner above the filters resumes
      the last-opened library passage (title + scroll position), backed by
      a `vocabLastPassage` localStorage key updated on open and on scroll.
      Verified: banner correctly absent until a passage has been opened,
      shows the right title, and restores scroll position exactly on
      resume (confirmed via direct scrollTop injection — the restore
      mechanism itself is exact; an initial test showing a ~50px gap
      turned out to be a race in the test script's manual scroll timing,
      not an app bug).
- [ ] Difficulty auto-suggestion — recommend a "next passage" based on
      Leitner mastery of the current one's vocab, so leveling up through
      the library feels guided rather than pure browsing.
- [ ] Inline example-sentence reinforcement in the word-tap popup — if a
      tapped word also has a curated example sentence elsewhere in the
      vocab data, show it alongside the translation. Data mostly already
      exists per-language; just needs wiring into the popup.
- [x] Sentence-level translation on tap (not just the full-passage EN
      toggle) — went with naive index-pairing (split source and English
      text into sentences, zip by position) since no per-sentence
      translation data exists, just one flat `translation` string per
      passage. Scanned all passages first to check the real risk: sentence
      counts mismatch 2/36 (German), 1/36 (Spanish), 4/39 (Chinese), 0/36
      (English) — but 9/36 (25%!) for Japanese. Guarded per-passage: tap-
      to-translate only activates when both sides split into the same
      sentence count; otherwise silently unavailable for that passage
      (full-passage EN toggle still works regardless, since it doesn't
      depend on alignment). Verified both branches in real-browser
      Playwright: a matched Japanese passage correctly shows the sentence
      translation on tap, a mismatched one correctly shows zero tappable
      sentences.
- [ ] Real cover art instead of the placeholder — needs an image pipeline
      (generation or curation), nontrivial scope, not started.
- [ ] User-authored passages beyond one-off paste — a lightweight passage
      editor to write/save entries to a personal reading list.
- [ ] Comprehension check after finishing a passage (a couple of quick
      recall questions) — closes the loop between "read" and "actually
      understood," similar to Adventure's content-phase pattern.

## Graded Reader UI overhaul
- [x] Filter chips (Level / Type / Topic) didn't visually align — root cause
      was two-fold: `.gr-filters` referenced `--border`/`--surface`/
      `--text-secondary`, none of which were defined anywhere in the
      codebase, so the panel silently had no border or background; and the
      separate Type/Topic chip rows had a label column pushing them right of
      the Level row. Fixed: removed the undefined vars (concrete colors +
      existing dark-theme overrides instead), and collapsed Type+Topic into
      one flat, unlabeled tag row — all three rows (Level/Search/Tags) now
      share the same 1rem padding and align (verified in real-browser
      Playwright: all three measured at the same x-position and width).
- [x] Replaced the two labeled chip rows with a single free-form search box
      that also matches against tag labels ("auto-tag detection") — typing
      e.g. "psychology" now surfaces topic-tagged passages without a
      dedicated chip for every topic. Chip row kept alongside for
      quick-tap filtering; search and chips combine.
- [x] Also fixed while in the file: the Paste tab's "Read →" button had
      `#555` text on a `#4f7ef8` background — nearly invisible. Now white.
- [x] Added a "Vocab Quiz" floating button, bottom-right of the reading
      screen, showing the passage's vocab count. Tapping it resolves the
      passage's matched vocab to full entries and launches a Flashcard
      session scoped to just those words via `setSessionEntries` — same
      mechanism Adventure's vocab-lesson phase already used.
- [x] Added a small square placeholder (dashed border, 🖼️ icon) top-left of
      the reading view, reserving a spot for future passage artwork —
      purely decorative for now, no image-loading system behind it yet.

## Lemmatizer (German + Japanese)
- [x] Previously blocked: spaCy's German model (`de_core_news_sm`) couldn't
      be downloaded due to network allowlist restrictions. Now works — the
      allowlist added `release-assets.githubusercontent.com`, which is
      exactly what spaCy model wheels are hosted on. Installed via
      `pip install --break-system-packages "https://github.com/explosion/
      spacy-models/releases/download/de_core_news_sm-3.8.0/de_core_news_sm-
      3.8.0-py3-none-any.whl"` (spaCy's own `download` command doesn't pass
      `--break-system-packages` through, so the direct wheel URL is needed
      in this environment). Fugashi (Japanese) installed fine as before —
      it was never the blocked one.
- [x] Discovered `public/campaign/lemmatize.py` already existed — a
      complete, well-built module (de/fr/es via spaCy, ja via fugashi, zh
      via jieba) already wired into `convert.py --lemmatize`, just never
      runnable before. Ran it for real: `python3 convert.py --all
      --lemmatize` regenerated genuine `surfaceForms` for all 6 German
      Adventure campaign chapters (40–150 pairs per section, e.g.
      `isst→essen`, `Menschen→Mensch`).
- [x] Built `tools/generate_reader_surface_forms.py` to extend the same
      lemmatization to the Graded Reader (which never used surface-form
      matching at all, for any language, before this). Reuses
      `campaign/lemmatize.py`. Generated 628 German + 670 Japanese surface
      forms from actual reader-passage text, cross-checked against real
      vocab entries. Output: `public/reader/surface-forms.json`.
- [x] Wired it into `GradedReader.jsx` via a new `loadSurfaceForms()` in
      `engine/reader.js` — inflected words in reading passages (e.g. "aßen"
      → essen, "habe" → haben) now resolve to their dictionary-form vocab
      entry, both in the highlighted text and in the Vocab Quiz word count.
- [x] **Found and fixed a real, previously-silent bug while wiring this
      up**: `TextWithLookup.jsx`'s own internal `augmentedLookup` (used by
      Adventure Mode) treated `buildLookup()`'s return value as a plain
      object (`base[surface]`, `{...base}`) when it's actually a `Map`.
      This silently produced a broken lookup whenever `surfaceForms` was
      non-empty — but it was never triggered before, since every campaign
      chapter's `surfaceForms` was empty (lemmatization was blocked). The
      moment real German surface-form data got generated above, Adventure
      Mode would have crashed on the next chapter read (`t.has is not a
      function`) — caught via real-browser Playwright testing, not code
      review, exactly the kind of bug that review alone misses. Fixed both
      `TextWithLookup.jsx` and `GradedReader.jsx`'s own copy of the same
      merge logic to build a proper `Map`. Verified working end-to-end in
      both Graded Reader and Adventure Mode after the fix (e.g. tapping
      "Lieber" in an Adventure letter correctly resolves to lemma "lieb").
- [ ] Quality notes, honestly: German lemmatization has real gaps on
      irregular verbs (e.g. "aßen" from *essen* wasn't reduced and got
      mistagged NOUN) and some noun plurals. Japanese fugashi output is
      mostly clean but has residual tokenization ambiguity on kana-only
      (no-kanji) beginner text — e.g. "がくせい" (student) can get
      mis-split into "がく"+"せい", coincidentally matching unrelated
      one-kanji vocab entries. Filtered out all single-kana matches (18
      dropped) as the worst/most obvious case; longer mis-splits aren't
      caught. Not a blocker, but don't assume 100% precision.
- [ ] French/Spanish spaCy models untested — same install approach should
      work (`fr_core_news_sm`, `es_core_news_sm` via the same GitHub
      release-wheel pattern) but not verified in this session. Chinese
      lemmatization is really just jieba word segmentation (Chinese
      doesn't inflect) — also untested here, though the module supports it.

- [x] Added read-aloud audio — a 🔊/⏸ button in the reading header speaks
      the passage sentence-by-sentence via `speakAndWait()` (not as one
      long utterance, so play/pause has a clean sentence boundary and the
      UI can show progress). Each sentence highlights while spoken (soft
      background wash, doesn't fight the SRS-status text colors). Respects
      the existing per-language voice picker and the Listening game's
      speed setting (`settings.listeningSpeechRate`) for consistency.
      Correctly stops (calls `speechSynthesis.cancel()`) when navigating
      away mid-playback or switching passages — verified via a mocked-TTS
      Playwright test, since headless Chromium has zero real voices
      installed so genuine playback timing can't be tested directly (same
      known limitation already logged for the Listening game).
- [x] Added `splitSentences()` to `engine/reader.js` for this — Latin
      punctuation (.!?) for most languages, full-width (。！？) for CJK.

- [x] Fixed passage cards having differing horizontal widths in the
      library list — `.gr-passage-card` is a `<button>` with `display:
      flex` but no explicit `width`. Form controls don't follow normal
      block-box "fill available width" behavior the way a `<div>` does;
      they shrink-to-fit their content by default, so cards with longer
      or shorter titles ended up at different widths (measured 247px to
      352px before the fix). Added `width: 100%; box-sizing: border-box`.
      Verified in real-browser Playwright: all cards now measure exactly
      the same width.

## Graded Reader story content
- [x] Pulled in from a delegated session (commit 39cc495): a new Little
      Red Riding Hood fairy tale in all 6 languages — first entry in a new
      fairy-tale genre, A1 level. New `AUTHORING-TEXTS.md` (writing/
      translation rules, level-appropriateness guidance — e.g. A1 fairy
      tales have to be deliberately restrained to present-tense/one-clause
      sentences since fairy-tale register naturally wants to be B1+) and
      `REVIEW-TEXTS.md` (content survey + sentence-congruence realignment
      log for the original 36 passages). New `tools/check_reader_
      congruence.py` — handles French closing-guillemet and Japanese/
      Chinese closing-quote false-positive splits structurally, which the
      simpler `splitSentences()` in `engine/reader.js` (used by the read-
      aloud/sentence-tap-translate features I built) doesn't. Ran it:
      only 7 mismatches remain across all 40×6 passages, down from what
      I'd measured before this pull (worst case was Japanese at 25%).
- [x] **Notable find while checking this**: `public/reader/fr-en.json`
      didn't exist at all before this commit — the French Graded Reader
      had zero passages this entire session. Never caught it because all
      my earlier reader testing (read-aloud, sentence-translate, the
      lemmatizer wiring) happened to use German/Japanese test cases.
      Now fixed — French has all 40 passages same as the other languages.
- [x] Regenerated `public/reader/surface-forms.json` (628→696 German,
      670→767 Japanese) since the new fairy tale had zero lemma coverage
      and the realigned existing passages needed re-checking too.
- [x] Verified in real-browser Playwright: French Reader now shows 40
      passage cards (was crashing/empty before — well, not crashing, just
      genuinely empty since the file didn't exist), "Le Petit Chaperon
      Rouge" is present and searchable; German's "Rotkäppchen" opens
      correctly with all built-that-session features working against the
      new content — read-aloud button present, 41 sentences with tap-to-
      translate available, Vocab Quiz correctly counting 62 words.
- [x] Pulled a further batch (commits 03f7d2b, a31faa3, b3bdacd): 5 more
      fairy tales — Bremen Town Musicians, Hansel and Gretel (A1), Snow
      White, Cinderella, Rumpelstiltskin (A2) — 45 passages per language
      now, up from 40. `REVIEW.md` renamed to `REVIEW-VOCAB.md` to
      disambiguate from `REVIEW-TEXTS.md`. `AUTHORING-TEXTS.md` gained a
      level-pairing strategy (A1+B1 and A2+B2 trios per tale set, capped
      at B2 — no C1/C2 fairy tales, since "retelling a children's story"
      stops being the right register by then) and a country-diversity
      plan (Germany first, five more countries queued). Verified the
      Hansel-and-Gretel plot-fix mentioned in the commit messages (gold
      found before leaving, not after) actually landed correctly in the
      text. Congruence check: 13 mismatches now (up from 7) — all minor
      per-paragraph differences in the new stories; sentence-tap-
      translate safely auto-disables for those specific story/language
      combos rather than mismatching, per the guard already built.
      Regenerated `surface-forms.json` again (696→800 German, 767→871
      Japanese). Verified in real-browser Playwright: all 5 new tales
      present/searchable, paragraph breaks render correctly, Vocab Quiz
      and read-aloud both work against the new content.
- [ ] Noticed, not fixed (their doc, not mine): `AUTHORING-TEXTS.md`'s
      status section still says Snow White/Cinderella/Rumpelstiltskin are
      "not yet written" — stale, since a later commit in the same batch
      did write them. Worth a heads-up next time that thread picks back up.

- [x] Fixed paragraph breaks not rendering — a real regression from the
      read-aloud/sentence-tap-translate work: `splitSentences()` was being
      called on the whole passage text at once, which silently discarded
      the `\n\n` paragraph breaks in the source data (fully confirmed on
      the new fairy tale: 6 real story-beat paragraphs were collapsing
      into one continuous wall of text). Fixed by splitting into
      paragraphs first, then sentences within each paragraph —
      `paragraphGroups` for rendering (wrapped in `<p className="gr-
      paragraph">`), while `sentences` stays a flat array so read-aloud/
      scroll-to/translation-pairing (all index by flat position) didn't
      need to change. Applied the same paragraph-first split to the
      English translation side too, so sentence-tap-translate pairing
      stays aligned by paragraph order, not just overall count. Verified
      in real-browser Playwright: 6 paragraphs render correctly (matching
      the source), all 41 sentences preserved, read-aloud auto-scroll
      correctly crosses paragraph boundaries, sentence-tap-translate still
      fully functional.

## Content coverage
- [x] Japanese N4/N5 "thin coverage" — turned out to be a data bug, not a
      real gap. 2,128 of 7,972 words had the wrong JLPT level (mostly N3
      words mistagged N2). Rebuilt every level directly from the elzup
      source CSVs. Corrected distribution: N5: 749, N4: 682, N3: 2,131,
      N2: 1,741, N1: 2,669 (was N5: 532, N4: 7, N3: 401, N2: 3,409, N1: 2,951).
- [x] Added `?` help buttons to Adventure, AdventureChapter, Settings, and
      Stats — the four screens that had none. Also audited every existing
      help button for accuracy against current features (several games have
      gained controls since their help text was written) and fixed the
      stale ones: Graded Reader's library-view help was completely outdated
      (didn't mention search/tags/finished-tracking/Vocab Quiz/continue-
      reading); Listening was missing the Speed slider; VocabBrowser didn't
      mention its status/level/POS/topic filters or Trans/Scores toggles at
      all; Flashcard was missing the 🔊 Auto toggle; PairMatch was missing
      the "Same word type" toggle. RaceCar, GapFill, GrammarTrainer,
      MatchingDrills, StrokeOrder, Typing, Dialogue, and GrammarDictionary
      were all still accurate, left as-is. Verified all 4 new + 5 updated
      help buttons open correctly in real-browser Playwright, not just
      code review.

## Grammar Trainer (German focus)
- [x] **Reverted** the mass-generated static content from this session's
      first pass (100 article patterns, 36 word-order patterns, 8
      conjugation patterns — 144 total, back to 36) — the actual ask was
      a dynamic per-topic quiz, not more static JSON rows. Kept the two
      real bug fixes to `FillBlank`'s distractor resolution and the 3
      redesigned templates (`de-g-003`/`004`/`013`) since those repaired
      patterns that were actively showing broken placeholder text, not
      "additions" in the sense being reverted.
- [x] Built a **dynamic grammar mini-quiz** system instead —
      `engine/grammarQuiz.js` (a registry of question generators, keyed by
      `quizType`) + `components/QuizOverlay.jsx` (a shared, reusable 5-
      round multiple-choice overlay with its own summary screen). Distinct
      from the static pattern system: no stored content, no data file to
      bloat or corrupt, effectively infinite variety since each question
      draws a fresh random noun from the vocab list every time. Designed
      generically per your call — `QUIZ_GENERATORS` is a plain registry,
      so adding a new deterministic grammar point (plural forms,
      adjective-ending agreement...) later is just adding one more entry,
      no restructuring needed. Only fully vocab-deterministic points are
      good fits for this — word order/subjunktiv-type points still belong
      in the static, hand-authored system.
- [x] Wired a "🎯 Practise this" / "🎯 Quick practice" trigger into both
      screens per your call ("both"): `GrammarDictionary` (inside the
      expanded pattern card) and `GrammarTrainer` (next to the
      explanation, while doing the static exercises). A pattern only
      shows the trigger if it has a `quizType` field — 5 German article
      patterns tagged for now (`de-g-001/002/008/009/018`, covering
      nominative/accusative/dative × definite/indefinite).
      Verified in real-browser Playwright on both entry points: overlay
      opens with a real German noun and 3 real article options, played a
      full 5-round session and confirmed the summary score (1/5) exactly
      matched manual counting, and confirmed patterns without a
      `quizType` correctly show no trigger at all (no false positives).
- [x] **Found and fixed a real, live bug**: 11 of 36 German patterns (and 2
      of Spanish's) used an `"auto:xxx"` distractor-pool convention with a
      resolver (`getDistractors`/`buildOptions` in `engine/grammar.js`)
      that was never actually called anywhere — `FillBlank` always read
      `pattern.distractors[0]` directly, which for these patterns was the
      literal string `"auto:xxx"`. Confirmed live: exercises rendered a
      single button reading "auto:sein-present" instead of real German
      words. Root cause affected 2 different things:
      - 8 patterns (articles, cases, Perfekt, adjective endings) had a
        correct, working `correctAnswer` in `instantiateTemplate()`'s
        output that `FillBlank` just never used — fixed by wiring
        `buildOptions()` in for any pattern using the auto: convention.
      - 3 patterns (`sein`/`haben`/`müssen` present tense, plus 2 Spanish
        `ser`/`estar` ones) had a deeper design problem: the template
        randomized the *subject* pronoun, but the correct verb form
        depends on which pronoun gets picked — something the engine has
        no way to resolve without full per-pronoun conjugation tables,
        which don't exist. Redesigned these 5 onto the already-proven
        fixed-subject format (matching `können`/`müssen`'s working style)
        instead of trying to build that missing data layer.
      Verified all fixes in real-browser Playwright: cycled through every
      conjugation pattern confirming real distinct word options (not
      placeholder text), and confirmed clicking the actual correct answer
      registers correctly (session score incremented, pattern advanced).
- [x] Fleshed out German conjugation coverage — was 5 patterns (present
      tense only: sein, haben, regular -en/ich, können, müssen), now 13.
      Added: Präteritum (sein, haben), 4 more modal verbs (wollen,
      dürfen, sollen, mögen — können/müssen already existed), a second
      person for regular -en verbs (du-form, was ich-only), and separable
      verbs (aufstehen-style) — a distinctly German construction that
      wasn't represented at all. Perfekt was already reasonably covered
      (de-g-015/016) so left alone rather than duplicated.
- [ ] Other German categories are still thin and weren't touched this
      pass (not asked for, scoped to conjugation): adjectives,
      infinitivkonstruktionen, konnektoren, relativsätze, modalpartikeln,
      subjunktiv all have exactly 1 pattern each. Candidate for a future
      "flesh out the rest" pass if wanted.
- [ ] Not attempted: a fully dynamic conjugation drill pulling from the
      2,758-verb `public/conjugations/de.json` database (built earlier
      this session, currently only feeding the Vocab Browser/Flashcard
      word-detail conjugation display) — would give much broader verb
      coverage than hand-authored patterns ever could, but needs a new
      exercise-type architecture (dynamic question generation + synthetic
      pattern IDs for scoring) rather than just adding more static JSON
      patterns to the existing format. Worth considering if hand-authored
      patterns start feeling repetitive.
- [x] **Found a second, wider version of the same bug class** while
      preparing to mass-generate article patterns — the first fix only
      covered patterns explicitly marked `"auto:xxx"`. A second class
      shared the same root flaw without that marker: patterns using a
      literal distractor array *plus* a colon-convention bracket that
      genuinely varies the correct answer per noun/verb (e.g.
      `"Katze:eine"`) — `FillBlank`'s non-auto path still always trusted
      `distractors[0]` regardless. Affected `de-g-002`, `de-g-009`,
      `de-g-016`, plus 8 more in Spanish (`es-g-001/002/006/007/009/012/
      020`) — one of which (`es-g-001`, definite articles) also had a
      case-sensitivity wrinkle (`"El"` vs `"el"`). Confirmed live: a
      sentence showing "(Katze)" had "eine" marked wrong and "ein" marked
      correct — actively teaching wrong German. Rewired `FillBlank` with
      a general, case-insensitive fix: trust `correctAnswer` from
      `instantiateTemplate()` whenever it resolves to one of the pattern's
      known distractors, otherwise fall back to the fixed first
      distractor (correct for the self-mapping/no-bracket case). Verified
      in real-browser Playwright: 11+ noun/verb combinations across the
      affected German patterns, zero mismatches; confirmed no regression
      against the earlier-fixed conjugation patterns either. Spanish's 4
      data-design issues (`es-g-006/007/009/012` mix genuinely different
      verbs within one pattern's distractor list, which needs a template
      redesign, not just the engine fix) are flagged but not fixed — out
      of this session's German-focused scope.
- [x] Generated 100 new article patterns (`de-g-auto-*`), evenly split
      across all 5 case/definiteness combinations already in use
      (nominative/accusative/dative × definite/indefinite, 20 each).
      Drawn from the vocab list's 13,081 clean-gender German nouns
      (available now thanks to this session's earlier gender-data fixes),
      weighted toward A1/A2 vocabulary. Distractors kept to just the 3
      gender articles per your call — case-confusion distractors
      (dative forms as wrong answers for accusative questions, etc.) are
      a deliberate future enhancement, not done here.
- [x] Generated 36 new word-order patterns scaling up all 8 existing
      rules — 5 new variations each for the 6 tile-order rules (30 total:
      V2, V2-with-place, modal-verb-structure, subordinate-clause-weil,
      infinitive-clause-zu, inversion-after-adverb), 3 each for the 2
      pick-correct rules (6 total: Nachfeld, erweiterte Adjektivattribute)
      — weighted down deliberately on those last two rather than matching
      "evenly" exactly, since they're B2/C1 grammar where auto-varying
      vocabulary carries real correctness risk. Same syntactic
      skeleton/tile-position/answer-logic as each original, different
      vocabulary substituted in. Verified all 8 rules in real-browser
      Playwright: all 6 tile-order rules confirmed via actually clicking
      tiles in the generated correct order and checking the app accepts
      it; the 2 pick-correct rules confirmed via both wrong-answer
      error-matching (10/10) and correct-answer session-score increments
      (2/3 sampled, clean).
- [x] Total German grammar patterns: 36 → 180 across this whole pass.
      Structural validation passed (no ID collisions, all required
      fields present per exercise type).
- [x] Japanese N4/N5 "thin coverage" — turned out to be a data bug, not a
      real gap. 2,128 of 7,972 words had the wrong JLPT level (mostly N3
      words mistagged N2). Rebuilt every level directly from the elzup
      source CSVs. Corrected distribution: N5: 749, N4: 682, N3: 2,131,
      N2: 1,741, N1: 2,669 (was N5: 532, N4: 7, N3: 401, N2: 3,409, N1: 2,951).
- [x] Added `?` help buttons to Adventure, AdventureChapter, Settings, and
      Stats — the four screens that had none. Also audited every existing
      help button for accuracy against current features (several games have
      gained controls since their help text was written) and fixed the
      stale ones: Graded Reader's library-view help was completely outdated
      (didn't mention search/tags/finished-tracking/Vocab Quiz/continue-
      reading); Listening was missing the Speed slider; VocabBrowser didn't
      mention its status/level/POS/topic filters or Trans/Scores toggles at
      all; Flashcard was missing the 🔊 Auto toggle; PairMatch was missing
      the "Same word type" toggle. RaceCar, GapFill, GrammarTrainer,
      MatchingDrills, StrokeOrder, Typing, Dialogue, and GrammarDictionary
      were all still accurate, left as-is. Verified all 4 new + 5 updated
      help buttons open correctly in real-browser Playwright, not just
      code review.

## Category tagging — completed (was: German/Japanese/Chinese partial only)
- [x] Pulled in from a delegated session (commit b69e171): all 6 vocab
      lists are now 100% category-tagged (previously only German A1/A2/B1,
      Japanese N5-N3, Chinese HSK1-3 were). Spanish and French went through
      a full pipeline pass for the first time. Manual spot-check depth
      varies a lot by language — see `tools/review-status/{lang}-review.json`
      for exactly which words have been reviewed: Japanese 900 words
      checked, German 40, Chinese 45. `README.md`/`REVIEW.md` now frame
      this correctly as "reviewed vs. unreviewed" rather than "tagged vs.
      untagged." New tooling from that session: `REVIEW.md` (spot-check
      procedure), `tools/resweep_concepts.py` (re-classifies everything
      currently dumped in the generic "concepts" fallback, skipping
      anything already manually reviewed so it can't clobber deliberate
      overrides), and meaningfully expanded keyword lists + new
      `IDIOM_SCRUBS` entries in `tools/tag_categories.py` fixing real
      polysemy bugs.

## Grammatical gender / article engines (German + French + Spanish) + German conjugations
- [x] Pulled in from a further-delegated session (commits edb31dd, 4f9f7c6):
      Spanish gender went from 0% to 94.9% populated (~9,250 nouns, via
      doozan/spanish_data + hand-verified suffix rules), French's corrupted-
      gender problem shrank from 1,863 to 118 unresolved entries (via
      Lexique383), and Spanish gained a `pluraleTantum` field. New German
      verb conjugation data (`public/conjugations/de.json`, 2,758/3,136
      verbs, Wiktionary-derived via german-verbs-database) plus a
      lazy-load engine stub (`src/engine/conjugations.js`, mirrors
      `examples.js`) — arrived as a stub, not wired into the UI yet.
      `THIRD_PARTY_LICENSES.md` updated with detailed per-source
      attribution for all of this (see the CC BY-SA discussion earlier in
      this file/chat — properly scoped to the specific data, not the
      whole project's license).
- [x] Built `spanishArticle.js` (matching the germanArticle.js/
      frenchArticle.js pattern) and wired it into `displayEntry()`, now
      that Spanish actually has gender data to use — previously Spanish's
      simple `{m:'el',f:'la'}` map existed but never had anything to look
      up. Handles Spanish epicene nouns (226 of them — presidente,
      estudiante, artista, etc.) and plurale tantum (2 — afueras,
      felicidades).
- [x] **Caught a real bug via real-browser testing, not code review**: my
      first version of `spanishArticle.js` checked "no gender → no
      article" *before* checking plurale tantum, so "afueras" showed no
      article at all — plurale-tantum entries correctly have `gender:
      null` (same convention as German/French), so that check needs to
      come first, matching how `germanArticle.js` already orders it.
      Fixed by reordering. Along the way also found `afueras` and
      `felicidades` (Spanish's only 2 plurale-tantum entries) had
      `gender: null` in the data itself, which — unlike German, where
      plurale tantum always takes "die" regardless of gender — Spanish
      actually needs (los vs. las) to pick the right plural article.
      Both are feminine; hand-fixed directly since it was only 2 words.
- [x] Wired `getConjugation()` into both **`WordDetail.jsx`** (Vocab
      Browser's word overlay) and **`Flashcard.jsx`**'s own detail panel —
      a new "🔤 Conjugation" section shows er/sie/es-present, Präteritum,
      Partizip II, and the haben/sein auxiliary for German verbs, and
      simply doesn't render for non-verbs or other languages (the fetch
      resolves to null). Verified in real-browser Playwright on both
      surfaces: "gehen" → geht/ging/gegangen/sein in Vocab Browser,
      "anbeten" → betet an/betete an/angebetet/haben in Flashcard (had to
      cycle through cards to land on a verb — Flashcard's card order isn't
      predictable — but got there and confirmed the section renders
      correctly, not just that the code compiles).
- [x] French gained a `pluraleTantum` field (words only used in plural,
      e.g. "vacances") from the delegated session, plus a new
      `src/engine/frenchArticle.js` (handles le/la/l'/les/des, h-aspiré
      vowel-elision exceptions, epicene nouns) — built but not wired into
      the UI yet at the time it landed. Wired it into `displayEntry()`
      now, plus built a `germanArticle.js` on the same pattern (der/die/
      das, plurale tantum, epicene) and added `pluraleTantum` to German
      too, since it needed it for the same reason.
- [x] Fixed German's 26 `gender: "Unknown"` sentinel entries properly
      instead of leaving the placeholder: 9 are genuinely epicene
      ("Freiwillige"/"Abgeordnete"-style adjectival nouns where der/die
      depends on who's being referred to, not the word itself — same
      pattern as French's epicene case), 15 are plurale tantum
      ("Geschwister", "Eheleute", "Cornflakes", etc. — always "die"), and
      2 (a numeral, a holiday name) genuinely take no article at all.
      `displayEntry()` for German defaults epicene nouns to masculine for
      display purposes (the standard dictionary convention when a specific
      referent isn't tracked) — same convention applied to French.
- [x] **Found a separate, more serious pre-existing data bug while wiring
      this in**: 1,863 of 10,604 French nouns (17.6%) have a corrupted
      `gender` field — instead of 'm'/'f'/'epicene' it contains the
      elided-article text itself (e.g. "l'enfant", "l'abaissement" sitting
      in the gender slot), evidently from a prior import gone wrong. This
      affects even basic A1 vocabulary ("homme", "arbre"). The real
      gender info for these words is gone, not just mislabeled — nothing
      in the current data to recover it from. `displayEntry()` treats
      anything other than a literal 'm'/'f'/'epicene' as "no article,"
      which is exactly these entries' pre-existing behavior — this pass
      doesn't make them worse, just doesn't silently pretend to fix data
      it can't actually repair. **Update**: mostly resolved since — a
      later delegated session used Lexique383 to re-derive gender for
      these, taking it from 1,863 down to 118 (1.1%) unresolved. The 118
      remaining presumably genuinely aren't in Lexique383 or are still
      ambiguous there. Properly fixing this needs re-deriving
      gender from an external French source (same shape of project as the
      category-tagging pass) — not attempted here, flagged for later.
- [x] Spanish's gender-data gap (was 0%, flagged as "bigger prerequisite
      gap than pluraleTantum itself, left alone") — resolved by a later
      delegated session, now 94.9% populated. See the new section above.
- [x] Verified in real-browser Playwright, not just the underlying logic:
      "die Geschwister", "der Freiwillige", "das Auto", "Zehntausend" (no
      article) all correct for German; "le chat", "la maison", "l'ami",
      "l'annonce" (proper elision) all correct for French; and confirmed
      the corrupted-data fallback actually triggers safely on "homme"/
      "arbre" rather than crashing or showing a wrong article.

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
- [x] Built the "reverse index" idea: picking English now opens a "Learn
      English from…" chooser (first-launch overlay and the Setup language
      dropdown both route through it) offering the other five languages as
      a base. Built client-side, on the fly, via `buildReverseList()` in
      `engine/vocab.js` — no new data files or build step: it groups a
      source list's entries by normalised English translation, merging
      collisions (multiple source words sharing one English translation)
      into a single card's `translation` array. Verified in real-browser
      Playwright across first-launch, returning-user, and reload-restore
      paths; German source produced 20,405 English cards from 20,221 source
      entries — sane 1:1-ish ratio.
- [ ] Reverse-built English cards have no reading and no example sentences
      (those belong to the source word, not the merged English card).
      Needs a dedicated English sentence list to fix properly — deferred,
      not started.

## Data quality audit tooling
- [x] `tools/audit_vocab.py` + `tools/generate_audit_html.py` — a
      screening + statistics pass over every language/level's vocab,
      checking whether `pos`/`categories`/`translation`/`reading`/example
      sentences/mnemonics exist (structural completeness, not accuracy —
      see README's "Category system" → "Tagging quality" for why those are
      different problems). Outputs a sortable/filterable self-contained
      HTML table (`tools/audit_report.html`, gitignored — regenerate with
      `python3 tools/audit_vocab.py`). `Concepts %` is tracked as its own
      column (inverted color-coding — high is bad) separate from the
      broader `Categories %`, specifically to make the German-B1-style
      "half the level fell into the generic fallback bucket" problem
      visible at a glance without needing an ad-hoc check each time.
- [x] `classify()` in `tools/tag_categories.py` now prioritizes
      `translations[0]` (the primary/first-listed sense) over the old
      approach of joining every sense into one blob and matching keywords
      against any of them — the latter is what let a rare secondary sense
      hijack the category (German `Werk` = "work, factory, plant" got
      tagged `plants` off the botanical sense of "plant" even though the
      word means factory/workplace). Secondary senses are still checked as
      a fallback if the primary sense alone gives no match. This is a
      structural improvement for *future* tagging passes; deliberately not
      retroactively applied to already-tagged levels (compared old vs new
      output against already-tagged German A1-B1 and found 458
      differences — a genuine mixed bag, not a clean win, so left as-is
      rather than bulk-overwritten without the same spot-check rigor
      everything else here got).
- [x] Fixed 61 already-tagged verbs sitting in the generic `verbs` fallback
      despite having an obvious single-topic meaning (52 German + 9
      Japanese) — e.g. `heiraten`→family, `singen`/`歌う`→music,
      `backen`/`焼く`→food, `malen`/`zeichnen`→art. Found via a signal-word
      scan (`tools/audit_vocab.py`-adjacent, done ad-hoc in chat, not yet a
      permanent script) — worth productizing as a real check if this
      pattern needs checking again for other languages/levels.

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
      versus Society's original 7). Taxonomy now: **8 parents, 35 leaves**
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
- [x] Meaning-accuracy audit (German/Japanese/Chinese, all previously-tagged
      levels): a keyword tagger working off the English gloss can tag a
      word correctly *for that gloss* while being flatly wrong for what the
      source word actually means, since one English translation array can
      list several senses. ~35 real fixes found this way — German `Werk`
      ("work, factory, plant") tagged `plants` off the botanical sense of
      "plant"; Chinese `和` ("and", one of the most common words in the
      language) tagged `clothing` because a secondary CC-CEDICT sense is
      "to suit"; Japanese `行う` ("to carry out") tagged `countries` with
      no discernible connection at all. Also caught and fixed 3 outright
      translation-data bugs surfaced by this same process (Chinese `比`,
      `药`, `胖` had the wrong sense/reading selected in the source data,
      not just a tagging problem). This audit predates and is broader than
      the "check existing categories" item below — see README's "Category
      system" → "Tagging quality" section for the general pattern, and
      `tools/tag_categories.py`'s `IDIOM_SCRUBS` list for the
      English-side-polysemy fixes this *doesn't* cover.
- [x] Japanese N3 (2,112 words) — tagged via `tools/tag_categories.py` +
      iterative spot-check-and-fix (several rounds, same process as German
      B1). Landed at 50.3% concepts — noticeably higher than N5/N4's
      ~18-23%, consistent with N3 being a genuinely harder/more abstract
      vocabulary tier (same shape as German B1's jump to ~55%). Found and
      fixed ~30 more keyword collisions along the way, several revealing a
      real limitation of the primary/secondary-sense-split architecture:
      a phrase spanning two separate translation array elements (e.g.
      `["porcelain", "china"]`, `["spring", "fountain"]`) can't be caught
      by a simple `IDIOM_SCRUBS` string-replace anymore, since primary and
      secondary senses are checked as separate texts, never joined into
      one string to scrub. Handled via small dedicated pre-filters in
      `classify()` for the specific pairs found — that pattern (not another
      generic scrub) is the fix if this recurs.
- [ ] Continue category tagging: German B2/C1/C2, Chinese HSK4-7, Spanish,
      French, English (entirely untagged). Reuse `tools/tag_categories.py`
      as a starting point but expect a fresh round of spot-check-driven
      fixes per language/level — polysemy bugs are language- and
      vocab-specific; N3 alone needed ~30 new fixes on top of everything
      already found during German B1.
- [ ] Check existing categories: A1/A2 (German), N5/N4 (Japanese), HSK1-3
      (Chinese) were tagged before both taxonomy restructures (Culture
      parent, traffic/music/art leaves, calendar→time, the quantity/
      function_words merges, health/media/technology re-parenting). The
      meaning-accuracy audit above already re-checked these levels for
      tagging *correctness*; what's still open is specifically whether any
      words now belonging in the newer leaves (music/art/traffic/quantity/
      function_words) got missed or mis-bucketed under the taxonomy as it
      existed when they were originally tagged.
- [ ] Science parent (Physics/Chemistry/Biology/Technology leaves) is still
      light on real content outside Technology — will fill in naturally as
      higher levels (which contain more hard-science vocab) get tagged.

## Audio / Listening game
- [x] `SpeakButton.jsx` no longer disappears when TTS is unsupported (some
      in-app browsers like WeChat's, older Android WebViews, and
      privacy-hardened browsers strip `speechSynthesis` entirely) — a
      vanished button with no explanation read as a bug report from one
      user ("the left play button doesn't even render on my phone"). Now
      renders greyed out, and tapping it shows a small tooltip with 3
      possible reasons instead of doing nothing.
- [x] Per-language voice picker in Settings → Voice was built, then
      **removed** — there's no reliable way for a webpage to query "the
      OS's configured system TTS voice," only a `.default` flag per voice
      (a browser-engine guess, unreliable especially on Android/Chrome), so
      the picker added real complexity (async voice loading, an
      iOS-Safari synchronous-call-stack workaround, per-language dropdown
      UI) without a dependable payoff. `speak()`/`speakAndWait()` reverted
      to never setting `utterance.voice` — always the browser/OS default.
- [x] New game: **Listening** — hands-free audio playback cycling word →
      translation → example sentence (karaoke-style on-screen text synced
      to each spoken segment) for every unmastered word (box 0-4) in the
      current filter, box-ordered top-down or looped on a single box.
      Deliberately not part of `LEITNER_GAMES` — passive listening
      reinforcement, not a scored recall test. Has Media Session
      integration (lock-screen play/pause/skip/metadata) for a nicer
      foreground experience; does **not** reliably survive the screen
      locking or the tab backgrounding, since that needs real `<audio>`
      element output for the OS to grant background-audio status, not raw
      `speechSynthesis` calls — true background playback would need
      pre-generated audio files, a substantially bigger undertaking than
      this app's static-hosting architecture supports today. Also has
      Screen Wake Lock support (keeps the display on while playing).
- [x] Listening's playback order is user-customizable directly in the game
      screen: tap-to-add/tap-to-remove chips build a sequence of
      word/translation/sentence steps (`settings.listeningSequence`),
      repeats and omissions both allowed. Editing stops active playback;
      an empty sequence disables Play with an explanation instead of
      silently doing nothing.
- [x] Category filter is now per-language (`settings.categories[lang]`,
      not one shared `global` slot) — switching languages shows that
      language's own filter (unfiltered the first time), switching back
      restores whatever was set before, instead of one language's topic
      filter leaking onto another.
- [x] Graded Reader's pasted/custom text now persists (`vocabCustomPassage`
      in `localStorage`, restored on mount, covered by export/import) — was
      pure in-memory React state before, silently lost on refresh or
      navigating away.
- [ ] The Listening game's audio pacing and sequence editor have only been
      verified in a sandboxed headless-Chromium environment with zero real
      installed voices. Worth a real-device check for how the timing/pacing
      feels with real (non-instant) speech synthesis, and whether Wake Lock
      / Media Session actually behave as expected outside a test harness.
- [x] Added a Speed slider (0.5×–1.5×, step 0.1) to the Listening game,
      stored as `settings.listeningSpeechRate` and passed as the `rate`
      option on every `speakAndWait()` call for that session.

## Dark-mode text brightness
- [x] Secondary/muted text on dark backgrounds was too dim (`--dt2: #b0b0b0`,
      plus ~16 components hardcoding their own dim grays — `#777`/`#888`/
      `#999`/`#aaa`/`#b0b0b0` — instead of using the shared variable).
      Fixed: `--dt1` brightened to `#f7f7f7`, `--dt2` brightened to `#dcdcdc`,
      and every hardcoded stray value consolidated onto `var(--dt2)` so the
      two-tier system in `src/index.css` is now actually followed everywhere
      (including Adventure/RaceCar's always-dark screens, which don't gate
      on `[data-theme="dark"]` since they're dark regardless of theme).

## UI jitter fixes (WeChat WebView)
- [x] `ChipRow.jsx` horizontal vibration on WeChat's in-app browser — a
      `ResizeObserver` feedback loop (measures width → sets a scale CSS var
      → that changes rendered width → re-triggers the observer). Usually
      absorbed by a small settle threshold, but WeChat's WebView has looser
      sub-pixel layout precision than desktop Chrome, so it could oscillate
      between two near-identical scale values instead of settling. Fixed by
      coalescing bursts of callbacks into one measurement per animation
      frame (`requestAnimationFrame`) plus a wider threshold.
- [x] `zoomGuard.js` vertical vibration — same feedback-loop shape: it
      watches `visualViewport` for accidental pinch-zoom and resets the
      viewport meta tag, but the reset is itself a viewport change that can
      re-trigger the listener. Fixed with a two-reading confirmation
      (don't act on a single possibly-noisy sample) plus a cooldown after
      each reset. See README's "Known device/browser quirks" section — if
      a future bug reads as "something vibrates, especially on WeChat,"
      check for this same pattern first.

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
- [ ] Noticed while adding Graded Reader's Vocab Quiz button: `sessionEntries`
      (used by Adventure's vocab-lesson phase, and now also the reader) is
      never reset to `null` anywhere — once set, it silently keeps scoping
      Flashcard/etc. to that subset until something else overwrites it,
      even after leaving Adventure or the Reader normally. Pre-existing,
      not introduced here, but worth a proper fix (e.g. clear it in
      `goBack()` or whenever leaving a session-scoped game).
- [x] Removed dead code found via `eslint`/grep sweep: `PosChips.jsx`
      (unused component, superseded by inline `<select>` dropdowns
      elsewhere) and its only consumer, `posLabel()`/`POS_LABELS` in
      `settings.js`; the `.pos-chip` CSS block in `index.css`; stale
      comment references to both. `storyOutro` and `artifact` in
      `AdventureChapter.jsx` — computed, never read anywhere, removed
      (the `artifact` prop chain through `ChapterHub` too).
- [x] `AdventureChapter.jsx`'s `setDoneParts` was unused — the Vocab/Grammar
      hub buttons never got their ✓ checkmark since nothing marked those
      single-item phases done. Fixed: `doneParts` state lifted to the outer
      `AdventureChapter` component; backing out of the Vocab or Grammar
      sub-view (via "← Chapter") now marks that phase done.
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

- [x] Main repo (`vocab-games`) `dev` branch was stale (~v0.46, pre-dates all
      the lost-session recovery work) — deleted. Also found and deleted a
      `master` branch (even older, ~v9, pre-dates the rename to `main`).
      Main repo now only has `main` and `gh-pages`, both current.
- [ ] Document the `vendor/language-decks/` + `tools/extract-examples.js`
      pattern as "the process" for future language/example data work
      (currently only documented in `vendor/language-decks/README.md`).
