"""
generate_reader_surface_forms.py — Lemmatize Graded Reader passages
=====================================================================
Scans public/reader/{lang}-en.json passages, lemmatizes their text, and
records surface→lemma pairs for any inflected word whose dictionary form
is an actual vocab entry — so TextWithLookup can highlight/look up "aßen"
via "essen", "Kindern" via "Kind", etc. in the Graded Reader, the same way
Adventure Mode already does for campaign chapters (see campaign/lemmatize.py
and campaign/convert.py --lemmatize).

Only German and Japanese are wired in for now (spaCy's de_core_news_sm and
fugashi respectively) — this repo's other languages either don't inflect
enough to be worth it (Chinese/English) or don't have a working lemmatizer
installed in this environment yet (fr/es spaCy models untested).

Output: public/reader/surface-forms.json → { "de": {...}, "ja": {...} }
Consumed by GradedReader.jsx, passed straight through to TextWithLookup's
existing `surfaceForms` prop (same format Adventure chapters already use).

Usage:
    python3 tools/generate_reader_surface_forms.py
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'public' / 'campaign'))
from lemmatize import lemmatize_text  # noqa: E402

LANGS = ['de', 'ja']


def load_vocab_entries(lang):
    path = ROOT / 'public' / 'vocab' / f'{lang}-en.json'
    data = json.loads(path.read_text(encoding='utf-8'))
    idx = data['keys'].index('entry')
    return {row[idx] for row in data['entries'] if row[idx]}


def load_passage_text(lang):
    path = ROOT / 'public' / 'reader' / f'{lang}-en.json'
    if not path.exists():
        return ''
    data = json.loads(path.read_text(encoding='utf-8'))
    return '\n'.join(p.get('text', '') for p in data.get('passages', []))


def main():
    result = {}
    for lang in LANGS:
        print(f'Lemmatizing Graded Reader passages [{lang}]…')
        vocab = load_vocab_entries(lang)
        text = load_passage_text(lang)
        if not text.strip():
            print(f'  ⚠ no passages found for {lang}, skipping')
            continue
        pairs = lemmatize_text(text, lang, vocab_entries=vocab)
        if lang == 'ja':
            # Single-kana "surface forms" are almost always tokenizer noise —
            # a conjugation ending or particle fragment that happens to share
            # pronunciation with an unrelated one-kana vocab entry (e.g. "い"
            # matching 居る, "き" matching 来る) rather than a genuine word
            # boundary. Dropping length-1 matches removes the worst of this;
            # some ambiguity remains for length-2+ matches on kana-only text
            # where fugashi's segmentation doesn't match a natural reading
            # (e.g. がくせい "student" mis-split into がく+せい) — not fully
            # solved here, tracked in TODO.
            before = len(pairs)
            pairs = {k: v for k, v in pairs.items() if len(k) >= 2}
            dropped = before - len(pairs)
            if dropped:
                print(f'  (dropped {dropped} single-kana noise matches)')
        if pairs:
            result[lang] = pairs
            print(f'  → {len(pairs)} surface forms')
        else:
            print(f'  ⚠ no surface forms produced (model missing or no matches)')

    out_path = ROOT / 'public' / 'reader' / 'surface-forms.json'
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'\nWrote {out_path}')


if __name__ == '__main__':
    main()
