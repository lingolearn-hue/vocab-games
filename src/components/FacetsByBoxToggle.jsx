import { useApp } from '../context/AppContext'
import './ReadingToggle.css'

/**
 * "Train all facets" toggle — when on, each box drives its own display
 * facet for that card (see engine/facets.js) instead of the manual
 * direction/reading/readingOnly toggles. Turning this on resets those to
 * their defaults; turning any of them on again turns this back off (see
 * AppContext) so the two modes never fight each other.
 */
export default function FacetsByBoxToggle() {
  const { facetsByBox, setFacetsByBox } = useApp()
  return (
    <button
      className={`reading-toggle ${facetsByBox ? 'active' : ''}`}
      onClick={() => setFacetsByBox(v => !v)}
      title={facetsByBox ? 'Stop training facets by box' : 'Train all facets of a word by box'}
    >
      🧩
    </button>
  )
}
