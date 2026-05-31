// ── Loader ────────────────────────────────────────────────────────────────────

/**
 * Fetch a vocab JSON file and normalise entries into objects.
 * Supports keys: entry, reading (optional), translation (array), 
 *               pos (optional), categories (optional), level (optional)
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
  }

  const entries = raw.entries.map((arr, i) => {
    const translation = arr[idx.translation]
    return {
      id:           `${raw.id}::${i}`,
      entry:        arr[idx.entry],
      reading:      idx.reading >= 0 ? arr[idx.reading] : null,
      // translation is always stored as array; accept legacy string
      translation:  Array.isArray(translation) ? translation : [translation],
      pos:          idx.pos >= 0 ? arr[idx.pos] : null,
      categories:   idx.categories >= 0 ? arr[idx.categories] : [],
      level:        idx.level >= 0 ? arr[idx.level] : null,
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

// ── Sentence loader ───────────────────────────────────────────────────────────

/**
 * Fetch a sentence JSON file.
 * Returns { language, native, fixed, generic }
 */
export async function loadSentences(path) {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`Failed to load sentences: ${path}`)
  return res.json()
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
