#!/usr/bin/env python3
"""
apply_llm_categories.py — writes LLM-reviewed category decisions back into
a vocab JSON file. Companion to extract_for_llm_review.py.

Decisions are supplied as a JSON-with-comments file: a flat object mapping
the exact `entry` text to its new categories array, with an optional
trailing `// XX` comment per line noting the reasoning basis (T=clear from
the Target word itself, G=leaned on the English Gloss, C=Compound/context
reasoning) and confidence (H/M/L) — e.g. `// TH` = target-word-based, high
confidence. Comments are stripped before parsing since plain JSON doesn't
support them; this file format is a convenience for chat review, not
something kept in the repo long-term.

    {
      "Werk": ["work"],           // TH
      "laufen": ["sports"],       // GM
      "Katze": ["animals"]        // TH
    }

Usage:
    python3 tools/apply_llm_categories.py de decisions.json
    python3 tools/apply_llm_categories.py de decisions.json --level A1   # optional safety check
"""
import argparse
import json
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
VOCAB_DIR = REPO_ROOT / 'public' / 'vocab'


def strip_comments(text):
    # Removes a trailing // comment from each line. Naive (doesn't account
    # for // inside a string value), but safe here since none of our
    # category names or dictionary keys contain "//".
    return re.sub(r'//[^\n]*', '', text)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('lang')
    ap.add_argument('decisions_json')
    ap.add_argument('--level', default=None, help='Only apply to entries at this level (safety check)')
    args = ap.parse_args()

    vocab_path = VOCAB_DIR / f'{args.lang}-en.json'
    d = json.load(open(vocab_path, encoding='utf-8'))
    keys = d['keys']
    entries = d['entries']
    idx_entry = keys.index('entry')
    idx_cat = keys.index('categories')
    idx_level = keys.index('level')

    decisions = json.loads(strip_comments(Path(args.decisions_json).read_text(encoding='utf-8')))

    applied = 0
    skipped_level = 0
    not_found = set(decisions.keys())
    for e in entries:
        entry_text = e[idx_entry]
        if entry_text in decisions:
            if args.level and e[idx_level] != args.level:
                skipped_level += 1
                continue
            e[idx_cat] = decisions[entry_text]
            applied += 1
            not_found.discard(entry_text)

    json.dump(d, open(vocab_path, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f"Applied: {applied}")
    if skipped_level:
        print(f"Skipped (wrong level, --level={args.level}): {skipped_level}")
    if not_found:
        print(f"Not found in {vocab_path.name}: {len(not_found)} — {sorted(not_found)[:10]}{'...' if len(not_found) > 10 else ''}")


if __name__ == '__main__':
    main()
