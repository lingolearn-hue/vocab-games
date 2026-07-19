/**
 * Example sentences — lazy-loaded, keyed by lemma + part of speech.
 *
 * Storage format (public/examples/<listId>.json):
 *   { "language": "de", "sentences": { "<lemma>::<pos>": "<sentence>", ... } }
 *
 * Sparse map: only words that have a hardcoded sentence appear. Keying by
 * lemma+pos (lowercased lemma, trimmed) rather than list-index means the
 * file survives vocab list reordering/insertions, and can be authored
 * independently of the main vocab file. Including `pos` in the key resolves
 * homographs — same lemma, different part of speech (e.g. German "Mal"
 * noun vs "mal" adverb, which only differ by case) — without relying on
 * case-sensitivity, which isn't a reliable disambiguator in every language.
 * Missing/unknown pos falls back to the literal string 'unknown' in the key.
 *
 * Fetched once per list, cached in memory — not loaded until a sentence is
 * actually requested (e.g. Flashcard detail panel opened), so it adds
 * nothing to initial app load time.
 */

const _cache = new Map() // listId -> Promise<{ [lemma::pos]: sentence }>

function _key(lemma, pos) {
  return `${(lemma ?? '').trim().toLowerCase()}::${pos ?? 'unknown'}`
}

function _load(listId) {
  if (_cache.has(listId)) return _cache.get(listId)

  const promise = fetch(`./examples/${listId}.json`)
    .then(res => {
      if (!res.ok) return {}
      return res.json()
    })
    .then(data => data?.sentences ?? {})
    .catch(() => ({}))

  _cache.set(listId, promise)
  return promise
}

/**
 * Get the hardcoded example sentence for a word, if one exists.
 * Returns null if none is available (caller should fall back to a
 * template-generated sentence, or show nothing).
 */
export async function getExampleSentence(listId, lemma, pos) {
  const sentences = await _load(listId)
  return sentences[_key(lemma, pos)] ?? null
}

/** Preload a list's sentences in the background without needing the result yet. */
export function preloadExamples(listId) {
  _load(listId)
}
