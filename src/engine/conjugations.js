/**
 * Verb conjugation principal parts — lazy-loaded, keyed by lemma + part of
 * speech. Mirrors examples.js exactly; see that file for the full rationale
 * on lemma+pos keying and lazy-fetch-once-cache-in-memory.
 *
 * Storage format (public/conjugations/<lang>.json):
 *   { "language": "de", "verbs": { "<lemma>::verb": {
 *       presentTense: string,    // 3rd person singular, e.g. "geht"
 *       pastTense: string,       // Präteritum, 1st/3rd sg (they're identical), e.g. "ging"
 *       pastParticiple: string,  // Partizip II, e.g. "gegangen"
 *       auxiliary: "haben" | "sein",
 *   }, ... } }
 *
 * Sparse map: only verbs with data appear. Currently German only — source:
 * Wiktionary via viorelsfetea/german-verbs-database (CC-BY-SA, same
 * trusted-source family as the JMdict/Lexique383/Wiktionary-derived data
 * used elsewhere in this project). Coverage: 2,758/3,136 German verbs
 * (88.0%) as of the initial fill; the rest are mostly separable-prefix
 * compounds, colloquial contractions (rauskommen vs herauskommen), and
 * noun+verb collocations (Rad fahren) not present in the source list.
 *
 * Fetched once per language, cached in memory — not loaded until a verb's
 * conjugation is actually requested (e.g. Flashcard detail panel opened,
 * or a future conjugation-drill mode), so it adds nothing to initial app
 * load time. Deliberately kept out of the main vocab file for exactly this
 * reason — de-en.json is loaded for every screen, this data isn't needed
 * on most of them.
 */

const _cache = new Map() // language -> Promise<{ [lemma::pos]: conjugation }>

function _key(lemma, pos) {
  return `${(lemma ?? '').trim().toLowerCase()}::${pos ?? 'unknown'}`
}

function _load(language) {
  if (_cache.has(language)) return _cache.get(language)

  const promise = fetch(`./conjugations/${language}.json`)
    .then(res => {
      if (!res.ok) return {}
      return res.json()
    })
    .then(data => data?.verbs ?? {})
    .catch(() => ({}))

  _cache.set(language, promise)
  return promise
}

/**
 * Get the conjugation principal parts for a verb, if available.
 * Returns null if none is available.
 */
export async function getConjugation(language, lemma, pos) {
  const verbs = await _load(language)
  return verbs[_key(lemma, pos)] ?? null
}

/** Preload a language's conjugations in the background without needing the result yet. */
export function preloadConjugations(language) {
  _load(language)
}
