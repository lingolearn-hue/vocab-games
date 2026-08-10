"""
Re-run classify() against every word currently tagged ['concepts'] and
update it if a newer keyword/scrub addition now gives a better answer.

Skips any word already present in tools/review-status/{lang}-review.json,
since those may include deliberate manual overrides (e.g. a word whose
primary translation IS an ambiguous keyword, where no scrub phrase can
fix it without breaking genuine matches elsewhere) that would otherwise
get silently clobbered back to whatever classify() currently says.

Usage: python3 tools/resweep_concepts.py
"""
import json
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
import tag_categories as tc

LANG_FILES = {
    'ja-en.json': 'ja-review.json',
    'de-en.json': 'de-review.json',
    'zh-en.json': 'zh-review.json',
    'es-en.json': 'es-review.json',
    'fr-en.json': 'fr-review.json',
}

VOCAB_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'vocab')
REVIEW_DIR = os.path.join(os.path.dirname(__file__), 'review-status')

for vocab_file, review_file in LANG_FILES.items():
    vocab_path = os.path.join(VOCAB_DIR, vocab_file)
    review_path = os.path.join(REVIEW_DIR, review_file)

    d = json.load(open(vocab_path))
    keys = d['keys']
    ei, ti, pi, ci = (keys.index('entry'), keys.index('translation'),
                       keys.index('pos'), keys.index('categories'))

    try:
        review = json.load(open(review_path))
    except FileNotFoundError:
        review = {}

    fixed, skipped = 0, 0
    for r in d['entries']:
        if r[ci] != ['concepts']:
            continue
        review_key = f'{r[ei]}::{r[pi]}'
        if review_key in review:
            skipped += 1
            continue
        new = tc.classify(r[ti], r[pi])
        if new != ['concepts']:
            r[ci] = new
            fixed += 1

    if fixed:
        json.dump(d, open(vocab_path, 'w'), ensure_ascii=False)
    print(f'{vocab_file}: reclassified {fixed}, skipped {skipped} (already reviewed)')
