"""
Sentence-count congruence checker for Graded Reader passages.

Splits each language's text into sentences and compares counts against
English (the benchmark language — see AUTHORING-TEXTS.md). Handles the
known quote/punctuation-adjacency false-positive classes documented
there:

- Latin scripts (en/de/es): a quote mark sitting immediately before a
  sentence-ending period suppresses the split (e.g. "do.' Only..." in
  English). Not fixed here — rare enough that cataloguing exceptions in
  AUTHORING-TEXTS.md has been sufficient so far.
- French: closing guillemets are preceded by a space in French
  typography ("...grandes ? », dit..."), which fires a false split at
  the "?"/"!" before the closing »". Fixed here by merging any fragment
  that starts with "»" into the previous one.
- Japanese/Chinese: closing quote marks (」』) come AFTER the
  sentence-ending punctuation rather than before it, the opposite of
  the Latin-script case, causing the same kind of false split. Fixed
  here the same way, merging fragments starting with 」/』.

Usage: python3 tools/check_reader_congruence.py [lang-code ...]
  With no args, checks every public/reader/{lang}-en.json file that
  exists. Prints per-passage, per-paragraph sentence counts and flags
  any that don't match English.
"""
import json
import re
import sys
import os
import glob

READER_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'reader')

CLOSING_CHARS = {'fr': '»', 'ja': '」』', 'zh': '」』'}


def sentence_split(text, lang):
    if lang in ('ja', 'zh'):
        raw = [p for p in re.split(r'(?<=[。！？])', text) if p.strip()]
    else:
        raw = [p for p in re.split(r'(?<=[.!?])\s+', text) if p.strip()]
    closers = CLOSING_CHARS.get(lang)
    if not closers:
        return raw
    merged = []
    for frag in raw:
        stripped = frag.lstrip()
        if merged and stripped[:1] in closers:
            merged[-1] = merged[-1] + (' ' if lang == 'fr' else '') + frag
        else:
            merged.append(frag)
    return merged


def load_passages(lang):
    path = os.path.join(READER_DIR, f'{lang}-en.json')
    if not os.path.exists(path):
        return {}
    d = json.load(open(path))
    return {p['id'].split('-', 1)[1]: p for p in d['passages']}


def main():
    requested = sys.argv[1:]
    if requested:
        langs = requested
    else:
        langs = [os.path.basename(f).split('-en.json')[0]
                  for f in glob.glob(os.path.join(READER_DIR, '*-en.json'))]

    if 'en' not in langs:
        langs = ['en'] + langs

    data = {lang: load_passages(lang) for lang in langs}
    en = data['en']

    mismatches = 0
    for pid, en_p in en.items():
        en_paras = en_p['text'].split('\n\n')
        en_counts = [len(sentence_split(p, 'en')) for p in en_paras]
        for lang in langs:
            if lang == 'en':
                continue
            p = data[lang].get(pid)
            if p is None:
                print(f'{pid}: MISSING in {lang}')
                mismatches += 1
                continue
            paras = p['text'].split('\n\n')
            if len(paras) != len(en_paras):
                print(f'{pid} [{lang}]: paragraph count mismatch '
                      f'({len(paras)} vs en {len(en_paras)})')
                mismatches += 1
                continue
            counts = [len(sentence_split(para, lang)) for para in paras]
            if counts != en_counts:
                print(f'{pid} [{lang}]: {counts} vs en {en_counts}')
                mismatches += 1

    print(f'\n{"All congruent." if mismatches == 0 else f"{mismatches} mismatch(es) found."}')


if __name__ == '__main__':
    main()
