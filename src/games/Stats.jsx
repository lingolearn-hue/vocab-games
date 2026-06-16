import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { getAllScores } from '../engine/leitner'
import './Stats.css'

// Score → display config
const SCORE_CONFIG = [
  { score: 0, label: 'Unseen',   color: '#bbb'    },
  { score: 1, label: 'Score 1',  color: '#4f7ef8' },
  { score: 2, label: 'Score 2',  color: '#7b6cf8' },
  { score: 3, label: 'Score 3',  color: '#f0a500' },
  { score: 4, label: 'Score 4',  color: '#e07a30' },
  { score: 5, label: 'Mastered', color: '#22a06b' },
]

export default function Stats() {
  const {
    goBack, activeEntries, availableLevels, settings, updateSettings
  } = useApp()

  const fcScores = getAllScores('flashcard')

  // Ordered levels for chip display
  const orderedLevels = availableLevels ?? []
  const activeLevels  = settings.levels?.global ?? null

  function isLevelActive(level) {
    return !activeLevels || activeLevels.includes(level)
  }

  function toggleLevel(level) {
    const current = activeLevels ?? orderedLevels
    const has = current.includes(level)
    let next = has ? current.filter(l => l !== level) : [...current, level]
    if (next.length === 0) next = null
    if (next?.length === orderedLevels.length) next = null
    updateSettings({ levels: { ...settings.levels, global: next } })
  }

  // Score distribution for active entries
  const dist = useMemo(() => {
    const d = [0, 0, 0, 0, 0, 0]
    for (const e of activeEntries) d[Math.min(fcScores[e.id] ?? 0, 5)]++
    return d
  }, [activeEntries, fcScores])

  const total = activeEntries.length

  return (
    <div className="stats-screen">
      <div className="stats-header">
        <button className="stats-back" onClick={goBack}>← Back</button>
        <span className="stats-title">Progress</span>
      </div>

      <div className="stats-body">
        {total === 0 ? (
          <div className="stats-empty">Select a language on the home screen first.</div>
        ) : (<>

          {/* ── Level filter chips ── */}
          {orderedLevels.length > 0 && (
            <div className="stats-level-filter">
              {orderedLevels.map(level => (
                <button
                  key={level}
                  className={`level-chip ${isLevelActive(level) ? 'active' : ''}`}
                  onClick={() => toggleLevel(level)}
                >
                  {level}
                </button>
              ))}
            </div>
          )}

          {/* ── Score boxes: Unseen · Score 1–4 · Mastered ── */}
          <div className="stats-score-grid">
            {SCORE_CONFIG.map(({ score, label, color }) => {
              const count = dist[score] ?? 0
              const pct   = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <div key={score} className="stats-score-box" style={{ '--box-color': color }}>
                  <div className="stats-score-count">{count}</div>
                  <div className="stats-score-label">{label}</div>
                  <div className="stats-score-pct">{pct}%</div>
                </div>
              )
            })}
          </div>

          <div className="stats-total">{total} words total · Flashcard scores</div>

        </>)}
      </div>
    </div>
  )
}
