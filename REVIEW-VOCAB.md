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
