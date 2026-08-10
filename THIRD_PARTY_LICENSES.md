# Third-Party Licenses

This project uses the following third-party resources. Their licenses are noted below.
The project's own license is in `LICENSE`.

---

## Vocabulary Data

### Chinese (Mandarin) — DrKameleon Complete HSK Vocabulary
- **Source**: https://github.com/drkameleon/complete-hsk-vocabulary
- **Author**: Yanis Zafirópulos (drkameleon)
- **License**: MIT
- **Used for**: Chinese vocabulary lists, HSK levels 1–6/9
- **Note**: When using this dataset, keep this attribution notice.

### Japanese — jlpt-word-list
- **Source**: https://github.com/elzup/jlpt-word-list
- **Author**: elzup
- **License**: MIT
- **Used for**: Japanese vocabulary data (`public/vocab/ja-en.json`)

### Language Learning Decks
- **Source**: https://github.com/vbvss199/Language-Learning-decks
- **Copyright**: (c) 2025 GENERAL NEURO
- **License**: MIT
- **Used for**: vocabulary deck data
- **Note**: carried over from the original LICENSE file — kept out of caution;
  confirm this dataset is still in active use before the next major release,
  since no other reference to it turned up in code or docs during this merge.

---

## Vocabulary Enrichment Data (categories, gender, conjugation)

These were used as fill-only sources to populate specific fields on top of
the vocabulary lists above — not as vocabulary sources themselves. Each
entry below states exactly what data was extracted and where it landed.

### French gender — Lexique383 (via the `pylexique` PyPI package)
- **Source**: http://www.lexique.org — New, B., Pallier, C., Ferrand, L., &
  Matos, R. Distributed for research use; see lexique.org for current terms.
- **Used for**: filling the `gender` field (`m`/`f`) in
  `public/vocab/fr-en.json` for ~1,735 nouns whose gender was previously an
  unresolved elided-article placeholder (`l'`). Only words with a single,
  unambiguous gender in Lexique383's NOM entries were auto-filled; ambiguous
  or unmatched words were left for manual review (see `TODO.md`).

### Spanish gender — doozan/spanish_data (Wiktionary-derived)
- **Source**: https://github.com/doozan/spanish_data
- **License**: CC-BY-4.0 (data itself is CC-BY-SA per Wiktionary's own
  license, re-packaged here under CC-BY-4.0 by the repo maintainer)
- **Used for**: filling the `gender` field (`m`/`f`/`epicene`) in
  `public/vocab/es-en.json`, which had 0% gender populated before this pass.
  ~9,000 nouns filled from the dataset's `g:` (gender) field on `pos: n`
  entries, restricted to words with exactly one gender value to avoid
  homograph collisions (e.g. "radio" = radius (m) vs. the radio (f)).
  A further ~250 words were filled by hand using standard Spanish suffix
  rules (`-ista`, `-ante`, `-ente` person-nouns are reliably epicene) —
  original analysis, not sourced from this dataset.

### German verb conjugation — german-verbs-database (Wiktionary-derived)
- **Source**: https://github.com/viorelsfetea/german-verbs-database
- **License**: no explicit license file in the repo; the underlying verb
  data is drawn from Wiktionary (wiktionary.org), which is CC-BY-SA. Treat
  accordingly if redistributing.
- **Used for**: `public/conjugations/de.json` (lazy-loaded, not part of the
  main vocab file — see `src/engine/conjugations.js`), populated with each
  verb's 3rd-person-singular present tense, Präteritum, Partizip II, and
  haben/sein auxiliary. Covers 2,758 of 3,136 German verbs in
  `public/vocab/de-en.json` (88.0%); `sein` itself was absent from the
  source and was hand-supplied, since its principal parts are fixed and
  universally known.

---

## JavaScript Dependencies

All npm dependencies are MIT licensed unless noted otherwise.
See `package.json` for the full dependency list.
Run `npm list --depth=0` for installed versions.

Key dependencies:
- **React** — MIT — https://reactjs.org
- **Vite** — MIT — https://vitejs.dev

---

## Notes

- Starter mnemonics for Chinese and Japanese were written specifically for this project and are original content.
- Grammar pattern data (`public/grammar/`) is original content.
- Reader passages and dialogue scripts (`public/reader/`, `public/dialogues/`) are original content.
