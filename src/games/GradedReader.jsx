import { useState, useEffect, useMemo, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { buildLookup, tokenise, loadReaderPassages } from '../engine/reader'
import { TextWithLookup } from '../components/TextWithLookup'
import LevelChooser from '../components/LevelChooser'
import HelpButton from '../components/HelpButton'
import './GradedReader.css'

// Tags that get a display label; others shown as-is
const TAG_LABELS = {
  'fiction':     'Fiction',
  'non-fiction': 'Non-fiction',
  'biography':   'Biography',
  'essay':       'Essay',
  'beginner':    'Beginner',
  'intermediate':'Intermediate',
  'advanced':    'Advanced',
}

function tagLabel(tag) {
  if (TAG_LABELS[tag]) return TAG_LABELS[tag]
  if (tag.startsWith('topic:'))  return tag.slice(6).replace(/-/g, ' ')
  if (tag.startsWith('series:')) return tag.slice(7)
  return tag
}

export default function GradedReader() {
  const { activeEntries, loadedLists, selectedIds, showReading, scores, goBack, activeLanguage } = useApp()

  const [passages,        setPassages]        = useState([])
  const [loading,         setLoading]         = useState(true)
  const [activePassage,   setActivePassage]   = useState(null)
  const [pastedText,      setPastedText]      = useState('')
  const [pastedTitle,     setPastedTitle]     = useState('')
  const [mode,            setMode]            = useState('library')
  const [customPassage,   setCustomPassage]   = useState(null)
  const [showTranslation, setShowTranslation] = useState(false)
  const [activeTags,      setActiveTags]      = useState(new Set())
  const [search,          setSearch]          = useState('')
  const textAreaRef = useRef(null)

  const language = useMemo(() => {
    if (activeLanguage) return activeLanguage
    const firstList = selectedIds.map(id => loadedLists[id]).find(Boolean)
    return firstList?.language ?? 'zh'
  }, [activeLanguage, selectedIds, loadedLists])

  const lookup = useMemo(() => buildLookup(activeEntries), [activeEntries])

  useEffect(() => {
    if (!activeLanguage) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch on language change
    setLoading(true)
    loadReaderPassages(`${activeLanguage}-en`).then(data => {
      setPassages(data?.passages ?? [])
      setLoading(false)
    })
  }, [activeLanguage])

  // Derive available levels and tags from passages
  const availableLevels = useMemo(() => {
    const s = new Set(passages.map(p => p.level).filter(Boolean))
    // Sort: A1<A2<B1<B2<C1<C2, then N5<N4<N3<N2<N1, then HSK1..7(7-9)
    const order = ['A1','A2','B1','B2','C1','C2','N5','N4','N3','N2','N1','HSK1','HSK2','HSK3','HSK4','HSK5','HSK6','HSK7']
    return [...s].sort((a,b) => {
      const ai = order.indexOf(a), bi = order.indexOf(b)
      if (ai >= 0 && bi >= 0) return ai - bi
      return a.localeCompare(b)
    })
  }, [passages])

  const availableTags = useMemo(() => {
    const allTags = new Set(passages.flatMap(p => p.tags ?? []))
    // Exclude level-like tags (beginner/intermediate/advanced) — now handled by level chips
    const levelLike = new Set(['beginner','intermediate','advanced'])
    const typeTags  = ['fiction','non-fiction','biography','essay'].filter(t => allTags.has(t))
    const topicTags = [...allTags].filter(t => !levelLike.has(t) && !['fiction','non-fiction','biography','essay'].includes(t)).sort()
    return [...typeTags, ...topicTags]
  }, [passages])

  // Active levels (multi-select, same null=all pattern as the rest of the app) + active tags (multi)
  const [activeLevels, setActiveLevels] = useState(null)

  const filteredPassages = useMemo(() => {
    const q = search.trim().toLowerCase()
    return passages.filter(p => {
      if (activeLevels && !activeLevels.includes(p.level)) return false
      if (activeTags.size > 0) {
        const ptags = new Set(p.tags ?? [])
        if (![...activeTags].every(t => ptags.has(t))) return false
      }
      if (q) {
        return p.title?.toLowerCase().includes(q) ||
               p.text?.toLowerCase().includes(q) ||
               p.titleTranslation?.toLowerCase().includes(q)
      }
      return true
    })
  }, [passages, activeLevels, activeTags, search])

  function toggleTag(tag) {
    setActiveTags(prev => {
      const next = new Set(prev)
      next.has(tag) ? next.delete(tag) : next.add(tag)
      return next
    })
  }

  function openPassage(p) {
    setActivePassage(p)
    setCustomPassage(null)
    setShowTranslation(false)
  }

  function openCustom() {
    if (!pastedText.trim()) return
    setCustomPassage({ id: 'custom', title: pastedTitle || 'Custom text', text: pastedText, translation: null })
    setActivePassage(null)
    setShowTranslation(false)
  }

  const currentPassage = activePassage ?? customPassage

  // ── List view ──────────────────────────────────────────────────────────────
  if (!currentPassage) {
    return (
      <div className="gr-screen">
        <div className="gr-header">
          <button className="gr-back" onClick={goBack}>← Back</button>
          <span className="gr-title">Reader</span>
          <div className="gr-header-tabs">
            <button className={`gr-tab ${mode === 'library' ? 'active' : ''}`} onClick={() => setMode('library')}>Library</button>
            <button className={`gr-tab ${mode === 'paste'   ? 'active' : ''}`} onClick={() => setMode('paste')}>Paste</button>
          </div>
          <HelpButton
            title="Graded Reader"
            description="Read short passages at your level. Tap any word for its translation, and toggle the EN button while reading for a full translation."
          />
        </div>

        {mode === 'library' ? (
          <div className="gr-body">
            {loading ? (
              <div className="gr-empty">Loading…</div>
            ) : passages.length === 0 ? (
              <div className="gr-empty">
                {activeLanguage ? 'No passages available for this language yet.' : 'Select a language on the home screen first.'}
              </div>
            ) : (
              <>
                {/* ── Level chips — prominent row at top ── */}
                {(() => {
                  const typeTags  = ['fiction','non-fiction','biography','essay'].filter(t => availableTags.includes(t))
                  const topicTags = availableTags.filter(t => !typeTags.includes(t))
                  if (availableLevels.length === 0 && availableTags.length === 0) return null
                  return (
                    <div className="gr-filters">
                      {availableLevels.length > 0 && (
                        <LevelChooser levels={availableLevels} value={activeLevels} onChange={setActiveLevels} className="gr-filter-levels" />
                      )}
                      {(typeTags.length > 0 || topicTags.length > 0) && (
                        <div className="gr-filter-tags">
                          {typeTags.length > 0 && (
                            <div className="gr-tag-row">
                              <span className="gr-tag-row-label">Type</span>
                              <div className="gr-tag-scroll">
                                {typeTags.map(tag => (
                                  <button key={tag} className={`gr-tag-chip ${activeTags.has(tag) ? 'active' : ''}`} onClick={() => toggleTag(tag)}>
                                    {tagLabel(tag)}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {topicTags.length > 0 && (
                            <div className="gr-tag-row">
                              <span className="gr-tag-row-label">Topic</span>
                              <div className="gr-tag-scroll">
                                {topicTags.map(tag => (
                                  <button key={tag} className={`gr-tag-chip ${activeTags.has(tag) ? 'active' : ''}`} onClick={() => toggleTag(tag)}>
                                    {tagLabel(tag)}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {(activeTags.size > 0 || activeLevels) && (
                        <button className="gr-tag-clear" onClick={() => { setActiveTags(new Set()); setActiveLevels(null) }}>✕ Clear filters</button>
                      )}
                      <div className="gr-search-row">
                        <input
                          className="gr-search"
                          type="text"
                          placeholder="Search titles or text…"
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                        />
                        {search && <button className="gr-search-clear" onClick={() => setSearch('')}>✕</button>}
                      </div>
                    </div>
                  )
                })()}

                {filteredPassages.length === 0 ? (
                  <div className="gr-empty">No passages match the selected filters.</div>
                ) : (
                  <div className="gr-passage-list">
                    {(() => {
                      const seriesMap = {}
                      const standalones = []
                      filteredPassages.forEach(p => {
                        if (p.series) {
                          if (!seriesMap[p.series]) seriesMap[p.series] = []
                          seriesMap[p.series].push(p)
                        } else {
                          standalones.push(p)
                        }
                      })

                      const renderCard = (p) => {
                        const passageSpans = tokenise(p.text, lookup, language)
                        const matchedIds = [...new Set(passageSpans.filter(s => s.entry).map(s => s.entry.id))]
                        const knownCount = matchedIds.filter(id => (scores[id]?.global ?? 'unseen') !== 'unseen').length
                        return (
                          <button key={p.id} className="gr-passage-card" onClick={() => openPassage(p)}>
                            <div className="gr-passage-card-top">
                              <span className="gr-passage-title">{p.title}</span>
                              {p.level && <span className="gr-passage-level">{p.level}</span>}
                            </div>
                            {p.titleTranslation && <span className="gr-passage-subtitle">{p.titleTranslation}</span>}
                            <div className="gr-passage-card-bottom">
                              <span className="gr-passage-stats">{matchedIds.length} vocab · {knownCount} known</span>
                              {p.tags && (
                                <div className="gr-passage-tags">
                                  {p.tags.filter(t => !t.startsWith('series:') && !['beginner','intermediate','advanced'].includes(t)).slice(0, 3).map(t => (
                                    <span key={t} className="gr-passage-tag">{tagLabel(t)}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </button>
                        )
                      }

                      return (
                        <>
                          {Object.entries(seriesMap).map(([seriesName, seriesPassages]) => (
                            <div key={seriesName} className="gr-series">
                              <div className="gr-series-header">
                                <span className="gr-series-icon">📚</span>
                                <span className="gr-series-name">{seriesName}</span>
                                <span className="gr-series-count">{seriesPassages.length} level{seriesPassages.length !== 1 ? 's' : ''}</span>
                              </div>
                              <div className="gr-series-cards">
                                {seriesPassages.map(renderCard)}
                              </div>
                            </div>
                          ))}
                          {standalones.length > 0 && (
                            <div className="gr-series">
                              {Object.keys(seriesMap).length > 0 && (
                                <div className="gr-series-header">
                                  <span className="gr-series-icon">📄</span>
                                  <span className="gr-series-name">Standalone</span>
                                  <span className="gr-series-count">{standalones.length}</span>
                                </div>
                              )}
                              <div className="gr-series-cards">
                                {standalones.map(renderCard)}
                              </div>
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="gr-body">
            <div className="gr-paste-area">
              <input className="gr-paste-title" placeholder="Title (optional)" value={pastedTitle} onChange={e => setPastedTitle(e.target.value)} />
              <textarea ref={textAreaRef} className="gr-paste-input" placeholder="Paste or type your text here…" value={pastedText} onChange={e => setPastedText(e.target.value)} rows={10} />
              <button className="gr-paste-btn" disabled={!pastedText.trim()} onClick={openCustom}>Read →</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Reading view ───────────────────────────────────────────────────────────
  return (
    <div className="gr-screen">
      <div className="gr-header">
        <button className="gr-back" onClick={() => { setActivePassage(null); setCustomPassage(null) }}>← Back</button>
        <span className="gr-title gr-reading-title">{currentPassage.title}</span>
        {currentPassage.translation && (
          <button className={`gr-trans-toggle ${showTranslation ? 'active' : ''}`} onClick={() => setShowTranslation(t => !t)}>EN</button>
        )}
        <HelpButton
          title="Graded Reader"
          description="Read short passages at your level. Tap any word for its translation, and toggle the EN button while reading for a full translation."
        />
      </div>

      <div className="gr-body gr-reading-body">
        <div className="gr-text">
          <TextWithLookup text={currentPassage.text} language={language} lookup={lookup} scores={scores} showReading={showReading} />
        </div>

        {showTranslation && currentPassage.translation && (
          <div className="gr-translation"><p>{currentPassage.translation}</p></div>
        )}

        <div className="gr-legend">
          <span className="gr-legend-item gr-legend--mastered">mastered</span>
          <span className="gr-legend-item gr-legend--learning">learning</span>
          <span className="gr-legend-item gr-legend--unseen">unseen</span>
          <span className="gr-legend-item gr-legend--unknown">not in list</span>
        </div>
      </div>
    </div>
  )
}
