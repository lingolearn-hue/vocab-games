// German definite/indefinite article computation.
//
// Mirrors frenchArticle.js's approach: article is derived from gender +
// pluraleTantum rather than stored directly, for the same reason (storing
// it separately would reintroduce a data-consistency problem — see the
// note in frenchArticle.js).
//
// German has two cases this needs to handle that French's simpler m/f
// system doesn't:
//   - A third grammatical gender ('n', neuter) alongside 'm'/'f'.
//   - Plurale-tantum and "adjectival noun" (epicene) patterns turned up
//     real, messy data while wiring this in — see TODO.md's German
//     category-tagging section for the specific words and reasoning
//     (e.g. "Freiwillige" is epicene — der/die depends on who's being
//     referred to, not the word itself; "Geschwister"/"Leute" etc. are
//     plurale tantum and always take "die" regardless of any notional
//     singular gender).
//
// No elision system needed for German (unlike French le/la -> l') —
// der/die/das don't contract before vowels.

/**
 * Get the German article for a noun.
 * @param {string|null} gender - 'm'|'f'|'n'|'epicene'|null
 * @param {boolean} pluraleTantum - true for words only used in plural
 *   (Geschwister, Leute, Eltern...)
 * @param {'definite'|'indefinite'} mode
 * @param {'m'|'f'} [referentGender] - required when gender is 'epicene',
 *   since the article for an epicene noun (Freiwillige, Angehörige...)
 *   depends on the sex of the person referred to, not the word itself.
 * @returns {string|null} the article ("der","die","das","ein","eine",
 *   "die","—" for indefinite-plural since German has no plural indefinite
 *   article), or null if no article applies (e.g. numerals, proper nouns
 *   with unspecified gender).
 */
export function getGermanArticle(gender, pluraleTantum, mode, referentGender) {
  if (pluraleTantum) {
    // German has no indefinite plural article ("some" is just omitted,
    // or expressed with "einige"/"ein paar" outside the article system).
    return mode === 'definite' ? 'die' : null
  }

  let g = gender
  if (g === 'epicene') {
    if (!referentGender) {
      throw new Error('referentGender is required for epicene nouns')
    }
    g = referentGender
  }

  if (!g) return null

  if (mode === 'definite') {
    return g === 'f' ? 'die' : g === 'n' ? 'das' : 'der'
  }
  // indefinite
  return g === 'f' ? 'eine' : 'ein'
}
