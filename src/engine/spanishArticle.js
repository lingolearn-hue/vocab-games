// Spanish definite article computation.
//
// Simpler than German/French: no elision system (el/la don't contract
// before vowels the way French le/la -> l' does — "el agua" is actually
// an exception *within* feminine nouns for phonetic reasons, but that's
// a fixed set of specific words, not a general rule worth modeling here
// until it's actually needed) and no third gender. Still needs the same
// plurale-tantum and epicene handling as German/French though, once
// Spanish gender data existed to make it worth building (previously 0%
// of Spanish nouns had gender data at all — see TODO.md).

/**
 * Get the Spanish definite article for a noun.
 * @param {string|null} gender - 'm'|'f'|'epicene'|null
 * @param {boolean} pluraleTantum - true for words only used in plural
 *   (afueras, felicidades...)
 * @param {'m'|'f'} [referentGender] - required when gender is 'epicene',
 *   since the article for an epicene noun (presidente, estudiante...)
 *   depends on the sex of the person referred to, not the word itself.
 * @returns {string|null} "el"/"la"/"los"/"las", or null if no article
 *   applies.
 */
export function getSpanishArticle(gender, pluraleTantum, referentGender) {
  if (pluraleTantum) {
    // Plurale-tantum entries have gender: null (no notional singular
    // gender is tracked for them — same convention as German/French), so
    // this has to be checked before the "no gender, no article" fallback
    // below, not after.
    return gender === 'f' ? 'las' : 'los'
  }

  let g = gender
  if (g === 'epicene') {
    if (!referentGender) {
      throw new Error('referentGender is required for epicene nouns')
    }
    g = referentGender
  }

  if (!g) return null
  return g === 'f' ? 'la' : 'el'
}
