import './LeitnerBar.css'

const FACET_ICONS = { 2: '⇄', 3: '子', 4: '⇄', 5: '⇵' }

/**
 * Shared Leitner box/pass progress bar — shows all 6 boxes (0-4, plus
 * mastered box 5) with counts and per-box pass-progress fill. Used by any
 * game wired into the Leitner engine (Flashcard, StrokeOrder, PairMatch),
 * each with its own independent score/session storage via the `game` key
 * passed to the leitner engine functions that produced `boxCounts`/`passState`.
 *
 * If `onOpenBox` is provided, every box (0-5) is tappable to manually open
 * that box's pass on demand (see engine/leitner.js's openBox) — including
 * box 5 (mastered), which behaves like a normal box once opened. The only
 * thing special about box 5 is it's never picked automatically.
 *
 * If `facetsByBox` is true, a small badge appears above boxes 2-5 showing
 * which display facet that box drives (see engine/facets.js) — skipped for
 * box 5 on non-CJK languages, where it's a no-op.
 */
export default function LeitnerBar({ boxCounts, passState, onOpenBox, facetsByBox, language }) {
  const isCJK = language === 'zh' || language === 'ja'
  return (
    <div className="lb-bar">
      {[0,1,2,3,4,5].map(b => {
        const openable = onOpenBox && (boxCounts[b] ?? 0) > 0
        const Tag = openable ? 'button' : 'div'
        const showFacetBadge = facetsByBox && FACET_ICONS[b] && (b !== 5 || isCJK)
        return (
          <Tag
            key={b}
            className={`lb-box ${passState.currentPass === b ? 'active' : ''} ${b === 5 ? 'box-mastered' : ''} ${openable ? 'lb-box--openable' : ''}`}
            {...(openable ? { onClick: () => onOpenBox(b), title: `Practice box ${b} now` } : {})}
          >
            {showFacetBadge && <span className="lb-facet-badge">{FACET_ICONS[b]}</span>}
            <span className="lb-label">{b === 5 ? '★' : b}</span>
            <span className="lb-count">{boxCounts[b] ?? 0}</span>
            <div className="lb-progress">
              <div className="lb-fill" style={{ width: `${((passState.barFills?.[b] ?? 0) * 100).toFixed(1)}%` }} />
            </div>
          </Tag>
        )
      })}
    </div>
  )
}
