# Vocab Games

Version: 0.68 — 2026-08-16

A React/Vite PWA for vocabulary learning across six languages (German,
Spanish, French, English, Chinese, Japanese), built around a custom Leitner
spaced-repetition engine.

## Quick start

```sh
npm install
npm run dev       # local dev server
npm run build     # production build -> dist/
npm run preview   # serve the built dist/ locally
npm run lint
```

No environment variables or secrets are needed to build or run the project.

## Repos

- **`vocab-games`** (this repo) — production/main
- **`vocab-games-dev`** — dev/testing; `main` branch holds source, `gh-pages`
  branch holds the built `dist/` for the live dev deploy

Both repos are pushed manually (source + `gh-pages` deploy together, never
one without the other) — see `TODO.md` and chat history for the exact
workflow.

## Project structure

- `src/games/` — one file per game mode: Flashcard, Race Car, Pair Match,
  Typing, Stroke Order, Gap Fill, Grammar Trainer, Matching Drills, Graded
  Reader, Dialogue, Adventure, Grammar Dictionary, Vocab Browser, Listening,
  Stats, Settings.
- `src/components/` — shared UI: Setup (home screen), Tutorial, the chip
  filter system (`ChipRow`/`ChoiceChips`/`LevelChooser`/`CategoryChooser`),
  Leitner box bar, help overlays, `WordDetail.jsx` (the shared word-detail
  overlay — translations/POS/example sentence/conjugation/editable
  mnemonic — used by Vocab Browser and mirrored, not shared, by Flashcard's
  own detail panel), `QuizOverlay.jsx` (the dynamic grammar mini-quiz
  overlay — see Grammar system below), etc.
- `src/engine/` — core logic, decoupled from UI:
  - `vocab.js` — loads/normalizes `public/vocab/*.json` into entry objects;
    also owns `displayEntry()`, which prepends the correct article for
    gendered languages by routing through that language's own article
    engine (see Grammatical gender below)
  - `leitner.js` — the spaced-repetition box engine (see file header comment
    for the full box-selection design)
  - `categories.js` — topic category taxonomy (see below)
  - `settings.js` — persisted user settings, level/category filter helpers,
    dark mode
  - `germanArticle.js` / `frenchArticle.js` / `spanishArticle.js` — article
    computation for each gendered language (see Grammatical gender below)
  - `conjugations.js` — lazy-loads `public/conjugations/de.json` (2,758
    German verbs); feeds the "🔤 Conjugation" section in `WordDetail.jsx`
    and Flashcard's detail panel
  - `grammarQuiz.js` — registry of dynamic grammar mini-quiz generators
    (see Grammar system below)
  - `examples.js`, `mnemonics.js`, `grammar.js`, `reader.js`,
    `dialogueTSV.js`, `campaignLoader.js`, `facets.js`, `srs.js` — supporting
    data loaders and logic for specific games
- `src/context/AppContext.jsx` — global app state: active language/entries,
  settings, filtered entry views used across games
- `public/vocab/*.json` — the vocab lists themselves (source of truth, hand
  maintained/curated — see Data pipeline below)
- `public/examples/`, `public/sentences/`, `public/dialogues/`,
  `public/mnemonics/`, `public/grammar/`, `public/reader/`,
  `public/conjugations/` — supporting per-language content, lazy-loaded by
  the relevant games. `public/reader/surface-forms.json` is generated (see
  Lemmatizer below), not hand-authored — regenerate after any reader
  passage or vocab-gender edit, don't hand-edit it.
- `vendor/language-decks/` — gitignored raw source data used only to
  backfill example sentences; see its own `README.md` to re-fetch it. Not
  needed to build or run the app — only to regenerate example sentences.
- `tools/extract-examples.js` — pulls example sentences from `vendor/` into
  `public/examples/*.json`
- `tools/tag_categories.py` — reusable keyword-based category tagger (see
  Category system below); run against a vocab JSON + level to tag topics
- `tools/generate_reader_surface_forms.py` — lemmatizes Graded Reader
  passages (German via spaCy, Japanese via fugashi) into
  `public/reader/surface-forms.json` (see Lemmatizer below)
- `tools/check_reader_congruence.py` — flags Graded Reader passages whose
  source/English sentence counts don't match per paragraph (breaks
  sentence-level tap-to-translate for that passage/language, not a crash)

## Vocab data format

Each `public/vocab/<lang>-en.json` file is:

```json
{
  "id": "de-en", "language": "de", "native": "en",
  "keys": ["entry", "reading", "translation", "pos", "categories", "level", "gender", "measureWord", "pluraleTantum"],
  "entries": [
    ["Hund", "", ["dog"], "noun", ["animals"], "A1", "m", null, false]
  ]
}
```

Entries are arrays (not objects) keyed positionally by the `keys` array —
`src/engine/vocab.js` does the array→object normalization on load. This
keeps the JSON files compact; anything reading raw vocab JSON directly
(scripts, tools) needs to resolve fields via `keys.indexOf(...)`, not assume
a fixed order.

`pluraleTantum` (German/French/Spanish only, not Chinese/Japanese/English)
marks words only used in the plural (German *Geschwister*, French
*vacances*, Spanish *afueras*) — `gender` is `null` for these, since no
notional singular gender is tracked; the correct plural-only article
(*die*/*les*/*los*|*las*) is derived from `pluraleTantum` directly, not
`gender`. See Grammatical gender below for how this actually gets used.

**Curated vocab lists are the source of truth.** Vendor/third-party data is
only ever used to backfill supplementary content (example sentences) — never
to add or override headwords, translations, or levels.

## Category system

Topic tagging (Nature, People, Life, Places, Society, Culture, Science,
Abstract — 8 parents, 35 leaves) lets someone filter the vocab list or
generate a flashcard set by topic instead of just by level.

- `src/engine/categories.js` holds the **only** copy of the parent→leaf tree
  and per-language display labels. A word's `categories` array (in the vocab
  JSON) stores **leaf IDs only** (e.g. `"animals"`), never the parent — so
  the tree can be reorganized (add/rename/move/merge leaves) without ever
  touching vocab data files. Note: merging or renaming a leaf ID *does*
  require migrating existing tagged data (see chat history for the
  `numbers`+`quantifiers`→`quantity`, `questions`+`connectors`→
  `function_words`, and `calendar`→`time` migrations, plus the
  `health`→Life, `media`→Culture, `technology`→Science re-parenting) — only
  *moving* a leaf to a different parent is free (the leaf ID itself doesn't
  change).
- The same array field also carries the `"vulgar"` tag (profanity/explicit
  biological terms) — it's a general-purpose tag field, not exclusively for
  topics. Vulgar-tagged words are **always** filtered out everywhere
  (`AppContext.jsx`'s `vulgarFilteredEntries`/`getEntriesForGame`) — this was
  a user-facing Settings toggle at one point, removed since the product
  decision is just to hide this content rather than make it optional.
- `src/components/CategoryChooser.jsx` is the two-level picker UI. The parent
  row is **single-select**: tapping a parent shows all its words, tapping the
  active parent again clears the filter — no separate "clear" button needed
  at that level. The leaf row (once a parent is active) stays **multi-select**
  and has its own "✕" clear chip. See the file's header comment for the exact
  interaction rules. `CategoryChips.jsx` wraps it for the Setup-screen
  filter, keyed **per language** (`settings.categories[activeLanguage]`,
  not a single shared slot) — switching languages shows that language's
  own filter (starting unfiltered the first time), and switching back
  restores whatever was set before, rather than one language's topic
  filter leaking onto another.
- **Vocab Browser is intentionally independent of the global filter** — it
  consumes `vulgarFilteredEntries` (respects the vulgar-content filter, not
  the topic filter) and implements its own two `<select>` dropdowns (parent,
  then leaf) rather than `CategoryChooser`, matching its existing
  status/level/POS dropdown style. A browsing/reference tool shouldn't
  silently narrow to whatever topic was last picked on the home screen.
- `filterByCategory()` in `src/engine/settings.js` applies the filter;
  `AppContext.jsx` wires it in alongside the existing level/vulgar filters.

**Tagging coverage** (check `TODO.md` for current status): all six vocab
lists are now 100% category-tagged. Manual spot-check depth varies a lot
by language — see `tools/review-status/{lang}-review.json` for exactly
which words have been reviewed. Untagged-vs-reviewed is no longer the
right framing; reviewed-vs-unreviewed is.

Spot-checking category tags follows a fixed procedure — see
[`REVIEW-VOCAB.md`](./REVIEW-VOCAB.md), which also covers the review-status
tracking system, the resweep script, and known risky keyword patterns.

There are **two different pipelines** for tagging/fixing category data,
built at different points and suited to different jobs. Both write to the
same `categories` array in the vocab JSON — neither is "the" canonical one,
pick whichever fits the task.

### Pipeline 1 (older): keyword tagger — `tools/tag_categories.py`

Bulk-tags an entire untagged level in one pass by matching English keyword
regexes against each word's translation. Language-agnostic (works off the
English gloss, so the same ruleset applies across source languages) and
fast — this is how German A1/A2/B1, Japanese N5-N3, and Chinese HSK1-3 all
got their *first* pass of coverage.

Two real classes of bug to expect, both requiring a spot-check-and-fix
loop (see `IDIOM_SCRUBS` in the script and chat history for the ~100+
fixes accumulated there):
1. **English-side keyword collisions** — a single ambiguous English word
   matches the wrong category (e.g. "mouse" the animal vs. the computer
   peripheral, "course" in "golf course" vs. "of course"). `IDIOM_SCRUBS`
   phrase-level exclusions fix most of these.
2. **Cross-element sense collisions** — a translation array like
   `["porcelain", "china"]` or `["spring", "fountain"]` has two senses that
   only make sense *together*, but the classifier's primary/secondary-sense
   split (see `classify()`'s docstring) checks them as separate texts, so a
   phrase-level scrub can't catch it. These need a small dedicated
   pre-filter in `classify()` itself — see the `porcelain`/`china` and
   `spring`/`fountain` handling for the pattern to follow if this recurs.

Always spot-check a random sample before trusting a pass, especially at
>1000 words — a purely keyword-driven pass tends to dump too much into the
generic `concepts` fallback bucket if the ruleset isn't specific enough
(this happened with German A2's first pass, and B1 sits at a genuine ~55%
concepts even after heavy tuning — B1's vocabulary really is more abstract,
not just under-tuned).

### Pipeline 2 (newer): LLM-review — `tools/extract_for_llm_review.py` + `tools/apply_llm_categories.py`

Built specifically to fix Pipeline 1's fundamental blind spot: a keyword
tagger can only ever reason about the *English gloss*, never the actual
target-language word — which is exactly the root cause of the "Tagging
quality" bugs described below. This pipeline instead has an LLM read the
real target word (its spelling, reading, part of speech) and classify it
directly, no keyword matching involved.

There's no API call — this is "Option A" from the design discussion: an
LLM (Claude, in conversation) reviews a batch and reasons about each word
directly, since the reviewer already *is* the classifier. The mechanics:

```
python3 tools/extract_for_llm_review.py de B1 --start 0 --count 300
# prints a numbered list: entry, reading, pos, translation, current categories
```

The LLM reviews the printed batch and writes back a decisions file — JSON
with an optional trailing `// XX` comment per line (stripped before
parsing, since plain JSON has no comment syntax) noting the reasoning
basis and confidence: first letter **T**=clear from the Target word itself,
**G**=had to lean on the English Gloss, **C**=Compound/context reasoning;
second letter **H**/**M**/**L** for confidence. E.g. `// TH` = read the
target word directly, high confidence.

```
python3 tools/apply_llm_categories.py de decisions.json --level B1
```

Best suited for: words sitting in the generic Abstract-parent leaves
(`verbs`/`function_words`/`quantity`/`concepts`/`grammar`) that Pipeline 1
couldn't find a topic for, or words with no category at all. Not a full
replacement for Pipeline 1 — bulk-tagging a fresh untagged level from
scratch this way would take many, many review passes; use Pipeline 1 for
first-pass coverage and Pipeline 2 to clean up what it couldn't reach.
Real yield rates observed so far: German A1 7.6%, A2 19.3%, B1 ~14% (most
of what's in Abstract at A1 especially is *correctly* there — numerals,
pronouns, basic verbs — so a lower yield isn't a failure, it's the
expected outcome of a level that was already well-tagged).

### Tagging quality: English-gloss tagging can miss the source word's actual meaning

A keyword tagger classifying by the English translation will happily tag a
word correctly *for that English gloss* while being wrong for what the
source-language word actually means — because a translation array can list
several senses, and the tagger has no way to know which one the source word
"really" is. Real examples found in a manual German/Japanese/Chinese audit
(see chat history for the full list, ~35 fixes across the three languages):
German `Werk` ("work, factory, plant") got tagged `plants` off the botanical
sense of "plant" even though the word means factory/workplace; Chinese `和`
("and") got tagged `clothing` because one of its many CC-CEDICT senses is
"to suit". This class of bug is *not* caught by the keyword-precision work
in `tag_categories.py` (Pipeline 1) — that fixes English-side polysemy
(ambiguous English words), not source-word-vs-gloss mismatches. Pipeline 2
(the LLM-review pipeline above) was built specifically to address this —
it reads the actual target word instead of pattern-matching its gloss.

## Grammatical gender / article engines

`displayEntry()` (`src/engine/vocab.js`) prepends the correct article to a
noun's display string, e.g. `Auto` → `das Auto`. German, French, and
Spanish each route through their own article engine (`germanArticle.js` /
`frenchArticle.js` / `spanishArticle.js`) rather than a flat gender→article
lookup, since a flat map can't handle plurale-tantum nouns (always take the
plural article regardless of any notional singular gender) or epicene nouns
(the article depends on the referent's sex, e.g. German *Freiwillige* or
French *artiste* — since no vocab entry tracks "who this specific card
refers to," these default to masculine for display, the standard
dictionary convention when citing a headword out of context). French
additionally needs vowel-sound elision (*le*/*la* → *l'*, with h-aspiré
exceptions where elision does *not* apply, e.g. *le hall*).

**Known data-quality issue**: ~1.1% of French nouns still have a corrupted
`gender` field left over from a prior data import — instead of `'m'`/`'f'`/
`'epicene'`, the elided article text itself got stored in the gender slot
(e.g. `"l'enfant"` sitting where `"m"` should be). This was ~17.6% before a
Lexique383-based resolution pass; `displayEntry()` treats anything other
than a literal `'m'`/`'f'`/`'epicene'` as "no article," so these entries
just show without one rather than showing something wrong. Spanish has no
equivalent issue — its gender data was independently built to ~94.9%
coverage via doozan/spanish_data.

## Graded Reader

- **Read-aloud**: a 🔊/⏸ button speaks the passage sentence-by-sentence
  (not as one long utterance, so play/pause has a clean boundary and
  progress can be shown), highlighting the active sentence and
  auto-scrolling to keep it in view. Respects the per-language voice
  picker and `settings.listeningSpeechRate`.
- **Sentence-level tap-to-translate**: naive index-pairing between the
  source and English sentence splits, since no per-sentence translation
  data exists — only a single flat `translation` string per passage. Only
  trusted when both sides split into the same number of sentences per
  paragraph; `tools/check_reader_congruence.py` flags passages where they
  don't (currently a handful, mostly Japanese — translators don't always
  keep a 1:1 sentence count with the source). When it doesn't match, the
  tap affordance is silently unavailable for that passage — the
  full-passage EN toggle still works regardless, since it doesn't depend
  on alignment.
- **Paragraph handling**: passages use `\n\n` to mark real paragraph
  breaks. Both sentence-splitting (`splitSentences()` in `reader.js`) and
  translation-pairing split by paragraph *first*, then by sentence within
  each — splitting the whole text at once instead silently discards
  paragraph structure (this was a real regression once; watch for it if
  touching this code again).
- **Vocab Quiz**: a floating button on the reading screen resolves the
  passage's matched vocab to full entries and launches a Flashcard session
  scoped to just those words, via `setSessionEntries()` — the same
  mechanism Adventure Mode's vocab-lesson phase uses. Note:
  `sessionEntries` is never reset to `null` anywhere in the codebase once
  set, by either consumer — a pre-existing, still-open issue.
- **Finished tracking / Continue reading**: `localStorage`-backed, entirely
  separate from Leitner scores — marking a passage "Finished" and the
  "Continue reading" banner (resumes the last-opened passage at its exact
  scroll position) are reading-progress features, not spaced-repetition
  ones.

### Lemmatizer (surface-form matching)

`public/reader/surface-forms.json` is a generated `{ lang: { surface:
lemma } }` map — German via spaCy (`de_core_news_sm`) and Japanese via
fugashi — letting an inflected word in reading passages (*aßen*, *Kindern*)
resolve back to its dictionary-form vocab entry for tap-to-lookup, instead
of only matching exact dictionary forms. Regenerate with
`python3 tools/generate_reader_surface_forms.py` after editing reader
passages or vocab gender data. The same surface-forms mechanism also
powers Adventure Mode's dialogue/passage word lookups (`TextWithLookup.jsx`
consumes it directly) — `buildLookup()` returns a `Map`, not a plain
object, and both consumers' merge logic has to treat it as one (a real,
previously-live bug: bracket-access + object-spread on a Map is a silent
no-op, not an error, so it doesn't fail loudly).

spaCy's German model isn't installable via `pip install spacy` alone in a
sandboxed environment with a restricted network egress allowlist — the
model wheel is hosted on GitHub releases, so `release-assets.
githubusercontent.com` needs to be reachable; `spacy download` itself
doesn't work in that kind of environment either (it doesn't pass through
`--break-system-packages`), so install directly from the release wheel URL
instead, e.g.:
```
pip install --break-system-packages "https://github.com/explosion/spacy-models/releases/download/de_core_news_sm-3.8.0/de_core_news_sm-3.8.0-py3-none-any.whl"
```

## Grammar system

Two independent systems live under Grammar Trainer / Grammar Dictionary,
serving different purposes:

- **Static exercises** (`public/grammar/<lang>-en.json`, rendered by
  `GrammarTrainer.jsx`) — hand-authored `fill-blank` / `pick-correct` /
  `tile-order` patterns, reviewed content with a fixed question pool.
  `fill-blank`'s distractor resolution has two conventions: a plain
  literal array (`distractors[0]` = correct, rest = wrong — for templates
  where the blank's answer is fixed regardless of which random template
  option got picked) and a colon-convention bracket
  (`{[Katze:eine|Hund:ein]}`) for templates where the answer genuinely
  varies with the random pick. Getting these two confused is an easy,
  previously-real bug: trusting the wrong one either shows literal
  placeholder text as an "answer," or marks a grammatically correct answer
  as wrong. See `instantiateTemplate()`/`FillBlank`'s comments in
  `engine/grammar.js`/`GrammarTrainer.jsx` for exactly how the two are
  told apart (case-insensitive matching against the pattern's own
  distractor list, not the `"auto:"` prefix alone).
- **Dynamic mini-quizzes** (`engine/grammarQuiz.js` + `components/
  QuizOverlay.jsx`) — a lightweight, infinite-variety supplement. A "🎯
  Practise this" trigger appears on any static pattern tagged with a
  `quizType` field, opening a short 5-round multiple-choice overlay whose
  questions are generated fresh from real vocab data every time (a random
  noun + its correct article, for example) rather than stored content.
  Only grammar points fully deterministic from vocab data alone are good
  fits — word order/subjunktiv-type points still need hand-authored
  content. `QUIZ_GENERATORS` is a plain registry; adding a new
  deterministic grammar point (plural forms, adjective-ending agreement...)
  is adding one more entry, not restructuring.

## Data backup / storage discipline

Settings → Data has Export/Import backup and Reset all scores, covering
`localStorage` keys for scores, settings, mnemonics, adventure progress,
Graded Reader's pasted/custom text (`vocabCustomPassage` — this used to be
pure in-memory React state with no persistence at all, lost on refresh; now
saved on every edit), and Leitner spaced-repetition state. **The Leitner
keys must never be hardcoded** — `leitnerScores_<game>`/`leitnerSession_<game>`
exist per game in `LEITNER_GAMES` (`src/engine/leitner.js`), and a new game
added to that array needs its keys picked up automatically. Use the exported
`leitnerStorageKeys()` helper (not a manual list) anywhere backup/export/
import/reset logic touches Leitner data — a hardcoded list silently missed
these keys once already (found and fixed in chat; see `Settings.jsx`).

## Audio / text-to-speech

Uses the Web Speech API (`src/engine/speech.js`) — no backend, no
pre-generated audio files, so quality/availability depends entirely on
whatever's installed on the visitor's device/browser.

- `isSupported()` gates whether `SpeakButton.jsx` can actually speak, but the
  button still **always renders** rather than disappearing when unsupported
  — it shows greyed out, and tapping it reveals a small explanation (no
  TTS support / in-app browser like WeChat / no voices installed for the
  language) instead of silently doing nothing. A vanished button reads as a
  bug report; a visibly-disabled one reads as an understood platform limit.
- **Per-language voice picker** (Settings → Voice) lets the person pick a
  specific voice per language from whatever the browser reports via
  `speechSynthesis.getVoices()` — stored by `voiceURI` (a stable per-voice
  identifier), applied in `speech.js` whenever set, falling back to the
  browser/OS default otherwise. This exists because there's no reliable way
  for a webpage to query "the OS's configured system TTS voice" as a
  distinct concept — only a `.default` flag per voice (a browser-engine
  guess), which is why e.g. iOS's Safari-reported voice list doesn't
  include the actual configured Siri voice, only the separate classic
  AVSpeechSynthesis catalog (Samantha/Daniel/Karen/etc.) — picking one of
  those is the closest a web page can get, not a limitation of this picker
  specifically. An earlier version of this picker was built and removed at
  one point for being unreliable to maintain; it was rebuilt properly later
  once the async-voice-loading and iOS-Safari-call-stack issues were
  understood — if this needs touching again, the voice list only populates
  after the `voiceschanged` event fires, not synchronously on mount.
- **Listening** (`src/games/Listening.jsx`) is a hands-free audio-review
  game: cycles through every unmastered word (box 0-4, box 5 excluded) in
  the current filter, box-ordered top-down or looped on a single box.
  Deliberately **not** part of `LEITNER_GAMES` — it's passive listening
  reinforcement, not a scored recall test. Has Media Session integration
  (lock-screen play/pause/skip + metadata) for a nicer foreground
  experience, but that does **not** reliably keep speech playing once the
  screen locks or the tab backgrounds — Media Session's background-audio
  exemption is granted based on real `<audio>`/`<video>` element output,
  not raw `SpeechSynthesisUtterance` calls. True background playback would
  need pre-generated audio files behind a real `<audio>` element, which is
  a much bigger undertaking than this static-hosting architecture supports
  today. Also has Screen Wake Lock support (keeps the display on while
  actively playing, degrades gracefully where unsupported).
  - **Playback order is user-customizable**, directly in the game screen:
    a sequence of `word`/`translation`/`sentence` steps
    (`settings.listeningSequence`, default one of each in that order),
    edited via tap-to-add / tap-to-remove chips — repeats and omissions are
    both allowed (e.g. word/word/translation to hear the word twice before
    the translation, or word/translation with no sentence at all). Editing
    the sequence stops any active playback; an empty sequence disables Play
    rather than silently doing nothing.
- **Example sentence lookup gotcha**: `getExampleSentence()` keys sentences
  by `<lemma>::<pos>`, and tries a `::unknown` fallback if the real-pos key
  doesn't match. This fallback is load-bearing, not decorative — Japanese's
  example sentences were extracted *before* Japanese vocab had real POS
  tags, so every stored key there is `::unknown`. When the POS tagging pass
  happened later, every Japanese sentence lookup silently started returning
  `null` (no error, just missing content) until this fallback was added.
  Keep this in mind if POS tags are ever bulk-edited for a language that
  already has example sentences: the two data files can drift out of sync
  with no visible symptom other than sentences quietly disappearing.

## Known device/browser quirks

Two unrelated bugs, both root-caused to the same *shape* of problem — a
piece of code observes a dimension/state, reacts by changing something that
itself alters that same dimension/state, and on some browsers (notably
WeChat's in-app WebView, which has looser layout/timing precision than
desktop Chrome) that feedback loop doesn't reliably settle, showing up as
visible jitter:

- **`ChipRow.jsx`** measures its own width via `ResizeObserver` and sets a
  `--chip-row-scale` CSS variable to fit chips on one row — but changing
  that variable changes the rendered width, which re-triggers the observer.
  Fixed by coalescing bursts of callbacks into one measurement per animation
  frame (`requestAnimationFrame`) plus a wider settle threshold.
- **`zoomGuard.js`** watches `visualViewport` for accidental pinch-zoom and
  resets the viewport meta tag to un-zoom — but the reset itself is a
  viewport change that can re-trigger the same listener. Fixed with a
  two-reading confirmation (don't act on a single possibly-noisy sample)
  plus a cooldown after each reset.

If a future bug reads as "something visibly vibrates/jumps, especially on
WeChat," check for this same observe-then-mutate-the-observed-thing pattern
before assuming it's something else.

## Dark mode

`applyDarkMode()` in `settings.js` always sets an explicit
`data-theme="light"|"dark"` attribute (resolving `'auto'` itself). **CSS
must use `[data-theme="dark"]` selectors only** — never
`@media (prefers-color-scheme: dark)` — see the comment on that function for
why (a real bug from mixing the two got fixed once already).

## Chip filter sizing

The level/category/POS chip rows (`ChipRow.jsx`) auto-shrink font-size and
gaps (via a `--chip-row-scale` CSS variable) so a full row of chips always
fits on one line on narrow phones without wrapping. If a chip row doesn't
fit, check that its container isn't also adding fixed (non-scaled)
padding/gap/border that `ChipRow`'s width measurement doesn't account for.

## Data quality audit

`tools/audit_vocab.py` screens every language/level's vocab for structural
completeness (does `pos`/`categories`/`translation`/`reading`/example
sentence/mnemonic exist — not whether it's *correct*, a different and
harder problem, see "Tagging quality" above) and writes a sortable/
filterable self-contained HTML report:

```
python3 tools/audit_vocab.py
# writes tools/audit_report.json and tools/audit_report.html (gitignored — regenerate as needed)
```

`Concepts %` is tracked as its own column, separate from the broader
`Categories %`, specifically so a level where most words fell into the
generic fallback bucket (the German B1 problem — see "Category system"
above) is visible at a glance rather than needing an ad-hoc check.

## Story content (Graded Reader fairy tales)

A growing set of fairy tales in all 6 languages, separate from the
original graded passages — see `AUTHORING-TEXTS.md` (writing/translation
rules, CEFR/JLPT/HSK level mapping, why fairy tales cap at B2: a children's-
story retelling stops being the right register above that) and
`REVIEW-TEXTS.md` (content survey + sentence-congruence realignment log).
Level-paired by trio (an A1 version and a B1 retelling of the same tale,
etc.) and sequenced by origin country — Germany/Grimm first, five more
countries queued so every supported language eventually gets a turn as
source culture, not just translation target. `AUTHORING-TEXTS.md`'s status
section can lag the actual data by a commit or two (it's a planning doc,
not generated) — cross-check against `public/reader/<lang>-en.json`'s
actual passage list if it matters which tales really exist yet.

## Licensing

The app code is MIT (see `LICENSE`). Vocab/content data sourced from
third parties keeps *that specific data's* own license — CC BY-SA sources
in particular need attribution and, for direct derivatives, must stay
under CC BY-SA (or a compatible license) when redistributed; that
obligation doesn't spread to the rest of the codebase, since data and code
can carry different licenses within one repo. See `THIRD_PARTY_LICENSES.md`
for the per-source breakdown — extend it, don't restructure it, when a new
third-party source gets folded in.

## Deployment (`vocab-games-dev`)

GitHub Pages here runs through GitHub's own internal build-and-deploy
pipeline (triggered automatically on any push to `gh-pages`, not a file in
this repo's `.github/workflows/` — deleting workflow files doesn't stop
it). Two real, non-obvious failure modes hit this repo's Pages deploys and
are worth checking first if a push isn't showing up live:

- **Repo-level `default_workflow_permissions` set to read-only** blocks
  the internal deploy step specifically (build/package steps still
  succeed, only the final "write the deployment" step fails) — this is a
  repo Settings → Actions → General setting, not something visible from
  the Pages config itself. Check via
  `GET /repos/{owner}/{repo}/actions/permissions/workflow`.
- **Competing deploy workflows**: `vocab-games-dev`'s `.github/workflows/`
  once accidentally inherited `vocab-games` (prod)'s Actions-based deploy
  workflows during a sync that blindly copied the whole `.github/` folder
  across repos — including one written to run *from* prod *and push into*
  dev as an external target, which doesn't make sense running inside dev
  itself. These raced against manual `gh-pages` pushes with no reliable
  winner. Removed; don't reintroduce `.github/` in a cross-repo sync
  without checking what's actually inside it first.

A push looking "successful" (`git push` returning cleanly) does **not**
mean the site is actually live — always verify via the Actions API
(`GET /repos/{owner}/{repo}/actions/runs`, check `conclusion: "success"`
on the actual commit) or the Pages status endpoint (`GET /repos/{owner}/
{repo}/pages`, check `status: "built"`) before treating a deploy as done.

## Testing

No automated test suite — verification is done with ad-hoc Playwright/
Chromium smoke tests (inline Python scripts, `vite preview` + headless
browser) for anything UI-related, since real browser rendering has caught
bugs that code review alone missed. Not committed to the repo; written fresh
per change as needed.
