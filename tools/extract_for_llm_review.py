#!/usr/bin/env python3
"""
extract_for_llm_review.py — pulls the words that need reclassification (no
category at all, or currently sitting in one of the Abstract-parent leaves:
verbs/function_words/quantity/concepts/grammar) for a given language+level,
and prints them as a numbered list ready to paste into an LLM review pass.

This is the "Option A" pipeline: no API call, no cost — Claude reads this
list directly in conversation and reasons about each word's actual meaning
(reading the target-language word itself, not just pattern-matching the
English gloss), then apply_llm_categories.py writes the decisions back.

Usage:
    python3 tools/extract_for_llm_review.py de A1
    python3 tools/extract_for_llm_review.py de A1 --start 0 --count 100
"""
import argparse
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
VOCAB_DIR = REPO_ROOT / 'public' / 'vocab'

ABSTRACT_LEAVES = {'verbs', 'function_words', 'quantity', 'concepts', 'grammar'}


def load_vocab(lang):
    path = VOCAB_DIR / f'{lang}-en.json'
    return json.load(open(path, encoding='utf-8'))


def needs_review(cats):
    return not cats or set(cats) & ABSTRACT_LEAVES


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('lang')
    ap.add_argument('level')
    ap.add_argument('--start', type=int, default=0)
    ap.add_argument('--count', type=int, default=150)
    args = ap.parse_args()

    d = load_vocab(args.lang)
    keys = d['keys']
    entries = d['entries']
    idx = {k: keys.index(k) for k in keys}

    candidates = [e for e in entries if e[idx['level']] == args.level and needs_review(e[idx['categories']])]
    print(f"# {args.lang} {args.level}: {len(candidates)} words need review (untagged or Abstract-parent)")
    batch = candidates[args.start:args.start + args.count]
    print(f"# Showing {args.start}-{args.start + len(batch)} of {len(candidates)}\n")

    for i, e in enumerate(batch, start=args.start):
        entry = e[idx['entry']]
        reading = e[idx.get('reading', -1)] if 'reading' in idx else None
        pos = e[idx.get('pos', -1)] if 'pos' in idx else None
        translation = e[idx['translation']]
        old_cats = e[idx['categories']]
        reading_str = f" ({reading})" if reading else ""
        print(f"{i}\t{entry}{reading_str}\t[{pos}]\t{' · '.join(translation)}\t(was: {old_cats})")


if __name__ == '__main__':
    main()
