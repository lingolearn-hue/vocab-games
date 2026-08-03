#!/usr/bin/env python3
"""
audit_vocab.py — formalized vocab/example-sentence data-quality audit.

Two things happen here, matching the two-part design this was asked for:

  1. SCREENING: for every word in every language/level, check whether the
     structural fields we depend on elsewhere in the app actually exist —
     pos, categories, a translation, a reading (where the language needs
     one), an example sentence, a starter mnemonic. This is a per-entry
     pass/fail check, not a judgment about correctness (that needs a human
     — see the chat-history "meaning-accuracy audit" for German/Japanese/
     Chinese, which is a different, harder problem than "does the field
     exist").

  2. STATISTICS: aggregate those per-entry results into per-language,
     per-level coverage percentages, plus a few sanity-check counts that
     tend to catch real bugs (e.g. the Japanese example-sentence key
     mismatch found earlier this session would show up here as "0% has
     example" for Japanese before the fix, and 100% after).

Output: audit_report.json (the raw numbers, for anything else that wants
to consume them) and audit_report.html (a self-contained, sortable/
filterable table — see generate_audit_html.py, or just re-run this file,
which calls it automatically).

Usage:
    python3 tools/audit_vocab.py
    # writes tools/audit_report.json and tools/audit_report.html
"""
import json
import collections
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
VOCAB_DIR = REPO_ROOT / 'public' / 'vocab'
EXAMPLES_DIR = REPO_ROOT / 'public' / 'examples'
MNEMONICS_DIR = REPO_ROOT / 'public' / 'mnemonics'
OUT_JSON = Path(__file__).resolve().parent / 'audit_report.json'

LEVEL_ORDER = {
    'zh': ['HSK1', 'HSK2', 'HSK3', 'HSK4', 'HSK5', 'HSK6', 'HSK7'],
    'ja': ['N5', 'N4', 'N3', 'N2', 'N1'],
    'de': ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    'es': ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    'fr': ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    'en': ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
}
LANG_NAMES = {'de': 'German', 'ja': 'Japanese', 'zh': 'Chinese', 'es': 'Spanish', 'fr': 'French', 'en': 'English'}
# Languages whose vocab a missing 'reading' field is actually a data gap
# (script isn't Latin, so a reading/pronunciation aid matters). Everyone
# else's 'reading' field is optional/rare by design, not a gap.
READING_EXPECTED = {'ja', 'zh'}


def load_json(path):
    if not path.exists():
        return None
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def example_key(lemma, pos):
    return f"{(lemma or '').strip().lower()}::{pos or 'unknown'}"


def has_example(sentences, lemma, pos):
    # Mirrors engine/examples.js's real fallback logic exactly — see that
    # file's docstring for why the ::unknown fallback matters (Japanese's
    # sentences predate its POS tagging pass).
    return example_key(lemma, pos) in sentences or example_key(lemma, None) in sentences


def audit_language(lang):
    vocab = load_json(VOCAB_DIR / f'{lang}-en.json')
    if vocab is None:
        return None

    keys = vocab['keys']
    entries = vocab['entries']
    idx = {k: keys.index(k) for k in keys}

    examples_doc = load_json(EXAMPLES_DIR / f'{lang}-en.json') or {}
    sentences = examples_doc.get('sentences', {})

    mnemonics_doc = load_json(MNEMONICS_DIR / f'{lang}-en.json') or {}
    mnemonics = {k for k in mnemonics_doc if not k.startswith('_')}

    by_level = collections.defaultdict(lambda: {
        'total': 0,
        'pos_filled': 0,
        'categories_filled': 0,
        'concepts_only': 0,
        'vulgar_only': 0,
        'has_example': 0,
        'has_mnemonic': 0,
        'translation_missing': 0,
        'reading_missing': 0,
        'pos_values': collections.Counter(),
        'category_values': collections.Counter(),
    })

    for e in entries:
        level = e[idx['level']] or 'unknown'
        rec = by_level[level]
        rec['total'] += 1

        entry_text = e[idx['entry']]
        pos = e[idx.get('pos', -1)] if 'pos' in idx else None
        cats = e[idx['categories']] if 'categories' in idx else []
        translation = e[idx['translation']] if 'translation' in idx else []
        reading = e[idx['reading']] if 'reading' in idx else None

        if pos:
            rec['pos_filled'] += 1
            rec['pos_values'][pos] += 1
        if cats:
            rec['categories_filled'] += 1
            for c in cats:
                rec['category_values'][c] += 1
            if cats == ['vulgar']:
                rec['vulgar_only'] += 1
            if cats == ['concepts']:
                rec['concepts_only'] += 1
        if not translation or not any(t and t.strip() for t in translation):
            rec['translation_missing'] += 1
        if lang in READING_EXPECTED and not reading:
            rec['reading_missing'] += 1
        if has_example(sentences, entry_text, pos):
            rec['has_example'] += 1
        if entry_text in mnemonics:
            rec['has_mnemonic'] += 1

    return {
        'levels': dict(by_level),
        'mnemonics_file_exists': (MNEMONICS_DIR / f'{lang}-en.json').exists(),
        'examples_file_exists': (EXAMPLES_DIR / f'{lang}-en.json').exists(),
    }


def sort_levels(lang, levels):
    order = LEVEL_ORDER.get(lang, [])

    def key(lvl):
        return order.index(lvl) if lvl in order else len(order)
    return sorted(levels, key=key)


def pct(n, total):
    return round(100 * n / total, 1) if total else None


def build_report():
    rows = []
    for lang in LEVEL_ORDER:
        lang_data = audit_language(lang)
        if lang_data is None:
            continue
        levels = lang_data['levels']
        for level in sort_levels(lang, levels.keys()):
            rec = levels[level]
            total = rec['total']
            rows.append({
                'language': LANG_NAMES.get(lang, lang),
                'lang_code': lang,
                'level': level,
                'words': total,
                'pos_pct': pct(rec['pos_filled'], total),
                'categories_pct': pct(rec['categories_filled'], total),
                'concepts_pct': pct(rec['concepts_only'], total),
                'examples_pct': pct(rec['has_example'], total),
                'mnemonics_pct': pct(rec['has_mnemonic'], total),
                'translation_missing': rec['translation_missing'],
                'reading_missing': rec['reading_missing'] if lang in READING_EXPECTED else None,
                'vulgar_only': rec['vulgar_only'],
                'distinct_pos': len(rec['pos_values']),
                'distinct_categories': len(rec['category_values']),
                'mnemonics_file_exists': lang_data['mnemonics_file_exists'],
                'examples_file_exists': lang_data['examples_file_exists'],
            })
    return rows


def print_summary(rows):
    print(f"{'Lang':<10}{'Level':<8}{'Words':>7}{'POS%':>7}{'Cat%':>7}{'Ex%':>7}{'Mnem%':>7}")
    for r in rows:
        print(f"{r['language']:<10}{r['level']:<8}{r['words']:>7}"
              f"{r['pos_pct'] if r['pos_pct'] is not None else '-':>7}"
              f"{r['categories_pct'] if r['categories_pct'] is not None else '-':>7}"
              f"{r['examples_pct'] if r['examples_pct'] is not None else '-':>7}"
              f"{r['mnemonics_pct'] if r['mnemonics_pct'] is not None else '-':>7}")

    total_words = sum(r['words'] for r in rows)
    print(f"\nTotal words audited: {total_words}")
    missing_translation = sum(r['translation_missing'] for r in rows)
    if missing_translation:
        print(f"⚠ {missing_translation} entries with a missing/empty translation — real data bug, check these directly")
    no_examples_file = [r['language'] for r in rows if not r['examples_file_exists']]
    if no_examples_file:
        print(f"⚠ No examples file at all for: {', '.join(sorted(set(no_examples_file)))}")
    no_mnemonics_file = [r['language'] for r in rows if not r['mnemonics_file_exists']]
    if no_mnemonics_file:
        print(f"ℹ No mnemonics seed file for: {', '.join(sorted(set(no_mnemonics_file)))} (mnemonics are a small starter seed, not meant to be comprehensive — this is informational, not a gap)")


if __name__ == '__main__':
    rows = build_report()
    OUT_JSON.write_text(json.dumps(rows, ensure_ascii=False, indent=2))
    print(f"Wrote {OUT_JSON}\n")
    print_summary(rows)

    try:
        from generate_audit_html import generate
        html_path = generate(rows)
        print(f"\nWrote {html_path}")
    except ImportError:
        print("\n(generate_audit_html.py not found — run it separately to produce the HTML report)")
