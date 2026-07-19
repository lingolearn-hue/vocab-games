#!/usr/bin/env node
/**
 * Extract example sentences from the vbvss199/Language-Learning-decks vendor
 * data (vendor/language-decks/<lang>/, gitignored — see README.md there for
 * how to re-fetch it) into our lazy-loaded per-word examples files
 * (public/examples/<listId>.json).
 *
 * Our own vocab lists (public/vocab/*.json) are the source of truth for
 * words/lemmas/pos — this script never touches them. It only fills in
 * example sentences, matched by lemma (+ pos where possible).
 *
 * Usage:
 *   node tools/extract-examples.js <lang> [--level=A1] [--force]
 *
 *   <lang>    one of: de, es, fr, en
 *   --level   only fill examples for this CEFR level (default: all levels
 *             present in the vendor file — usually just fill what you need,
 *             e.g. --level=A1)
 *   --force   overwrite sentences that already exist in the examples file
 *             (default: only fill words that don't have one yet, so hand
 *             edits are never silently clobbered)
 *
 * Safe to re-run any time — by default it only adds what's missing.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const LANG_CONFIG = {
  de: { vendorFile: 'german/german.json',   vocabFile: 'de-en.json', exampleField: 'example_sentence_native' },
  es: { vendorFile: 'spanish/spanish.json', vocabFile: 'es-en.json', exampleField: 'example_sentence_native' },
  fr: { vendorFile: 'french/french.json',   vocabFile: 'fr-en.json', exampleField: 'example_sentence_native' },
  en: { vendorFile: 'english/english.json', vocabFile: 'en-en.json', exampleField: 'example_sentence_english' },
  zh: { vendorFile: 'mandarin/mandarin.json', vocabFile: 'zh-en.json', exampleField: 'example_sentence_native' },
  ja: {
    vendorFile: ['japanese/kanji.json', 'japanese/hiragana.json', 'japanese/katakana.json'],
    vocabFile: 'ja-en.json',
    exampleField: 'example_sentence_native',
  },
}

// Vendor pos labels -> our vocab's pos abbreviations. Anything not listed
// here is passed through as-is (many already match, e.g. 'noun', 'verb').
const POS_MAP = {
  adjective: 'adj', adverb: 'adv', pronoun: 'pron', conjunction: 'conj',
  interjection: 'interj', preposition: 'prep', article: 'art', determiner: 'det',
}

function normalizePos(pos) {
  return POS_MAP[pos] ?? pos
}

function normalizeLemma(word) {
  return (word ?? '').trim().toLowerCase()
}

// Some of our entries (notably Japanese) intentionally keep usage-context
// annotations in the lemma itself — a leading/trailing '～' marking a
// prefix/suffix word, or a parenthetical usage note like 'こす (みずを～)'.
// That's useful context to keep in the vocab list, but useless (and
// unmatchable) when searching the vendor data, which only has clean
// lemmas. This strips it for matching purposes only — the stored examples
// key still uses the original, unstripped lemma, since that's what the
// app looks up at runtime.
function stripAnnotations(lemma) {
  return lemma
    .replace(/\s*\([^)]*\)\s*$/, '')  // trailing parenthetical note
    .replace(/^～+|～+$/g, '')          // leading/trailing tilde
    .trim()
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function main() {
  const [, , langArg, ...flags] = process.argv
  const lang = langArg
  if (!lang || !LANG_CONFIG[lang]) {
    console.error(`Usage: node tools/extract-examples.js <${Object.keys(LANG_CONFIG).join('|')}> [--level=A1] [--force]`)
    process.exit(1)
  }
  const force = flags.includes('--force')
  const levelFlag = flags.find(f => f.startsWith('--level='))
  const onlyLevel = levelFlag ? levelFlag.split('=')[1] : null

  const cfg = LANG_CONFIG[lang]
  const vendorFiles = Array.isArray(cfg.vendorFile) ? cfg.vendorFile : [cfg.vendorFile]
  const vendorPaths = vendorFiles.map(f => path.join(ROOT, 'vendor', 'language-decks', f))
  const vocabPath  = path.join(ROOT, 'public', 'vocab', cfg.vocabFile)
  const examplesPath = path.join(ROOT, 'public', 'examples', cfg.vocabFile)

  for (const vp of vendorPaths) {
    if (!fs.existsSync(vp)) {
      console.error(`Vendor file not found: ${vp}`)
      console.error(`Run the clone step in vendor/language-decks/README.md first.`)
      process.exit(1)
    }
  }

  const vendor = vendorPaths.flatMap(vp => JSON.parse(fs.readFileSync(vp, 'utf8')))
  const vocab  = JSON.parse(fs.readFileSync(vocabPath, 'utf8'))

  // Build a lookup from the vendor data: (lemma, normalizedPos) -> sentence,
  // plus a lemma-only fallback index for when pos tagging doesn't line up
  // (our vocab lists have some known pos data-quality issues, e.g. in French).
  const byLemmaPos = new Map()
  const byLemmaOnly = new Map()  // lemma -> [sentences...], used only if exactly one candidate

  for (const e of vendor) {
    const lemma = normalizeLemma(e.word)
    const posN  = normalizePos(e.pos)
    const sentence = (e[cfg.exampleField] ?? '').trim()
    if (!lemma || !sentence) continue
    if (onlyLevel && e.cefr_level !== onlyLevel) continue

    byLemmaPos.set(`${lemma}::${posN}`, sentence)
    if (!byLemmaOnly.has(lemma)) byLemmaOnly.set(lemma, [])
    byLemmaOnly.get(lemma).push(sentence)
  }

  // Our vocab entries to fill
  const k = vocab.keys
  const ei = k.indexOf('entry'), li = k.indexOf('level'), pi = k.indexOf('pos')
  let ourEntries = vocab.entries.map(e => ({ entry: e[ei], level: e[li], pos: e[pi] }))
  if (onlyLevel) ourEntries = ourEntries.filter(e => e.level === onlyLevel)

  let examples = { language: lang, sentences: {} }
  if (fs.existsSync(examplesPath)) {
    examples = JSON.parse(fs.readFileSync(examplesPath, 'utf8'))
    examples.sentences ??= {}
  }

  let filled = 0, skipped = 0, unmatched = 0
  for (const { entry, pos } of ourEntries) {
    const lemma = normalizeLemma(entry)
    const key = `${lemma}::${pos ?? 'unknown'}`

    if (examples.sentences[key] && !force) { skipped++; continue }

    let sentence = byLemmaPos.get(key)
    if (!sentence) {
      const candidates = byLemmaOnly.get(lemma)
      if (candidates && candidates.length === 1) sentence = candidates[0]
    }
    // Fall back to a stripped lemma (drops annotations like '～' or a
    // parenthetical usage note) if the raw lemma found nothing — the
    // stored key below still uses the original, unstripped lemma.
    if (!sentence) {
      const stripped = stripAnnotations(lemma)
      if (stripped !== lemma) {
        sentence = byLemmaPos.get(`${stripped}::${pos ?? 'unknown'}`)
        if (!sentence) {
          const candidates = byLemmaOnly.get(stripped)
          if (candidates && candidates.length === 1) sentence = candidates[0]
        }
      }
    }

    if (sentence) {
      examples.sentences[key] = sentence
      filled++
    } else {
      unmatched++
    }
  }

  fs.writeFileSync(examplesPath, JSON.stringify(examples, null, 2), 'utf8')
  console.log(`${lang}: filled ${filled}, skipped ${skipped} (already had a sentence), unmatched ${unmatched}`)
}

main()
