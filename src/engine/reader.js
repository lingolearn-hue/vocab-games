/**
 * Reader lookup engine.
 *
 * Builds a lookup index from loaded vocab entries, then for any position
 * in a text finds the longest matching entry (phrase before word before char).
 *
 * For CJK (no spaces): tries substrings of decreasing length from position.
 * For spaced languages: tries multi-word and single-word matches.
 */

// Languages that don't use spaces between words
const CJK_LANGS = new Set(['zh', 'ja', 'ko'])
const CJK_MAX_LEN = 8  // max chars to try for CJK match

/**
 * Build a lookup map from an array of vocab entries.
 * Returns Map<string, entry> keyed by lowercase entry text.
 * Also indexes translation[0] for reverse lookups.
 */
export function buildLookup(entries) {
  const map = new Map()
  for (const e of entries) {
    // Index by entry text (normalised)
    map.set(e.entry.toLowerCase(), e)
    // For German: also index without article (der/die/das)
    const stripped = e.entry.replace(/^(der|die|das|den|dem|des)\s+/i, '')
    if (stripped !== e.entry) {
      map.set(stripped.toLowerCase(), e)
    }
  }
  return map
}

/**
 * Tokenise text into an array of spans: { text, entry|null, start, end }
 *
 * For CJK: character by character, trying longest match first.
 * For spaced: word by word (split on spaces/punctuation), trying multi-word first.
 *
 * language: 'zh' | 'ja' | 'es' | 'de' etc.
 */
export function tokenise(text, lookup, language) {
  if (!text) return []
  return CJK_LANGS.has(language)
    ? tokeniseCJK(text, lookup)
    : tokeniseSpaced(text, lookup)
}

function tokeniseCJK(text, lookup) {
  const spans = []
  let i = 0
  while (i < text.length) {
    let matched = null
    // Try longest match first, down to 1 char
    for (let len = Math.min(CJK_MAX_LEN, text.length - i); len >= 1; len--) {
      const substr = text.slice(i, i + len)
      if (lookup.has(substr.toLowerCase())) {
        matched = { text: substr, entry: lookup.get(substr.toLowerCase()), start: i, end: i + len }
        break
      }
    }
    if (matched) {
      spans.push(matched)
      i = matched.end
    } else {
      // No match — emit single char as plain text
      // Merge with previous plain span if possible
      if (spans.length > 0 && spans[spans.length - 1].entry === null) {
        spans[spans.length - 1].text += text[i]
        spans[spans.length - 1].end = i + 1
      } else {
        spans.push({ text: text[i], entry: null, start: i, end: i + 1 })
      }
      i++
    }
  }
  return spans
}

function tokeniseSpaced(text, lookup) {
  // Split into tokens preserving whitespace and punctuation as plain spans
  // Strategy: scan word by word, try 3-word, 2-word, 1-word phrases
  const spans = []
  // Split into alternating [word, gap, word, gap, ...]
  const parts = text.split(/(\s+|[.,!?;:"""''()\[\]{}—–\-\/\\])/)
  const words = []  // { text, isWord, globalIndex }
  let pos = 0
  for (const part of parts) {
    words.push({ text: part, isWord: /\S/.test(part) && !/^[.,!?;:"""''()\[\]{}—–\-\/\\]$/.test(part), pos })
    pos += part.length
  }

  let i = 0
  while (i < words.length) {
    if (!words[i].isWord) {
      // whitespace / punctuation — plain
      spans.push({ text: words[i].text, entry: null, start: words[i].pos, end: words[i].pos + words[i].text.length })
      i++
      continue
    }

    // Try 3-word phrase (skip gaps between words)
    let matched = null
    for (let phraseLen = 3; phraseLen >= 1 && !matched; phraseLen--) {
      const wordTokens = []
      let j = i
      while (wordTokens.length < phraseLen && j < words.length) {
        if (words[j].isWord) wordTokens.push(j)
        j++
      }
      if (wordTokens.length < phraseLen) continue

      const phrase = wordTokens.map(idx => words[idx].text).join(' ')
      const phraseLC = phrase.toLowerCase()
      if (lookup.has(phraseLC)) {
        // Spans from words[i] through words[j-1]
        const startPos = words[i].pos
        const lastWord = words[wordTokens[wordTokens.length - 1]]
        const endPos = lastWord.pos + lastWord.text.length
        matched = { text: phrase, entry: lookup.get(phraseLC), start: startPos, end: endPos }
        // Emit all intermediate tokens (spaces) as part of the match text
        i = j  // advance past all consumed tokens
      }
    }

    if (matched) {
      spans.push(matched)
    } else {
      // No match — plain word
      spans.push({ text: words[i].text, entry: null, start: words[i].pos, end: words[i].pos + words[i].text.length })
      i++
    }
  }
  return spans
}

/**
 * Load a reader passage file from public/reader/<listId>.json
 */
export async function loadReaderPassages(listId) {
  try {
    const res = await fetch(`./reader/${listId}.json`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}
