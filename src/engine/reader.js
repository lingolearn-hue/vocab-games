/**
 * Reader lookup engine.
 *
 * Builds a lookup index from loaded vocab entries, then for any position
 * in a text finds the longest matching entry (phrase before word before char).
 *
 * For CJK (no spaces): tries substrings of decreasing length from position.
 * For spaced languages: tries multi-word and single-word matches.
 *
 * Japanese conjugation: when no direct match is found, tries stripping known
 * verb/adjective suffixes and reconstructing dictionary forms. Text-specific —
 * only resolves forms whose stems + candidates appear in the vocab index,
 * so false positives are impossible for words not in the list.
 */

const CJK_LANGS = new Set(['zh', 'ja', 'ko'])
const CJK_MAX_LEN = 8

// ── Japanese deinflection tables ──────────────────────────────────────────────

// Polite/progressive suffixes to strip — leaves either ichidan stem or godan i-stem
const POLITE_SUFFIXES = [
  'ませんでした',
  'ていました', 'ていません', 'ています', 'ていた', 'ている',
  'でした',
  'ました', 'ません', 'なかった',
  'ます',
]

// Te-form / plain past suffixes that directly encode the godan class
// [suffix, array of dictionary forms to try by appending to the pre-suffix stem]
const TE_TA_FORMS = [
  ['いって',  ['いく']],         // 行って → 行く (irregular)
  ['きて',    ['くる']],          // 来て → 来る (irregular)
  ['して',    ['する', 'す']],    // して → する / 話して → 話す
  ['した',    ['する', 'す']],
  ['きた',    ['くる']],
  ['いった',  ['いく']],
  ['って',    ['う', 'つ', 'る']], // 待って → 待つ, 言って→言う
  ['んで',    ['ぬ', 'ぶ', 'む']],
  ['いで',    ['ぐ']],
  ['いて',    ['く']],
  ['って',    ['う', 'つ']],
  ['た',      ['る']],            // ichidan: 食べた → 食べる
  ['て',      ['る']],
]

// Godan i-stem (連用形) ending → dictionary form ending
// e.g. 飲み → 飲む, 書き → 書く, 話し → 話す
const ISTEM_MAP = [
  ['き', 'く'], ['ぎ', 'ぐ'], ['し', 'す'], ['ち', 'つ'],
  ['に', 'ぬ'], ['び', 'ぶ'], ['み', 'む'], ['い', 'う'],
]

// Godan a-stem (未然形) ending → dictionary form (for ない-form)
// e.g. 飲ま → 飲む, 書か → 書く
const ASTEM_MAP = [
  ['か', 'く'], ['が', 'ぐ'], ['さ', 'す'], ['た', 'つ'],
  ['な', 'ぬ'], ['ば', 'ぶ'], ['ま', 'む'], ['わ', 'う'],
  ['ら', 'る'],  // careful: also ichidan if verb ends in る
]

// い-adjective [suffix_to_strip, replacement]
const IADJ_DEINFLECTIONS = [
  ['くありませんでした', 'い'], ['くありません', 'い'],
  ['くなかった', 'い'], ['くなります', 'い'], ['くなった', 'い'],
  ['かった', 'い'], ['くない', 'い'], ['くて', 'い'], ['く', 'い'],
  ['さ', 'い'],
]

// な-adjective / copula [suffix_to_strip, replacement]
const NADJ_DEINFLECTIONS = [
  ['ではなかった', ''], ['ではない', ''], ['じゃない', ''],
  ['でした', ''], ['です', ''], ['な', ''], ['に', ''], ['で', ''],
]

function iStemToDict(stem, lookup) {
  for (const [ending, dict] of ISTEM_MAP) {
    if (stem.endsWith(ending)) {
      const candidate = stem.slice(0, -ending.length) + dict
      if (candidate.length >= 2 && lookup.has(candidate)) return lookup.get(candidate)
    }
  }
  return null
}

function aStemToDict(stem, lookup) {
  for (const [ending, dict] of ASTEM_MAP) {
    if (stem.endsWith(ending)) {
      const candidate = stem.slice(0, -ending.length) + dict
      if (candidate.length >= 2 && lookup.has(candidate)) return lookup.get(candidate)
    }
  }
  return null
}

function resolveConjugated(surface, lookup) {
  if (surface.length < 2) return null

  // 1. Polite / progressive forms → leaves i-stem or ichidan stem
  for (const suffix of POLITE_SUFFIXES) {
    if (surface.length <= suffix.length || !surface.endsWith(suffix)) continue
    const stem = surface.slice(0, -suffix.length)
    if (!stem) continue
    // Ichidan: stem + る
    const ichidan = stem + 'る'
    if (lookup.has(ichidan)) return lookup.get(ichidan)
    // Godan: stem is i-stem → convert
    const godan = iStemToDict(stem, lookup)
    if (godan) return godan
    // Irregular: する、くる
    if (lookup.has(stem)) return lookup.get(stem)
  }

  // 2. Te-form / plain past — suffix encodes conjugation class
  for (const [suffix, endings] of TE_TA_FORMS) {
    if (surface.length <= suffix.length || !surface.endsWith(suffix)) continue
    const stem = surface.slice(0, -suffix.length)
    for (const ending of endings) {
      const candidate = stem + ending
      if (candidate.length >= 2 && lookup.has(candidate)) return lookup.get(candidate)
    }
    // Also try ichidan (for て/た)
    if (suffix === 'て' || suffix === 'た') {
      const ichidan = stem + 'る'
      if (lookup.has(ichidan)) return lookup.get(ichidan)
    }
  }

  // 3. Negative ない-form → a-stem conversion
  if (surface.length > 2 && surface.endsWith('ない')) {
    const stem = surface.slice(0, -2)
    // Ichidan: stem + る (e.g. 食べない → 食べる)
    const ichidan = stem + 'る'
    if (lookup.has(ichidan)) return lookup.get(ichidan)
    // Godan: a-stem → dict
    const godan = aStemToDict(stem, lookup)
    if (godan) return godan
  }

  // 4. い-adjective inflections
  for (const [suffix, replacement] of IADJ_DEINFLECTIONS) {
    if (surface.length <= suffix.length || !surface.endsWith(suffix)) continue
    const candidate = surface.slice(0, -suffix.length) + replacement
    if (candidate.length >= 2 && lookup.has(candidate)) return lookup.get(candidate)
  }

  // 5. な-adjective / copula inflections
  for (const [suffix, replacement] of NADJ_DEINFLECTIONS) {
    if (!suffix || surface.length <= suffix.length || !surface.endsWith(suffix)) continue
    const candidate = surface.slice(0, -suffix.length) + replacement
    if (candidate.length >= 1 && lookup.has(candidate)) return lookup.get(candidate)
  }

  return null
}

// ── Lookup builder ────────────────────────────────────────────────────────────

export function buildLookup(entries) {
  const map = new Map()
  for (const e of entries) {
    map.set(e.entry.toLowerCase(), e)
    // German: index without article
    const stripped = e.entry.replace(/^(der|die|das|den|dem|des)\s+/i, '')
    if (stripped !== e.entry) map.set(stripped.toLowerCase(), e)
  }
  return map
}

// ── Tokeniser ─────────────────────────────────────────────────────────────────

export function tokenise(text, lookup, language) {
  if (!text) return []
  return CJK_LANGS.has(language)
    ? tokeniseCJK(text, lookup, language)
    : tokeniseSpaced(text, lookup)
}

function tokeniseCJK(text, lookup, language) {
  const isJapanese = language === 'ja'
  const spans = []
  let i = 0

  while (i < text.length) {
    let matched = null

    // 1. Direct longest-match (dictionary form in text)
    for (let len = Math.min(CJK_MAX_LEN, text.length - i); len >= 1; len--) {
      const substr = text.slice(i, i + len)
      if (lookup.has(substr.toLowerCase())) {
        matched = { text: substr, entry: lookup.get(substr.toLowerCase()), start: i, end: i + len }
        break
      }
    }

    // 2. Japanese conjugation resolution — try substrings of decreasing length
    if (!matched && isJapanese) {
      // Try longer windows first (conjugated forms can be longer than dict forms)
      const maxLen = Math.min(CJK_MAX_LEN + 6, text.length - i)
      for (let len = maxLen; len >= 2; len--) {
        const substr = text.slice(i, i + len)
        const entry = resolveConjugated(substr, lookup)
        if (entry) {
          matched = { text: substr, entry, start: i, end: i + len, conjugated: true }
          break
        }
      }
    }

    if (matched) {
      spans.push(matched)
      i = matched.end
    } else {
      // Plain character — merge with previous plain span
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
  const spans = []
  const parts = text.split(/(\s+|[.,!?;:"""''()[\]{}—–\-/\\])/)
  const words = []
  let pos = 0
  for (const part of parts) {
    words.push({
      text: part,
      isWord: /\S/.test(part) && !/^[.,!?;:"""''()[\]{}—–\-/\\]$/.test(part),
      pos,
    })
    pos += part.length
  }

  let i = 0
  while (i < words.length) {
    if (!words[i].isWord) {
      spans.push({ text: words[i].text, entry: null, start: words[i].pos, end: words[i].pos + words[i].text.length })
      i++
      continue
    }

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
      if (lookup.has(phrase.toLowerCase())) {
        const startPos = words[i].pos
        const lastWord = words[wordTokens[wordTokens.length - 1]]
        matched = { text: phrase, entry: lookup.get(phrase.toLowerCase()), start: startPos, end: lastWord.pos + lastWord.text.length }
        i = j
      }
    }

    if (matched) {
      spans.push(matched)
    } else {
      spans.push({ text: words[i].text, entry: null, start: words[i].pos, end: words[i].pos + words[i].text.length })
      i++
    }
  }
  return spans
}

// ── Passage loader ────────────────────────────────────────────────────────────

export async function loadReaderPassages(listId) {
  try {
    const res = await fetch(`./reader/${listId}.json`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}
