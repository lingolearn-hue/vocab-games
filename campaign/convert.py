#!/usr/bin/env python3
"""
TSV → JSON Campaign Converter
==============================
Converts campaign TSV files to the JSON format consumed by the app.

Usage:
    python3 convert.py campaign_A0101.tsv
    python3 convert.py *.tsv
    python3 convert.py --all          (converts all *.tsv in same folder)

Output:
    campaign_A0101.json  (same folder as input, same base name)

Lemmatization (optional, requires spaCy models):
    python3 convert.py campaign_A0101.tsv --lemmatize
    python3 convert.py --all --lemmatize

    Install models once:
        pip install spacy fugashi unidic-lite jieba
        python -m spacy download de_core_news_sm
        python -m spacy download fr_core_news_sm
        python -m spacy download es_core_news_sm
        python -m spacy download ja_core_news_sm
        python -m spacy download zh_core_web_sm

TSV Format:
    See FORMAT_SPEC.html for full documentation.
    Key directives: @chapter, @artifact, @story_intro, @story_outro,
                    @section, @vocab, @grammar, @passage, @passage_line
    Dialogue rows:  id  speaker  cmd  en  zh  ja  de  es
"""

import json
import re
import sys
import os
import glob

# Optional lemmatization — imported lazily to avoid hard dependency
_lemmatize_fn = None
def _get_lemmatize():
    global _lemmatize_fn
    if _lemmatize_fn is None:
        try:
            from lemmatize import lemmatize_section
            _lemmatize_fn = lemmatize_section
        except ImportError:
            _lemmatize_fn = lambda *a, **k: {}
    return _lemmatize_fn

LANG_ORDER = ['en', 'zh', 'ja', 'de', 'es']  # full known set; actual per-file order/subset comes from @columns


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_lang(cells, start, active_langs=None):
    """
    Extract a {lang: text} dict from cells starting at index `start`.
    `active_langs` is the ordered list of languages actually present in this file
    (derived from the @columns directive). Cells beyond the declared languages,
    or missing entirely, are left out (not defaulted to the wrong language).
    Any language in LANG_ORDER not present in active_langs is set to '' so
    downstream code can still safely look up data[lang] and fall back to .en.
    """
    langs = active_langs or LANG_ORDER
    result = {l: '' for l in LANG_ORDER}
    for i, l in enumerate(langs):
        if start + i < len(cells):
            result[l] = cells[start + i].strip()
    return result


def split_id(id_):
    """'adv010101-04a' → (prefix, num, suffix)  e.g. ('adv010101', '04', 'a')"""
    dash = id_.rfind('-')
    if dash < 0:
        return id_, '0', ''
    local = id_[dash + 1:]
    m = re.match(r'^(\d+)([a-z]*)$', local)
    return id_[:dash], (m.group(1) if m else local), (m.group(2) if m else '')


def format_speaker(s):
    return s.replace('_', ' ').replace('-', ' ').title() if s else ''


# ── Dialogue builder ──────────────────────────────────────────────────────────

def build_dialogue(prefix, rows):
    """Convert a flat list of TSV rows with the same prefix into a dialogue object."""

    # Sort by line number then suffix
    rows.sort(key=lambda r: (int(split_id(r['id'])[1]), split_id(r['id'])[2]))

    # Group by line number
    by_num = {}
    for r in rows:
        _, num, suf = split_id(r['id'])
        by_num.setdefault(num, []).append({**r, 'suffix': suf})

    nums = sorted(by_num.keys(), key=lambda x: int(x))
    turns = []
    skip = set()

    for ni, num in enumerate(nums):
        if num in skip:
            continue
        group = by_num[num]

        # ── Question ─────────────────────────────────────────────────────────
        q_row = next(
            (r for r in group if r['speaker'] == 'question' or r['suffix'] == 'q'),
            None
        )
        if q_row:
            next_num = nums[ni + 1] if ni + 1 < len(nums) else None
            opt_rows = [r for r in by_num.get(next_num, [])
                        if r['speaker'] == 'option'] if next_num else []
            turns.append({
                'type': 'question',
                'prompt': {l: q_row.get(l, '') for l in LANG_ORDER},
                'options': [{
                    'text': {l: r.get(l, '') for l in LANG_ORDER},
                    'correct': r.get('cmd', '') == 'correct',
                } for r in opt_rows]
            })
            if next_num:
                skip.add(next_num)
            continue

        # ── Already-consumed options ──────────────────────────────────────────
        if all(r['speaker'] == 'option' for r in group):
            continue

        # ── Player choice (multiple player rows, different suffixes) ──────────
        player_rows = [r for r in group if r['speaker'] == 'player' and r['suffix']]
        if len(player_rows) > 1:
            next_num = nums[ni + 1] if ni + 1 < len(nums) else None
            resp_rows = by_num.get(next_num, []) if next_num else []
            turns.append({
                'type': 'choice',
                'options': [{
                    'suffix': r['suffix'],
                    'text': {l: r.get(l, '') for l in LANG_ORDER},
                    'response': next(
                        ({l: rr.get(l, '') for l in LANG_ORDER}
                         for rr in resp_rows if rr['suffix'] == r['suffix']),
                        None
                    ),
                } for r in player_rows]
            })
            if next_num and any(
                r['suffix'] in [p['suffix'] for p in player_rows]
                for r in resp_rows
            ):
                skip.add(next_num)
            continue

        # ── Single line ───────────────────────────────────────────────────────
        r = group[0]
        turns.append({
            'type': 'line',
            'speaker': r['speaker'],
            'text': {l: r.get(l, '') for l in LANG_ORDER},
        })

    if not turns:
        return None

    dl_digits = re.sub(r'\D', '', prefix)
    dl_num = int(dl_digits[-2:]) if dl_digits else 1
    return {
        'id': prefix,
        'dialogueNum': dl_num,
        'turns': turns,
    }


# ── TSV parser ────────────────────────────────────────────────────────────────

def parse_tsv(tsv_text):
    """Parse a full TSV file and return { meta, sections }."""

    lines = tsv_text.split('\n')
    columns = None
    active_langs = LANG_ORDER  # ordered list of languages actually used in this file; set from @columns
    out = {'meta': {}, 'sections': []}

    current_section = None
    current_passage = None
    current_dl_rows = []
    current_dl_prefix = None

    def flush_dialogue():
        nonlocal current_dl_rows, current_dl_prefix
        if current_dl_rows and current_section is not None:
            dl = build_dialogue(current_dl_prefix, current_dl_rows)
            if dl:
                current_section['dialogues'].append(dl)
        current_dl_rows.clear()
        current_dl_prefix = None

    def flush_passage():
        nonlocal current_passage
        if current_passage and current_passage['lines'] and current_section is not None:
            current_section['passages'].append({
                'num':   current_passage['num'],
                'title': current_passage['title'],
                'lines': current_passage['lines'],
            })
        current_passage = None

    def ensure_section():
        nonlocal current_section
        if current_section is None:
            current_section = {
                'num': '01', 'title': {}, 'vocab': [],
                'grammar': [], 'dialogues': [], 'passages': [],
            }
            out['sections'].append(current_section)

    for raw in lines:
        raw = raw.rstrip()
        if not raw or raw.startswith('#'):
            continue
        cells = raw.split('\t')
        tag = cells[0].strip()

        # ── Directives ────────────────────────────────────────────────────────

        if tag == '@columns':
            columns = {n.strip(): i for i, n in enumerate(cells[1:])}
            non_lang = {'id', 'speaker', 'cmd'}
            active_langs = [l for l in sorted(columns, key=columns.get) if l not in non_lang and l in LANG_ORDER]
            if not active_langs:
                active_langs = LANG_ORDER

        elif tag == '@chapter':
            out['meta']['chapterNum']   = cells[1].strip() if len(cells) > 1 else ''
            out['meta']['chapterTitle'] = get_lang(cells, 2, active_langs)
            level_idx = 2 + len(active_langs)
            out['meta']['level']        = cells[level_idx].strip() if len(cells) > level_idx else ''

        elif tag == '@artifact':
            out['meta']['artifact'] = {
                'icon':    cells[1].strip() if len(cells) > 1 else '',
                'name':    cells[2].strip() if len(cells) > 2 else '',
                'grammar': cells[3].strip() if len(cells) > 3 else '',
            }

        elif tag == '@story_intro':
            out['meta']['storyIntro'] = get_lang(cells, 1, active_langs)

        elif tag == '@story_outro':
            out['meta']['storyOutro'] = get_lang(cells, 1, active_langs)

        elif tag == '@section':
            flush_dialogue()
            flush_passage()
            current_section = {
                'num':       cells[1].strip() if len(cells) > 1 else '',
                'title':     get_lang(cells, 2, active_langs),
                'vocab':     [],
                'grammar':   [],
                'dialogues': [],
                'passages':  [],
            }
            out['sections'].append(current_section)

        elif tag == '@vocab':
            ensure_section()
            current_section['vocab'] = [c.strip() for c in cells[1:] if c.strip()]

        elif tag == '@grammar':
            ensure_section()
            current_section['grammar'] = [c.strip() for c in cells[1:] if c.strip()]

        elif tag == '@passage':
            flush_dialogue()
            flush_passage()
            current_passage = {
                'num':   cells[1].strip() if len(cells) > 1 else '',
                'title': get_lang(cells, 2, active_langs),
                'lines': [],
            }

        elif tag == '@passage_line':
            if current_passage is not None:
                current_passage['lines'].append(get_lang(cells, 1, active_langs))

        # ── Dialogue row ──────────────────────────────────────────────────────

        elif columns and cells[0].strip():
            id_col  = columns.get('id',      0)
            spk_col = columns.get('speaker', 1)
            cmd_col = columns.get('cmd',     2)

            id_      = cells[id_col].strip()  if id_col  < len(cells) else ''
            speaker  = cells[spk_col].strip() if spk_col < len(cells) else ''
            cmd      = cells[cmd_col].strip() if cmd_col < len(cells) else ''

            if not id_ or not speaker:
                continue

            langs = {l: cells[columns[l]].strip()
                     if l in columns and columns[l] < len(cells) else ''
                     for l in LANG_ORDER}

            prefix = id_.rsplit('-', 1)[0]
            if prefix != current_dl_prefix:
                flush_dialogue()
                flush_passage()
                current_dl_prefix = prefix

            current_dl_rows.append({'id': id_, 'speaker': speaker, 'cmd': cmd, **langs})

    flush_dialogue()
    flush_passage()
    return out


# ── Main ──────────────────────────────────────────────────────────────────────

def _add_surface_forms(data):
    """
    For each section, collect all text in each language, lemmatize it,
    and store surface→lemma pairs in section['surfaceForms'][lang].
    Only stores forms that differ from their lemma.
    """
    lemmatize = _get_lemmatize()
    LANGS = ['de', 'fr', 'es', 'ja', 'zh']

    for section in data.get('sections', []):
        # Build vocab set per language for filtering
        vocab_ids = set(section.get('vocab', []))

        # Collect all text in this section per language
        texts = {l: [] for l in LANGS}
        for dl in section.get('dialogues', []):
            for turn in dl.get('turns', []):
                if turn['type'] == 'line':
                    for l in LANGS:
                        v = turn.get('text', {}).get(l, '')
                        if v: texts[l].append(v)
                elif turn['type'] in ('question', 'choice'):
                    for opt in turn.get('options', []):
                        for l in LANGS:
                            v = opt.get('text', {}).get(l, '')
                            if v: texts[l].append(v)
        for p in section.get('passages', []):
            for line in p.get('lines', []):
                for l in LANGS:
                    v = line.get(l, '')
                    if v: texts[l].append(v)

        texts_combined = {l: ' '.join(ts) for l, ts in texts.items() if ts}
        if not texts_combined:
            continue

        print(f"  Lemmatizing section {section.get('num', '?')}…")
        surface_forms = lemmatize(texts_combined)

        if surface_forms:
            section['surfaceForms'] = surface_forms
            total = sum(len(v) for v in surface_forms.values())
            langs_found = list(surface_forms.keys())
            print(f"    → {total} surface forms across {langs_found}")


def convert_file(tsv_path, do_lemmatize=False):
    """Convert a single TSV file to JSON. Returns the output path."""
    with open(tsv_path, encoding='utf-8') as f:
        tsv_text = f.read()

    data = parse_tsv(tsv_text)

    if do_lemmatize:
        _add_surface_forms(data)

    json_path = tsv_path.replace('.tsv', '.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    # Summary
    total_turns = sum(
        len(dl['turns'])
        for s in data['sections']
        for dl in s['dialogues']
    )
    total_lines = sum(
        len(p['lines'])
        for s in data['sections']
        for p in s['passages']
    )
    title = data['meta'].get('chapterTitle', {}).get('en', '?')
    level = data['meta'].get('level', '?')
    print(f"  ✓ {os.path.basename(json_path)}"
          f"  [{title} — {level}]"
          f"  {len(data['sections'])} sections,"
          f"  {total_turns} turns,"
          f"  {total_lines} passage lines")

    return json_path


def main():
    args = sys.argv[1:]

    if not args or '--help' in args or '-h' in args:
        print(__doc__)
        sys.exit(0)

    do_lemmatize = '--lemmatize' in args
    args = [a for a in args if a != '--lemmatize']

    # Collect input files
    if '--all' in args:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        files = sorted(glob.glob(os.path.join(script_dir, '*.tsv')))
    else:
        files = []
        for pattern in args:
            files.extend(sorted(glob.glob(pattern)))

    if not files:
        print("No TSV files found.")
        sys.exit(1)

    if do_lemmatize:
        print("Lemmatization enabled.")

    print(f"Converting {len(files)} file(s)…")
    for path in files:
        convert_file(path, do_lemmatize=do_lemmatize)
    print(f"Done.")


if __name__ == '__main__':
    main()
