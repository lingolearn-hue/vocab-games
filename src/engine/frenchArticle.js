// French definite/indefinite article computation.
//
// Article is deliberately NOT stored in vocab data — it's fully derivable
// from gender + elision, and storing it separately would just reintroduce
// the same data-consistency mess the gender field was cleaned up from.
//
// Elision (le/la -> l', ce/que -> c'/qu', etc.) applies before a vowel sound,
// which includes most words starting with a silent "h" (h muet) but NOT
// words starting with an aspirated "h" (h aspire) - a distinction invisible
// from spelling alone. This list covers the common h-aspire words likely to
// appear in a learner vocab list; it is not exhaustive.
const H_ASPIRE = new Set([
  'hasard', 'hasards', 'haine', 'haines', 'hall', 'halls', 'halte', 'haltes',
  'hamac', 'hamacs', 'hamburger', 'hamburgers', 'hameau', 'hameaux',
  'hanche', 'hanches', 'handicap', 'handicaps', 'hangar', 'hangars',
  'harpe', 'harpes', 'hasch', 'hate', 'hates', 'haut', 'haute', 'hauts',
  'hautes', 'hauteur', 'hauteurs', 'hache', 'haches', 'haricot', 'haricots',
  'harnais', 'heros', 'hibou', 'hiboux', 'hierarchie', 'hierarchies',
  'hockey', 'homard', 'homards', 'honte', 'hontes', 'hoquet', 'hoquets',
  'horde', 'hordes', 'hors', 'housse', 'housses', 'houle', 'houblon',
  'hurlement', 'hurlements', 'hutte', 'huttes', 'huit', 'huitieme',
]);

// Words that start with a vowel sound spelled with a vowel letter but that
// French still treats as consonant-initial for elision/liaison purposes.
const NO_ELISION_VOWEL_INITIAL = new Set([
  'onze', 'onzieme', 'uhlan', 'yaourt', // common exceptions, not exhaustive
]);

function stripAccents(word) {
  return word.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function startsWithVowelSound(word) {
  const w = stripAccents(word.toLowerCase());
  if (NO_ELISION_VOWEL_INITIAL.has(w)) return false;
  if (/^h/.test(w)) {
    // Most h-initial French words have a silent h and elide normally;
    // h-aspire words are the (spelling-invisible) exception.
    return !H_ASPIRE.has(w);
  }
  return /^[aeiouy]/.test(w);
}

/**
 * Get the French article for a noun.
 * @param {string} word - the noun, singular form (lemma), no article.
 * @param {'m'|'f'|'epicene'} gender
 * @param {boolean} pluraleTantum - true for words only used in plural (vacances, gens...)
 * @param {'definite'|'indefinite'} mode
 * @param {'m'|'f'} [referentGender] - required when gender is 'epicene', since the
 *   article for an epicene noun (cycliste, artiste...) depends on the sex of the
 *   person referred to, not the word itself.
 * @returns {string} the article, e.g. "le", "la", "l'", "un", "une", "les", "des"
 */
export function getFrenchArticle(word, gender, pluraleTantum, mode, referentGender) {
  if (pluraleTantum) {
    return mode === 'definite' ? 'les' : 'des';
  }

  let g = gender;
  if (g === 'epicene') {
    if (!referentGender) {
      throw new Error('referentGender is required for epicene nouns');
    }
    g = referentGender;
  }

  if (mode === 'definite' && startsWithVowelSound(word)) {
    return "l'";
  }
  if (mode === 'definite') {
    return g === 'f' ? 'la' : 'le';
  }
  // indefinite
  return g === 'f' ? 'une' : 'un';
}
