import { useState, useMemo, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { GAME_META, resetToLearning, getAllScores } from '../engine/srs'
import { getAllMnemonics } from '../engine/mnemonics'
import RubyText from '../components/RubyText'
import './VocabBrowser.css'

const GAMES = ['racecar', 'pairmatch', 'flashcard', 'gapfill', 'typing']
const GLOBAL_COLORS = {
  unseen:   '#bbb',
  learning: '#f0a500',
  mastered: '#22a06b',
}

export default function VocabBrowser() {
  const { activeEntries, loadedLists, selectedIds, showReading, setScreen, scoreActions, scores } = useApp()

  const [search,       setSearch]       = useState('')
  const [filterLevel,  setFilterLevel]  = useState('all')
  const [filterPos,    setFilterPos]    = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showTrans,    setShowTrans]    = useState(true)
  const [showScores,   setShowScores]   = useState(true)
  const [expandedId,   setExpandedId]   = useState(null)  // entry id with mnemonic expanded
  const mnemonics = useMemo(() => getAllMnemonics(), [scores])

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

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return activeEntries.filter(e => {
      if (filterLevel !== 'all' && e.level !== filterLevel) return false
      if (filterPos   !== 'all' && e.pos   !== filterPos)   return false

      const rec = scores[e.id]
      const status = rec?.global ?? 'unseen'
      if (filterStatus !== 'all' && status !== filterStatus) return false

      if (q) {
        const inEntry  = e.entry.toLowerCase().includes(q)
        const inRead   = e.reading?.toLowerCase().includes(q)
        const inTrans  = e.translation.some(t => t.toLowerCase().includes(q))
        if (!inEntry && !inRead && !inTrans) return false
      }
      return true
    })
  }, [activeEntries, scores, search, filterLevel, filterPos, filterStatus])

  function handleReset(e, entryId) {
    e.stopPropagation()
    scoreActions.reset(entryId)
  }

  return (
    <div className="vb-screen">
      {/* Header */}
      <div className="vb-header">
        <button className="vb-back" onClick={() => setScreen('setup')}>← Back</button>
        <span className="vb-title">Vocab ({filtered.length})</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button className="vb-gear" onClick={() => setScreen('settings')} title="Settings">⚙️</button>
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
      </div>

      {/* Display toggles */}
      <div className="vb-toggles">
        <button className={`vb-tog ${showTrans  ? 'on' : ''}`} onClick={() => setShowTrans(t  => !t)}>Trans</button>
        <button className={`vb-tog ${showScores ? 'on' : ''}`} onClick={() => setShowScores(s => !s)}>Scores</button>
      </div>

      {/* Legend */}
      {showScores && (
        <div className="vb-legend">
          {GAMES.map(g => (
            <span key={g} className="vb-legend-item" style={{ color: GAME_META[g].color }}>
              {GAME_META[g].label}
            </span>
          ))}
        </div>
      )}

      {/* List */}
      <div className="vb-list">
        {filtered.length === 0 && (
          <div className="vb-empty">No words match the current filters.</div>
        )}
        {filtered.map(entry => {
          const rec    = scores[entry.id]
          const status = rec?.global ?? 'unseen'
          return (
            <div key={entry.id} className="vb-row">
              <span
                className="vb-dot"
                style={{ background: GLOBAL_COLORS[status] }}
                title={status}
              />
              <div className="vb-main">
                <div className="vb-entry-line">
                  <RubyText
                    text={entry.entry}
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

                {mnemonics[entry.id] && (
                  <div className="vb-mnemonic-row">
                    <button
                      className="vb-mnemonic-btn"
                      onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                      title="Show mnemonic"
                    >
                      💡
                    </button>
                    {expandedId === entry.id && (
                      <span className="vb-mnemonic-text">{mnemonics[entry.id].mnemonic}</span>
                    )}
                  </div>
                )}

                {showScores && (
                  <div className="vb-scores">
                    {GAMES.map(g => (
                      <span
                        key={g}
                        className="vb-game-score"
                        style={{ color: GAME_META[g].color }}
                      >
                        {rec?.[g]?.score ?? 0}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {status === 'mastered' && (
                <button className="vb-reset" onClick={e => handleReset(e, entry.id)} title="Reset to learning">↩</button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
