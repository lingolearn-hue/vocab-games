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
