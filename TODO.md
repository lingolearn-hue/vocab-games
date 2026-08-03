# TODO / Future Improvements

## Repo state (as of this writing — check git log for current truth)
- `vocab-games-dev` (`main` branch): **v0.63az** — has everything, including
  Listening game, voice picker, Japanese example-sentence fix, jitter fixes.
- `vocab-games` (production, `main` branch): **v0.65** — was fully resynced
  from dev-check once (see below), and that push also included the
  custom-passage persistence, both jitter fixes, and the mature-vocab
  removal. It does **not** yet have this session's later work: the
  Listening game, the voice picker, or the Japanese example-sentence fix —
  those only made it to `vocab-games-dev`. Next production push should
  carry all of it forward.
- Both repos' `dev`/`master` branches (stale, pre-dating a lot of this work)
  were deleted — see "Groundskeeping" below. Production now only has `main`
  and `gh-pages`.

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

- [x] Main repo (`vocab-games`) `dev` branch was stale (~v0.46, pre-dates all
      the lost-session recovery work) — deleted. Also found and deleted a
      `master` branch (even older, ~v9, pre-dates the rename to `main`).
      Main repo now only has `main` and `gh-pages`, both current.
- [ ] Document the `vendor/language-decks/` + `tools/extract-examples.js`
      pattern as "the process" for future language/example data work
      (currently only documented in `vendor/language-decks/README.md`).
