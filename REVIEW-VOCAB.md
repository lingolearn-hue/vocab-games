# Category tagging review procedure

Applies to spot-checking the `categories` field in `public/vocab/*.json`,
whether tagged by the keyword pipeline (`tools/tag_categories.py`) or a
fill-only source (e.g. JMdict field tags).

## Before starting a check

Load `tools/review-status/{lang}-review.json` and **exclude any word
already present as a key** (value `"claude"` or `"manual"`) from the
sample pool. The goal is incremental coverage of the full vocab list over
time, not re-checking the same words. If a level's words are mostly
already reviewed, sample from what's left rather than resampling at
random from the whole level.

## Running a check

1. Pick a level (or set of levels) and a sample size — 40–100 words is
   the range used so far; scale up for levels with more at stake (a
   first pass on a new language) and down for a quick recheck.
2. Random-sample from **unreviewed** words only (see above), with a
   fixed seed so the batch is reproducible.
3. Print entry, pos, translation(s), and assigned category as a table
   and read through it. Look specifically for:
   - A generic English word in the gloss matching the wrong category's
     keyword regex (the recurring bug class — e.g. "turn" in "to turn
     traitor" wrongly matching `directions`).
   - Wrong `pos` values feeding the verb/concepts fallback logic.
   - Multi-sense words where a rare secondary sense hijacked the tag.
4. Fix real bugs at the source: add an `IDIOM_SCRUBS` entry or a keyword
   addition in `tools/tag_categories.py`, then clear `categories` for
   just the affected words and re-run the pipeline for that level so
   the fix is reflected.
5. Leave defensible misses alone (fallback to `concepts` on a genuinely
   obscure/abstract word, or a borderline secondary-category guess) —
   don't over-scrub generic keywords chasing perfect precision on one
   word at the cost of breaking correct matches elsewhere.

## What counts as a pass vs. needing another round

- A handful of fixable bugs in a batch (as has been typical) is normal;
  fix them and the batch counts as reviewed.
- If a batch turns up many bugs, or the keyword-patch fixes barely move
  the concepts-fallback rate (seen with Spanish/French — a 1-point
  change from a real keyword patch was the signal something structural,
  not just missing keywords, is going on), don't mark it reviewed.
  Flag it in `TODO.md` as needing a full iterative redo instead —
  matching the precedent already set for German A2/B1.

## After a check

1. Save the sampled batch itself, not just the review-status update, to
   `tools/review-status/batches/{lang}-batch-{N}.json`, as a list of
   `[entry, pos, translation, level, categories]` — categories as they
   stood **at the moment of sampling**, before any fixes from that
   round were applied. This is what makes the recheck procedure below
   possible; without it, a later recheck has nothing to diff against.
   (Batches run so far were kept in scratch space only, not the repo —
   treat that as a gap to fix going forward, not the pattern to repeat.)
2. Add every word in the sample (not just the ones that had bugs) to
   `tools/review-status/{lang}-review.json`:

   ```json
   { "entry::pos": "claude" }
   ```

   Use `"claude"` for AI-assisted checks, `"manual"` only when the user
   personally reviewed a word — `"manual"` entries should never be
   overwritten by a later automated pass.

   **Caveat**: `entry::pos` is not always a unique key. Genuine
   homographs (same written word, same part of speech, same level,
   different sense/translation — e.g. 大分 meaning both "considerably"
   and, separately, "Oita prefecture"-style readings) share a key. Any
   script that looks up "the" category for a reviewed word by this key
   alone can silently grab the wrong sibling entry. When diffing or
   looking up a specific word programmatically, match on
   `(entry, pos, translation)` together, not `entry::pos` alone.

## Re-sweeping after a keyword-list change

Any addition or fix to `KEYWORDS`/`IDIOM_SCRUBS` in `tools/tag_categories.py`
can retroactively help words that were already tagged `concepts` before
that fix existed — the tagging pipeline only ever touches words with
empty `categories`, so it never revisits them on its own.

Run `python3 tools/resweep_concepts.py` after any keyword-list change.
It re-runs `classify()` on every `concepts`-tagged word across all five
languages and updates it if the result improved.

**Important**: this script automatically skips any word already present
in that language's review-status file. This isn't optional — without it,
a manual single-word override (e.g. a word whose primary translation
literally *is* an ambiguous keyword, like 継目/"joint" or 先頭/"head",
where no scrub phrase can fix the match without breaking genuine uses
of that keyword elsewhere) gets silently reclassified back to the wrong
category the next time the sweep runs. Always add a word to the review
file *before* or *as part of* hand-fixing its category, not after.

## Rechecking previously-reviewed words

Reviewed words are only immune to the sweep going forward — anything
reviewed *before* `resweep_concepts.py` existed could have been silently
changed by an earlier, unprotected sweep without anyone re-verifying the
result. Periodically recheck for this:

1. For each saved batch file (see "After a check" above), load the
   `[entry, pos, translation, level, categories]` snapshot.
2. Build a lookup of current categories keyed on
   `(entry, pos, tuple(translation))` — the full triple, not just
   `entry::pos` (see the homograph caveat above; using too short a key
   here produces false alarms by comparing against the wrong sibling
   entry when two words share text and pos but differ in sense).
3. Diff stored-at-review categories against current ones. Anything
   different was either a fix made during that same review round
   (expected, harmless) or a change from a *later* round's keyword
   update (needs a fresh look — verify it's actually correct, not just
   different).
4. Since the pipeline only ever moves a word *out* of `concepts`, never
   into it, the only entries at risk are ones reviewed while tagged
   `concepts` that a later sweep moved elsewhere. Words reviewed with a
   specific non-`concepts` tag can't be touched by the sweep at all, so
   they don't need rechecking by this mechanism.

## Known risky generic keywords

A recurring bug class this session: a single generic English word
sitting bare in a keyword list, matching an unrelated idiom that happens
to contain it. Found and fixed so far: `turn` (directions — matched
"turn traitor", "turn pages", "to turn over"), `view` (landscape —
matched "point of view"), `term` (school — matched a generic "period,
term"), `pretty` (appearance — matched the intensifier "pretty much/
good"), `instrument` (music — too generic, replaced with "musical
instrument"), `show`/`director` (media — too generic, replaced with
specific phrases like "tv show"/"film director"), `forward`/`backward`
(directions — matched "looking forward to", "to forward money").
When adding a new bare (non-phrase) keyword, especially a short common
English word, consider whether it has a common non-literal or idiomatic
use before adding it standalone — prefer a specific phrase (`turn right`
rather than bare `turn`) when the literal word is prone to idiomatic
reuse.

## Vocabulary completeness (coverage gaps)

Separate from category-tagging accuracy: whether the word list itself is
missing common words at a given CEFR level. Found via reverse cross-
reference — take a proper CEFR-graded English lemma list (not a raw
subtitle-frequency list, which is dominated by inflected forms and
interjections) and check whether each English concept appears anywhere
in the `translation` field of the target language's vocab.

**Reference used for German (DE):**
`openlanguageprofiles/olp-en-cefrj` — CEFR-J Vocabulary Profile (A1–B1,
`cefrj-vocabulary-profile-1.5.csv`) + Octanove Vocabulary Profile
(C1/C2, `octanove-vocabulary-profile-c1c2-1.0.csv`). Lemma + POS +
CEFR level per row, filtered to content POS (noun/verb/adjective/
adverb) to skip determiners/pronouns/conjunctions.

**Method:** word-boundary match (not substring — see gotcha below) of
the CEFR-J headword against the lowercased `translation` array
(stripping a leading "to " for verbs). Substring matching produces
false gaps AND false coverage in both directions (`"cd"` matching
inside "anecdote", `"bra"` matching inside "brand"); always use
`\bword\b` regex, never `in` on raw strings.

Even with word-boundary matching, expect a real false-positive rate
(~25% in spot samples) from:
1. The concept exists but under a **different English gloss**
   (`Kühlschrank` → "refrigerator" doesn't match "fridge").
2. The concept exists only as part of a **compound or idiom**
   (`Langlauf` → "cross-country skiing" doesn't match plain "skiing";
   `schlimmstenfalls` → "in the worst case" doesn't match plain
   "worst"). These count as *partial* gaps — the compound is covered,
   the base word isn't — and need a judgment call on whether the plain
   form is worth adding separately.

Every automated hit must be manually verified against the source JSON
before action — do not bulk-apply the raw diff. Also manually check a
handful of near-universal words (yes/no pairs, basic greetings, etc.)
by hand even if the automated list doesn't surface them — the source
list won't catch every gap (`ja` was missing while `nein` existed;
never flagged by CEFR-J diffing since "yes" wasn't a clean word-
boundary miss).

**Filter out list-source noise before treating anything as a gap:**
proper nouns/names that ride along in frequency-style word lists
(person names, place names), region-specific items with low transfer
value (e.g. UK-currency terms), and words that only occur in a fixed
idiom in the source list (grammar metalanguage like "superlative").

### Two kinds of fixes, not one

- **Synonym gap** — the concept is already in the list, just under a
  narrower or different English word. Fix: add the missing gloss to
  the existing entry's `translation` array. No new entry, no new SRS
  card.
  - Example: `Kühlschrank` currently `["refrigerator"]` → add
    `"fridge"` to the array.
- **True lexical gap** — the German word itself doesn't exist in the
  list under any entry. Fix: create a new entry.
  - Example: `wollen` (to want) — confirmed absent under any entry,
    despite being a core modal verb.
  - Example: `Eltern` (parents) — confirmed absent; `Elternteil`
    ("parent, one of two") and compounds exist but not the plain
    plural.

**Multi-sense words get the classical dictionary treatment**: if one
English word covers two distinct German words (or vice versa), add
the gloss to *both* existing entries rather than picking one — e.g.
"racket" added to both `Schläger` (sports) and `Krach`/`Lärm` (noise);
"roughly" added to both `grob` (manner) and `ungefähr` (approximation).
Don't force a single winner when the language genuinely has two words.

**Capitalization gotcha specific to German**: lemma matching must be
case-sensitive when checking whether a word already exists, not just
when writing it. `Klettern` (noun, "the climbing") and `klettern`
(verb, "to climb") are different words sharing a spelling; a case-
insensitive existence check will wrongly treat the noun sense as
already covered by the verb entry (or vice versa). Same trap applies
to any German verb/deverbal-noun pair. Same trap also applies more
generally to two words differing only by case, like `morgen`
(tomorrow) vs `Morgen` (morning) — never assume a case-insensitive
match is the same word in German.

Sample sentences for any new entries are deferred to a later pass —
this section covers identifying and classifying the gap only.

### Status

German (DE): A1/A2 and B1 coverage passes complete (synonym-gap
additions + new entries applied directly to `de-en.json`, not yet
pushed). B2/C1/C2 still pending — raw candidate counts from the
CEFR-J diff: B2 647, C1 498, C2 673. Follow up later; expect the same
mix of synonym-gaps, new entries, and noise (proper nouns, mismatched
POS in source data, overly fine-grained comparative/regional forms)
seen in the A1/A2 and B1 passes.

Japanese (JA): separately, found and fixed 149 translation-formatting
bugs unrelated to coverage — parenthetical asides had been split
across `translation` array elements at a comma inside the
parentheses (e.g. `['origin (coordinates', 'starting point)']`
instead of one string), most likely from a naive comma-split during
import. Repaired via a paren-balance rejoin algorithm for the
mechanical cases (139) plus manual fixes for entries with a
genuinely missing closing paren (11, including one shared across two
homograph entries).

Swept all six vocab files for the same bug: confirmed present in DE
(207), ES (182), FR (214); absent in EN (too small a file to be
affected) and already-fixed JA. All 603 were mechanically repairable
with the same paren-balance algorithm — zero genuinely-truncated
stragglers this time, unlike the JA pass. ZH had one false-positive
hit (a `:)` emoticon miscounted as an unmatched paren) — left as-is,
not a real bug. All fixed directly in the vocab JSON files, not yet
pushed.

Spanish (ES): A1/A2 coverage pass complete. Smaller raw gap count
than DE/JA (152 vs 363 for JA) — consistent with ES/FR already being
more complete (they were used as the German cross-language reference
earlier). Still turned up striking basics missing outright: hola
(hello), adiós (goodbye), por qué (why), pero (but), mayo/julio
(2 of 12 months). Same lesson as DE/JA: don't assume a language's
coverage is solid at any level just because its category-tagging
stats look clean — tagging completeness and vocabulary completeness
are different things. One imprecision caught and fixed: `niebla`
(fog, noun) had initially gotten "foggy" added as a loose
adjective-sense synonym instead of a proper separate adjective entry
— corrected by removing "foggy" from `niebla` and creating
`neblinoso` (adj) → `["foggy"]`.

French (FR): A1/A2 coverage pass complete, 150 raw candidates. Worst
basic-word gap seen across any language so far — oui (yes), bonjour
(hello), au revoir (goodbye), quand (when), grand-père/grand-mère,
petit-déjeuner (breakfast), week-end were all completely absent.
Homograph handled: `imperméable` already existed as the adjective
"waterproof"; added a separate noun entry for "raincoat" rather than
merging senses, same pattern as the DE/ES `impermeable`-type cases.
Caught and fixed two of my own placeholder-typo entries mid-pass
(wrote a literal English string instead of the French headword for
"angrily" and "raincoat") before they were left in the file — worth
double-checking output after any large batch apply, self included.

**Follow-up (flagged by user, much later session)**: the CEFR-J
A1/A2 pass above missed something the content-word-frequency method
was never going to catch — French had essentially **zero prepositions
and zero conjunctions** in the entire 17,625-entry file before this
fix (`dans`, `avec`, `pour`, `à`, `de`, `en`, `et`, `mais`, `que`, `qui`
— all completely absent). Confirmed at the source: pulled
`vbvss199/Language-Learning-decks/french/french.json` directly and
verified all of the above are absent there too — the upstream
dataset's own POS breakdown is 10,607 nouns / 3,911 adjectives / 2,348
verbs and **0 prepositions / 0 conjunctions**, out of 17,580 entries.
Same `wordfreq`-style content-word-extraction root cause identified
earlier for DE/ES/JA (see the top of this doc), but far more severe
here — an entire grammatical category excluded wholesale rather than
scattered individual words. The CEFR-J word list used for the A1/A2
pass is itself overwhelmingly content words (nouns/verbs/adjectives),
so cross-referencing against it was never going to surface a
category-wide function-word gap — this needed a direct, deliberate
check of the closed class of prepositions/conjunctions, not a
frequency-list diff. **Worth checking DE/ES/JA/ZH for the same
category-wide gap before assuming the earlier CEFR-J passes caught
everything** — those passes had the identical blind spot.

Fixed: added 30 prepositions, 16 conjunctions, and 7 relative/
demonstrative pronouns (`qui`, `que`, `dont`, `lequel`, `quoi`, `ce`,
`cela`, `ceci`), plus a few adverbial connectors (`pourtant`,
`cependant`, `néanmoins`). 17,625 → 17,679 entries. One self-caught
error: briefly appended a French synonym note ("durant (formal)")
into `pendant`'s English translation array by mistake — not a valid
English gloss, removed immediately.

ZH not yet attempted.

**Follow-up confirms this was systemic, not French-specific.** Checked
DE and ES the same way: both had the identical near-total gap before
this fix. German had **2 prepositions, 5 conjunctions** in 20,352
entries — `und` (and), `oder` (or), `aber` (but), `dass` (that),
`weil` (because), `wenn` (if/when) were all completely absent, the
same category-wide absence pattern as French. Spanish had **1
preposition, 3 conjunctions** in 16,081 entries — `y` (and, the single
most basic Spanish conjunction), `si` (if), `porque` (because) were
all completely absent, arguably even more severe than the earlier
`hola`/`pero` finds since these are more fundamental words.

Method used to find these without redoing a full CEFR-J pass: cross-
referenced Chinese's conjunction set (`zh-en.json` has 81 conjunction
entries, a genuinely good native reference — Chinese vocab wasn't
built from the same source pipeline as DE/ES/FR) via English glosses
into DE/ES/JA, which surfaced the conjunction-side gaps quickly. No
vocab file had good native preposition coverage to use the same way —
Japanese also shows 0 (Japanese postpositional particles aren't
tagged `prep` in this schema) — so prepositions were checked against a
standard reference list directly instead, same approach as the French
fix.

Fixed: German +52 entries (36 prepositions, 21 conjunctions after the
fix, from 2/5 before). Spanish +33 entries (22 prepositions, 14
conjunctions after, from 1/3 before). Two Spanish homographs handled
correctly rather than merged: `sobre` (noun "envelope" *and* prep
"on/about") and `bajo` (adj "low/short" *and* prep "under") — same
separate-entry pattern as the `impermeable`/`imperméable` raincoat
cases. German: 20,352 → 20,404. Spanish: 16,081 → 16,114.

**Still open**: Japanese conjunctions (8 gaps found: `unless`,
`whereas`, `nor`, `in case`, `so that`, `as long as`, `whether`,
`despite the fact that` — much smaller gap than DE/ES since JA already
had 46 conjunctions natively) and Japanese/Chinese prepositions (no
native reference available, would need the standard-list approach).
Not yet attempted.

A1/A2 coverage pass complete for Japanese (CEFR-J diff against
`translation` glosses, same method as German). Notably higher
false-gap rate than German from JLPT gloss phrasing (e.g. "fall"
vs "autumn", "ski" vs "skiing") — always verify against the actual
JSON, not just the raw diff. Also found genuine basics missing
outright (りんご/apple, 週末/weekend, サッカー/soccer,
インターネット/internet) that a JLPT N5 list would normally be
expected to cover — worth keeping in mind that this vocab file's
coverage assumptions shouldn't be taken for granted at any level.
B1–C2 not yet attempted for Japanese.

## Known data-source limitations

- **Japanese JLPT level distribution** (N5:736, N4:679, N3:2112, N2:1736,
  N1:2659) has N2 < N3, which looks like an anomaly but isn't a pipeline
  bug: JEES has never published an official JLPT vocabulary list for any
  level, and the elzup/jlpt-word-list (MIT) source we use — itself
  derived from tanos.co.uk via chyyran/jlpt-anki-decks — inherits
  tanos's own documented estimation problem: N3 was added in the 2010
  reform to ease the old-JLPT-3→2 jump, so N2/N3 boundary words are a
  third-party estimate, not a real spec. Source CSVs literally tag
  ambiguous N3 words `JLPT_2 JLPT_3`. Verified our extraction is
  faithful to the raw source (N5:717→736, N4:667→679, N3:2138→2112,
  N2:1747→1736, N1:2698→2659 raw vs ours — small diffs from
  vulgar-filter/dedup only). No alternative source fixes this since no
  official list exists anywhere; not worth chasing a "better" list for
  this reason alone.
