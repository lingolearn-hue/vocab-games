#!/usr/bin/env node
// @ts-check
/**
 * DrKameleon complete-hsk-vocabulary → VocabGames internal format converter
 *
 * Source: https://github.com/drkameleon/complete-hsk-vocabulary
 * License: MIT (see source repo)
 *
 * Usage:
 *   node tools/convert-drkameleon.js <input.json> [--hsk-version new|old] [--output <out.json>]
 *
 * Examples:
 *   node tools/convert-drkameleon.js complete.json --output public/vocab/zh-en-full.json
 *   node tools/convert-drkameleon.js complete.json --hsk-version old --output public/vocab/zh-en-old.json
 *
 * DrKameleon entry format:
 * {
 *   "s":  "苹果",           — simplified Chinese (main entry)
 *   "t":  "蘋果",           — traditional Chinese (optional)
 *   "r":  "píng guǒ",       — pinyin reading (space-separated syllables)
 *   "p":  ["noun"],         — part of speech array
 *   "l":  { "new": 1, "old": 3 }, — HSK level(s); null if not in that version
 *   "q":  234,              — frequency rank (lower = more common)
 *   "m":  ["apple", "CL:个[ge4]"], — meanings (may contain classifier annotations)
 *   "c":  ["个"]            — classifiers / measure words (already extracted)
 * }
 *
 * Output format (VocabGames internal):
 * {
 *   "id": "zh-en",
 *   "language": "zh",
 *   "native": "en",
 *   "keys": ["entry","reading","translation","pos","categories","level","gender","measureWord"],
 *   "entries": [
 *     ["苹果", "píng guǒ", ["apple"], "noun", ["food"], "HSK1", null, "个"]
 *   ]
 * }
 */

import fs from 'fs'

// ── CLI argument parsing ──────────────────────────────────────────────────────

const args = process.argv.slice(2)
if (args.length === 0 || args[0] === '--help') {
  console.log(`
Usage: node tools/convert-drkameleon.js <input.json> [options]

Options:
  --hsk-version <new|old>   Which HSK version to use for level field (default: new)
  --max-level <n>            Only include entries up to HSK level n (default: all)
  --output <file>            Output file path (default: zh-en-converted.json)
  --min-frequency <n>        Only include entries with frequency rank ≤ n
  --help                     Show this help
`)
  process.exit(0)
}

const inputFile    = args[0]
const hskVersion   = argValue(args, '--hsk-version', 'new')
const maxLevel     = argValue(args, '--max-level',   null)
const outputFile   = argValue(args, '--output',      'zh-en-converted.json')
const minFrequency = argValue(args, '--min-frequency', null)

function argValue(args, flag, def) {
  const i = args.indexOf(flag)
  return i >= 0 ? args[i + 1] : def
}

// ── POS mapping ───────────────────────────────────────────────────────────────

// DrKameleon uses string arrays; map to our single pos field
const POS_MAP = {
  'noun':        'noun',
  'verb':        'verb',
  'adjective':   'adj',
  'adverb':      'adv',
  'pronoun':     'pron',
  'preposition': 'prep',
  'conjunction': 'conj',
  'particle':    'particle',
  'interjection':'phrase',
  'numeral':     'num',
  'measure word':'particle',
  'classifier':  'particle',
  'phrase':      'phrase',
}

function mapPos(posArray) {
  if (!posArray || posArray.length === 0) return null
  const first = posArray[0].toLowerCase()
  return POS_MAP[first] ?? first
}

// ── Category inference ────────────────────────────────────────────────────────

// Infer categories from meanings and POS (rough heuristic)
const CATEGORY_KEYWORDS = [
  { keywords: ['eat','food','drink','meal','fruit','vegetable','meat','rice','noodle','soup'], cat: 'food' },
  { keywords: ['animal','dog','cat','bird','fish','horse','cow','pig','sheep'], cat: 'animals' },
  { keywords: ['family','mother','father','parent','child','son','daughter','brother','sister'], cat: 'family' },
  { keywords: ['school','study','learn','teacher','student','class','exam','book'], cat: 'education' },
  { keywords: ['work','job','company','business','office','money','buy','sell','price'], cat: 'work' },
  { keywords: ['travel','go','come','walk','run','road','place','city','country'], cat: 'travel' },
  { keywords: ['body','health','hospital','doctor','medicine','sick','pain'], cat: 'health' },
  { keywords: ['time','year','month','day','hour','minute','week','today','tomorrow'], cat: 'time' },
  { keywords: ['weather','rain','snow','wind','sun','cold','hot','warm','cloud'], cat: 'nature' },
  { keywords: ['color','red','blue','green','yellow','white','black'], cat: 'colors' },
  { keywords: ['number','one','two','three','four','five','hundred','thousand'], cat: 'numbers' },
  { keywords: ['happy','sad','angry','love','like','want','hope','feel','think'], cat: 'emotions' },
  { keywords: ['phone','computer','internet','technology','machine'], cat: 'technology' },
  { keywords: ['house','home','room','door','window','table','chair','bed'], cat: 'home' },
  { keywords: ['person','people','friend','man','woman','child','name'], cat: 'people' },
]

function inferCategories(meanings) {
  const text = (meanings ?? []).join(' ').toLowerCase()
  const cats = []
  for (const { keywords, cat } of CATEGORY_KEYWORDS) {
    if (keywords.some(kw => text.includes(kw))) {
      cats.push(cat)
      if (cats.length >= 2) break
    }
  }
  return cats
}

// ── Meaning cleaning ──────────────────────────────────────────────────────────

// Remove classifier annotations like "CL:个[ge4]" from meanings
function cleanMeanings(meanings) {
  if (!meanings || meanings.length === 0) return []
  return meanings
    .map(m => m.replace(/CL:[^;,]*/g, '').replace(/\[.*?\]/g, '').trim())
    .filter(m => m.length > 0 && !m.startsWith('(') || m.length > 3)
    .map(m => m.replace(/\s+/g, ' ').trim())
    .filter(m => m.length > 0)
}

// ── Level mapping ─────────────────────────────────────────────────────────────

function getLevel(entry, version) {
  const l = entry.l
  if (!l) return null
  const lvl = version === 'old' ? l.old : l.new
  if (!lvl) return null
  return `HSK${lvl}`
}

// ── Main conversion ───────────────────────────────────────────────────────────

console.log(`Reading ${inputFile}...`)
const raw = JSON.parse(fs.readFileSync(inputFile, 'utf8'))

// The file may be an array directly or wrapped in an object
const entries = Array.isArray(raw) ? raw : raw.words ?? raw.entries ?? Object.values(raw)

console.log(`Found ${entries.length} entries. Converting...`)

const maxLvl = maxLevel ? parseInt(maxLevel) : null
const maxFreq = minFrequency ? parseInt(minFrequency) : null

const converted = []
let skipped = 0

for (const entry of entries) {
  // Required field
  if (!entry.s) { skipped++; continue }

  // Level filter
  const level = getLevel(entry, hskVersion)
  if (maxLvl && level) {
    const lvlNum = parseInt(level.replace('HSK', ''))
    if (!isNaN(lvlNum) && lvlNum > maxLvl) { skipped++; continue }
  }
  if (maxLvl && !level) { skipped++; continue }

  // Frequency filter
  if (maxFreq && entry.q && entry.q > maxFreq) { skipped++; continue }

  const meanings = cleanMeanings(entry.m)
  if (meanings.length === 0) { skipped++; continue }

  const pos        = mapPos(entry.p)
  const categories = inferCategories(entry.m)
  const reading    = entry.r ?? null
  // Take first classifier if available
  const measureWord = entry.c && entry.c.length > 0 ? entry.c[0] : null

  converted.push([
    entry.s,         // entry (simplified Chinese)
    reading,         // reading (pinyin)
    meanings,        // translation (array)
    pos,             // pos
    categories,      // categories
    level,           // level
    null,            // gender (N/A for Chinese)
    measureWord,     // measureWord
  ])
}

// Sort by level then frequency
const LEVEL_ORDER = ['HSK1','HSK2','HSK3','HSK4','HSK5','HSK6','HSK7','HSK8','HSK9']
converted.sort((a, b) => {
  const li = LEVEL_ORDER.indexOf(a[5]) - LEVEL_ORDER.indexOf(b[5])
  return li !== 0 ? li : 0
})

const output = {
  _source:   'drkameleon/complete-hsk-vocabulary',
  _license:  'MIT — https://github.com/drkameleon/complete-hsk-vocabulary/blob/main/LICENSE',
  _converted: new Date().toISOString().split('T')[0],
  _hsk_version: hskVersion,
  id:       'zh-en',
  language: 'zh',
  native:   'en',
  keys:     ['entry','reading','translation','pos','categories','level','gender','measureWord'],
  entries:  converted,
}

fs.writeFileSync(outputFile, JSON.stringify(output, null, 2), 'utf8')
console.log(`✓ Converted ${converted.length} entries (skipped ${skipped})`)
console.log(`✓ Written to ${outputFile}`)

// Print level breakdown
const levelCounts = {}
for (const e of converted) {
  const l = e[5] ?? 'unknown'
  levelCounts[l] = (levelCounts[l] ?? 0) + 1
}
console.log('\nLevel breakdown:')
for (const [l, n] of Object.entries(levelCounts).sort()) {
  console.log(`  ${l}: ${n}`)
}
