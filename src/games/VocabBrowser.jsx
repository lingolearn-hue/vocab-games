import { useState, useMemo, useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { getAllScores } from '../engine/leitner'
import { getAllMnemonics } from '../engine/mnemonics'
import { displayEntry } from '../engine/vocab'
import { CATEGORY_TREE, resolveLabel } from '../engine/categories'
import RubyText from '../components/RubyText'
import HelpButton from '../components/HelpButton'
import './VocabBrowser.css'

const GLOBAL_COLORS = {
  unseen:   '#bbb',
  learning: '#f0a500',
  mastered: '#22a06b',
}

export default function VocabBrowser() {
  // Intentionally vulgarFilteredEntries, not visibleEntries: the Browser is a
  // reference tool and shouldn't inherit the Setup screen's global topic
  // filter — it gets its own independent category dropdowns below. It does
  // still respect the vulgar-content toggle, since that's a safety setting
  // rather than a topic filter.
  const { vulgarFilteredEntries: activeEntries, activeLanguage, showReading, setScreen, goBack, scoreActions, scores } = useApp()

  const [search,       setSearch]       = useState('')
  const [filterLevel,  setFilterLevel]  = useState('all')
  const [filterPos,    setFilterPos]    = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterParent, setFilterParent] = useState('all')
  const [filterLeaf,    setFilterLeaf]   = useState('all')
  const [showTrans,    setShowTrans]    = useState(true)
  const [showScores,   setShowScores]   = useState(true)
  const [expandedId,   setExpandedId]   = useState(null)  // entry id with mnemonic expanded
  const leitnerScores = useMemo(() => getAllScores('flashcard'), [scores])
  const mnemonics     = useMemo(() => getAllMnemonics(), [scores])
  const [displayCount, setDisplayCount] = useState(100)
  const sentinelRef   = useRef(null)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') setScreen('setup') }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, []) // refresh when scores change

  // Collect filter options from active entries
  const levels = useMemo(() => {
    const s = new Set(activeEntries.map(e => e.level).filter(Boolean))
    return ['all', ...[...s].sort()]
  }, [activeEntries])

  const posOptions = useMemo(() => {
    const s = new Set(activeEntries.map(e => e.pos).filter(Boolean))
    return ['all', ...[...s].sort()]
  }, [activeEntries])

  // Parents/leaves actually present in this entry set, mirroring
  // CategoryChooser's own presence-filtering logic.
  const presentLeafIds = useMemo(() => {
    const set = new Set()
    for (const e of activeEntries) for (const c of (e.categories ?? [])) set.add(c)
    return set
  }, [activeEntries])

  const categoryParents = useMemo(
    () => CATEGORY_TREE
      .map(p => ({ ...p, leaves: p.leaves.filter(l => presentLeafIds.has(l.id)) }))
      .filter(p => p.leaves.length > 0),
    [presentLeafIds]
  )

  const activeParentObj = categoryParents.find(p => p.id === filterParent) ?? null

  // Reset the leaf dropdown whenever the parent changes out from under it
  // eslint-disable-next-line react-hooks/set-state-in-effect -- leaf choice only makes sense for its own parent
  useEffect(() => { setFilterLeaf('all') }, [filterParent])

  // Flat leaf-id filter CategoryChooser/filterByCategory-style consumers expect
  const filterCategory = useMemo(() => {
    if (!activeParentObj) return null
    if (filterLeaf !== 'all') return [filterLeaf]
    return activeParentObj.leaves.map(l => l.id)
  }, [activeParentObj, filterLeaf])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return activeEntries.filter(e => {
      if (filterLevel !== 'all' && e.level !== filterLevel) return false
      if (filterPos   !== 'all' && e.pos   !== filterPos)   return false
      if (filterCategory && !filterCategory.some(c => e.categories?.includes(c))) return false

      const lScore = leitnerScores[e.id] ?? 0
      const status = lScore === 0 ? 'unseen' : lScore >= 5 ? 'mastered' : 'learning'
      if (filterStatus !== 'all' && status !== filterStatus) return false

      if (q) {
        const inEntry  = e.entry.toLowerCase().includes(q)
        const inRead   = e.reading?.toLowerCase().includes(q)
        const inTrans  = e.translation.some(t => t.toLowerCase().includes(q))
        if (!inEntry && !inRead && !inTrans) return false
      }
      return true
    })
  }, [activeEntries, scores, search, filterLevel, filterPos, filterStatus, filterCategory])

  // Reset window when filtered list changes
  // eslint-disable-next-line react-hooks/set-state-in-effect -- resets pagination whenever the filtered list changes
  useEffect(() => { setDisplayCount(100) }, [filtered])

  // Load more when sentinel scrolls into view
  useEffect(() => {
    if (!sentinelRef.current) return
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) setDisplayCount(n => n + 100)
    }, { threshold: 0.1 })
    obs.observe(sentinelRef.current)
    return () => obs.disconnect()
  }, [filtered])

  const visible = filtered.slice(0, displayCount)

  function handleReset(e, entryId) {
    e.stopPropagation()
    scoreActions.reset(entryId)
  }

  return (
    <div className="vb-screen">
      {/* Header */}
      <div className="vb-header">
        <button className="vb-back" onClick={goBack}>← Back</button>
        <span className="vb-title">Vocab ({filtered.length})</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <HelpButton
            title="Vocab Browser"
            description="Browse every word in the current list, search by entry, reading, or translation, and see your progress at a glance."
          />
        </div>
      </div>

      {/* Search */}
      <div className="vb-search-wrap">
        <input
          className="vb-search"
          type="text"
          placeholder="Search entry, reading, translation…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Filters */}
      <div className="vb-filters">
        <select className="vb-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="unseen">Unseen</option>
          <option value="learning">Learning</option>
          <option value="mastered">Mastered</option>
        </select>
        <select className="vb-select" value={filterLevel} onChange={e => setFilterLevel(e.target.value)}>
          {levels.map(l => <option key={l} value={l}>{l === 'all' ? 'All levels' : l}</option>)}
        </select>
        <select className="vb-select" value={filterPos} onChange={e => setFilterPos(e.target.value)}>
          {posOptions.map(p => <option key={p} value={p}>{p === 'all' ? 'All POS' : p}</option>)}
        </select>
        <select className="vb-select" value={filterParent} onChange={e => setFilterParent(e.target.value)}>
          <option value="all">All topics</option>
          {categoryParents.map(p => <option key={p.id} value={p.id}>{resolveLabel(p.labels, activeLanguage)}</option>)}
        </select>
        {activeParentObj && (
          <select className="vb-select" value={filterLeaf} onChange={e => setFilterLeaf(e.target.value)}>
            <option value="all">All {resolveLabel(activeParentObj.labels, activeLanguage)}</option>
            {activeParentObj.leaves.map(l => <option key={l.id} value={l.id}>{resolveLabel(l.labels, activeLanguage)}</option>)}
          </select>
        )}
      </div>

      {/* Display toggles */}
      <div className="vb-toggles">
        <button className={`vb-tog ${showTrans  ? 'on' : ''}`} onClick={() => setShowTrans(t  => !t)}>Trans</button>
        <button className={`vb-tog ${showScores ? 'on' : ''}`} onClick={() => setShowScores(s => !s)}>Scores</button>
      </div>

      {/* Legend */}
      {showScores && (
        <div className="vb-legend">
          <span className="vb-legend-item" style={{ color: '#4f7ef8' }}>Flashcard score (0–5)</span>
        </div>
      )}

      {/* List */}
      <div className="vb-list">
        {filtered.length === 0 && (
          <div className="vb-empty">No words match the current filters.</div>
        )}
        {visible.map(entry => {
          const lScore = leitnerScores[entry.id] ?? 0
          const status = lScore === 0 ? 'unseen' : lScore >= 5 ? 'mastered' : 'learning'
          return (
            <>
              <div key={entry.id} className="vb-row">
                <span
                  className="vb-dot"
                  style={{ background: GLOBAL_COLORS[status] }}
                  title={status}
                />
                <div className="vb-main">
                  <div className="vb-entry-line">
                    <RubyText
                      text={displayEntry(entry, activeLanguage)}
                      reading={entry.reading}
                      visible={showReading}
                      size="sm"
                    />
                    {entry.level && <span className="vb-level">{entry.level}</span>}
                    {entry.pos   && <span className="vb-pos">{entry.pos}</span>}
                  </div>
                  {showTrans && (
                    <div className="vb-trans">{entry.translation.join(' · ')}</div>
                  )}
                </div>

                {/* Right side: scores + mnemonic + reset */}
                <div className="vb-right">
                  {showScores && (
                    <div className="vb-scores">
                      <span className="vb-game-score" style={{ color: '#4f7ef8' }} title="Flashcard score">
                        {leitnerScores[entry.id] ?? 0}
                      </span>
                    </div>
                  )}
                  {mnemonics[entry.id] && (
                    <button
                      className="vb-mnemonic-btn"
                      onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                      title={expandedId === entry.id ? 'Hide mnemonic' : 'Show mnemonic'}
                    >
                      💡
                    </button>
                  )}
                  {status === 'mastered' && (
                    <button className="vb-reset" onClick={e => handleReset(e, entry.id)} title="Reset to learning">↩</button>
                  )}
                </div>
              </div>
              {expandedId === entry.id && mnemonics[entry.id] && (
                <div className="vb-mnemonic-expanded">{mnemonics[entry.id].mnemonic}</div>
              )}
            </>
          )
        })}
      </div>
    </div>
  )
}
