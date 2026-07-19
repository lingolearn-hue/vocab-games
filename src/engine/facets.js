/**
 * "Train all facets" mode — instead of one manual display setting applying
 * to every card, each box (which is also each card's current score/mastery
 * level) drives its own facet:
 *
 *   box 0, 1        → normal (default prompt/answer, reading shown)
 *   box 2, 4        → translation flip (word and translation swap sides)
 *   box 3           → no reading (furigana/pinyin annotation hidden)
 *   box 5 (zh/ja)   → reading only (hanzi/kanji replaced by its reading —
 *                      the hardest recall test)
 *   box 5 (other)   → no-op, same as normal (no `reading` concept to test)
 *
 * This means a single card works through every facet of a word as it
 * matures, rather than Anki's approach of auto-generating a separate card
 * per facet — deliberately, so stats/progress stay attached to one card
 * per word instead of fragmenting across several.
 *
 * Returns an absolute override — not merged with the manual toggles, since
 * enabling facetsByBox already resets those to defaults (see
 * AppContext.setFacetsByBox) precisely so there's no leftover manual state
 * to merge with.
 */
export function resolveFacet(box, language) {
  const isCJK = language === 'zh' || language === 'ja'

  switch (box) {
    case 2:
    case 4:
      return { direction: 'translation->entry', showReading: true, readingOnly: false }
    case 3:
      return { direction: 'entry->translation', showReading: false, readingOnly: false }
    case 5:
      return { direction: 'entry->translation', showReading: true, readingOnly: isCJK }
    default:
      return { direction: 'entry->translation', showReading: true, readingOnly: false }
  }
}
