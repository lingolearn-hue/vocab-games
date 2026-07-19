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

function useScoreDist(activeEntries, scores) {
  return useMemo(() => {
    const d = [0, 0, 0, 0, 0, 0]
    for (const e of activeEntries) d[Math.min(scores[e.id] ?? 0, 5)]++
    return d
  }, [activeEntries, scores])
}

function GameScoreSection({ label, dist, total }) {
  return (
    <>
      <div className="stats-game-label">{label}</div>
      <div className="stats-score-grid">
        {SCORE_CONFIG.map(({ score, color }) => {
          const count = dist[score] ?? 0
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
    </>
  )
}

export default function Stats() {
  const { goBack, getEntriesForGame } = useApp()
  const { entries: activeEntries } = getEntriesForGame('flashcard')

  const fcScores = getAllScores('flashcard')
  const soScores = getAllScores('stroke')
  const pmScores = getAllScores('pairmatch')

  // Score distribution for active entries
  const fcDist = useScoreDist(activeEntries, fcScores)
  const soDist = useScoreDist(activeEntries, soScores)
  const pmDist = useScoreDist(activeEntries, pmScores)

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

          <GameScoreSection label="Flashcard"    dist={fcDist} total={total} />
          <GameScoreSection label="Matching"      dist={pmDist} total={total} />
          <GameScoreSection label="Stroke Order"  dist={soDist} total={total} />

          <div className="stats-total">{total} words in active selection</div>

        </>)}
      </div>
    </div>
  )
}
