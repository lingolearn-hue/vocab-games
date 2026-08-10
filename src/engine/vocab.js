import { getFrenchArticle } from './frenchArticle'
import { getGermanArticle } from './germanArticle'
import { getSpanishArticle } from './spanishArticle'

// ── Loader ────────────────────────────────────────────────────────────────────

/**
 * Fetch a vocab JSON file and normalise entries into objects.
 * Supports keys: entry, reading (optional), translation (array),
 *               pos, categories, level, gender, measureWord (all optional)
 */
export async function loadList(path) {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`Failed to load vocab list: ${path}`)
  const raw = await res.json()

  const k = raw.keys
  const idx = {
    entry:       k.indexOf('entry'),
    reading:     k.indexOf('reading'),
    translation: k.indexOf('translation'),
    pos:         k.indexOf('pos'),
    categories:  k.indexOf('categories'),
    level:       k.indexOf('level'),
    gender:      k.indexOf('gender'),
    measureWord: k.indexOf('measureWord'),
    pluraleTantum: k.indexOf('pluraleTantum'),
  }

  const entries = raw.entries.map((arr, i) => {
    const translation = arr[idx.translation]
    return {
      id:           `${raw.id}::${i}`,
      entry:        arr[idx.entry],
      reading:      idx.reading >= 0 ? arr[idx.reading] : null,
      translation:  Array.isArray(translation) ? translation : [translation],
      pos:          idx.pos >= 0 ? arr[idx.pos] : null,
      categories:   idx.categories >= 0 ? arr[idx.categories] : [],
      level:        idx.level >= 0 ? arr[idx.level] : null,
      gender:       idx.gender >= 0 ? arr[idx.gender] : null,
      measureWord:  idx.measureWord >= 0 ? arr[idx.measureWord] : null,
      pluraleTantum: idx.pluraleTantum >= 0 ? !!arr[idx.pluraleTantum] : false,
      listId:       raw.id,
    }
  })

  // Collect unique levels from entries
  const levels = [...new Set(entries.map(e => e.level).filter(Boolean))].sort()

  return {
    id: raw.id,
    language: raw.language,
    native: raw.native,
    hasReading: idx.reading >= 0,
    levels,
    entries,
  }
}

/**
 * Merge multiple loaded lists into a single flat entry array.
 */
export function mergeLists(lists) {
  const seen = new Set()
  return lists.flatMap(l => l.entries).filter(e => {
    if (seen.has(e.id)) return false
    seen.add(e.id)
    return true
  })
}

// ── Reverse-build (English from a source language) ─────────────────────────

/**
 * Builds a synthetic "English learned from <source language>" list by
 * flipping an already-loaded source list: each English translation becomes
 * the card's `entry`, and the original source word(s) become `translation`.
 *
 * Since many source words can share an English translation (e.g. German
 * "groß" and "riesig" both translating to "big"), and a single source word
 * can have multiple English translations, this groups by normalised English
 * text and merges all matching source words into one card's translation
 * array — so you never get duplicate English cards, just one card per
 * distinct English word with every valid source-language equivalent
 * attached.
 *
 * Limitation (tracked in TODO): reverse cards have no reading and no
 * example sentences — those belong to the source word, not the merged
 * English card, and a proper fix needs a dedicated English sentence list.
 */
export function buildReverseList(sourceList, sourceLangId, sourceLangLabel) {
  const groups = new Map()  // normalised english -> { display, sourceWords, pos, level, categories }

  for (const e of sourceList.entries) {
    for (const en of e.translation) {
      if (!en) continue
      const key = en.trim().toLowerCase()
      if (!key) continue
      if (!groups.has(key)) {
        groups.set(key, {
          display: en.trim(),
          sourceWords: new Set(),
          pos: e.pos,
          level: e.level,
          categories: e.categories ?? [],
        })
      }
      groups.get(key).sourceWords.add(e.entry)
    }
  }

  const id = `en-rev-${sourceLangId}`
  const entries = [...groups.values()].map((g, i) => ({
    id: `${id}::${i}`,
    entry: g.display,
    reading: null,
    translation: [...g.sourceWords],
    pos: g.pos,
    categories: g.categories,
    level: g.level,
    gender: null,
    measureWord: null,
    pluraleTantum: false,
    listId: id,
  }))

  return {
    id,
    language: 'en',
    native: `English (from ${sourceLangLabel})`,
    hasReading: false,
    levels: [...new Set(entries.map(e => e.level).filter(Boolean))].sort(),
    entries,
  }
}

// ── Sentence loader ───────────────────────────────────────────────────────────

/**
 * Fetch a sentence JSON file.
 * Supports new flat { sentences: [...] } and legacy { fixed, generic } formats.
 */
export async function loadSentences(path) {
  try {
    const res = await fetch(path)
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

/**
 * Parse a fixed sentence into { before, answer, distractors, after }
 * Input text format: "I eat {apple/book/dog} every day."
 */
export function parseFixedSentence(text) {
  const match = text.match(/^(.*?)\{([^}]+)\}(.*)$/)
  if (!match) return null
  const [, before, inner, after] = match
  const options = inner.split('/')
  return {
    before,
    answer: options[0],
    distractors: options.slice(1),
    after,
  }
}

/**
 * Build a gap-fill question from a generic template + vocab entry.
 * The entry's translation[0] or entry field fills ___ depending on direction.
 */
export function buildGenericQuestion(template, entry, direction) {
  const answer = direction === 'entry->translation'
    ? entry.translation[0]
    : entry.entry
  const text = template.replace('___', `{${answer}}`)
  return parseFixedSentence(text)
}

// ── Article display helper ────────────────────────────────────────────────────

// German/French/Spanish epicene nouns (e.g. "Freiwillige"/"artiste"/
// "estudiante") depend on the referent's sex, which isn't tracked per-entry
// in the vocab data — no vocab list here stores "who this specific card
// refers to." Defaulting to masculine for display purposes is the standard
// dictionary convention (the same thing a print dictionary does when
// citing an epicene headword out of context) — not a claim about which
// form is more "correct."
const DEFAULT_REFERENT_GENDER = 'm'

/**
 * Returns the display string for a vocab entry, prepending the article
 * for gendered languages (de/es/fr) when the entry is a noun with a gender.
 * e.g. entry='Auto', gender='n', language='de' → 'das Auto'
 *
 * All three route through their own article engines (germanArticle.js /
 * frenchArticle.js / spanishArticle.js) rather than a flat gender->article
 * lookup, since plurale-tantum nouns always take the plural article
 * regardless of any notional singular gender, and epicene nouns need a
 * referent gender. German/French additionally need vowel-sound elision
 * (French le/la -> l'; German doesn't elide, but has a third gender).
 *
 * French's gender field has a known data-quality problem — down to 118 of
 * 10,604 nouns (1.1%, was 17.6% before a Lexique383-based resolution pass)
 * still have a corrupted value from a prior import (the elided article
 * text itself got stored instead of m/f, e.g. "l'enfant" sitting in the
 * gender slot) — see TODO.md. Only 'm'/'f'/'epicene' are treated as valid;
 * anything else (including that corrupted data) falls through to "no
 * article shown," which is exactly today's behavior for those entries —
 * this fix doesn't make them worse, it just doesn't silently repair data
 * it can't actually recover.
 */
export function displayEntry(entry, language) {
  if (!entry) return ''
  if (entry.pos !== 'noun') return entry.entry

  if (language === 'de') {
    if (entry.gender !== 'epicene' && !['m','f','n'].includes(entry.gender) && !entry.pluraleTantum) {
      return entry.entry
    }
    const article = getGermanArticle(entry.gender, entry.pluraleTantum, 'definite', DEFAULT_REFERENT_GENDER)
    return article ? article + ' ' + entry.entry : entry.entry
  }

  if (language === 'fr') {
    if (entry.gender !== 'epicene' && !['m','f'].includes(entry.gender) && !entry.pluraleTantum) {
      return entry.entry
    }
    const article = getFrenchArticle(entry.entry, entry.gender, entry.pluraleTantum, 'definite', DEFAULT_REFERENT_GENDER)
    return article ? article + (article.endsWith("'") ? '' : ' ') + entry.entry : entry.entry
  }

  if (language === 'es') {
    if (entry.gender !== 'epicene' && !['m','f'].includes(entry.gender) && !entry.pluraleTantum) {
      return entry.entry
    }
    const article = getSpanishArticle(entry.gender, entry.pluraleTantum, DEFAULT_REFERENT_GENDER)
    return article ? article + ' ' + entry.entry : entry.entry
  }

  return entry.entry
}
