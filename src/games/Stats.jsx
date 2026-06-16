import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import LevelChips from '../components/LevelChips'
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
  const { goBack, getEntriesForGame } = useApp()
  const { entries: activeEntries } = getEntriesForGame('flashcard')

  const fcScores = getAllScores('flashcard')
  const soScores = getAllScores('stroke')


  // Score distribution for active entries
  const fcDist = useMemo(() => {
    const d = [0, 0, 0, 0, 0, 0]
    for (const e of activeEntries) d[Math.min(fcScores[e.id] ?? 0, 5)]++
    return d
  }, [activeEntries, fcScores])

  const soDist = useMemo(() => {
    const d = [0, 0, 0, 0, 0, 0]
    for (const e of activeEntries) d[Math.min(soScores[e.id] ?? 0, 5)]++
    return d
  }, [activeEntries, soScores])

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
          <LevelChips />

          {/* ── Flashcard score boxes ── */}
          <div className="stats-game-label">Flashcard</div>
          <div className="stats-score-grid">
            {SCORE_CONFIG.map(({ score, color }) => {
              const count = fcDist[score] ?? 0
              const pct   = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <div key={score} className="stats-score-box" style={{ '--box-color': color }}>
                  <div className="stats-score-count">{count}</div>
                  <div className="stats-score-pct">{pct}%</div>
                </div>
              )
            })}
          </div>
          <div className="stats-score-label-row">
            {SCORE_CONFIG.map(({ score, label, color }) => (
              <div key={score} className="stats-score-label-item" style={{ '--label-color': color }}>{label}</div>
            ))}
          </div>

          {/* ── Stroke score boxes ── */}
          <div className="stats-game-label">Stroke Order</div>
          <div className="stats-score-grid">
            {SCORE_CONFIG.map(({ score, color }) => {
              const count = soDist[score] ?? 0
              const pct   = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <div key={score} className="stats-score-box" style={{ '--box-color': color }}>
                  <div className="stats-score-count">{count}</div>
                  <div className="stats-score-pct">{pct}%</div>
                </div>
              )
            })}
          </div>
          <div className="stats-score-label-row">
            {SCORE_CONFIG.map(({ score, label, color }) => (
              <div key={score} className="stats-score-label-item" style={{ '--label-color': color }}>{label}</div>
            ))}
          </div>

          <div className="stats-total">{total} words in active selection</div>

        </>)}
      </div>
    </div>
  )
}
