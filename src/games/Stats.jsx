import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { GAME_META } from '../engine/srs'
import './Stats.css'

const GAMES = ['racecar', 'pairmatch', 'flashcard', 'gapfill', 'typing']
const STATUS_COLORS = { unseen: '#ccc', learning: '#f0a500', mastered: '#22a06b' }

// SRS thresholds — a word is "due" if its best game score is low enough that it
// hasn't been seen recently enough. We approximate: score < 3 across all games = learning/due.
function getEntryStatus(scores, id) {
  const rec = scores[id]
  if (!rec || !rec.global) return 'unseen'
  return rec.global
}

function isDue(scores, id) {
  const rec = scores[id]
  if (!rec) return true  // unseen = always due
  const gameScores = GAMES.map(g => rec[g]?.score ?? 0)
  const avgScore = gameScores.reduce((a, b) => a + b, 0) / gameScores.length
  return avgScore < 3.5
}

function Bar({ value, max, color, label }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="stat-bar-wrap">
      {label && <span className="stat-bar-label">{label}</span>}
      <div className="stat-bar-track">
        <div className="stat-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="stat-bar-val">{value}</span>
    </div>
  )
}

function ScoreDist({ entries, scores, game }) {
  const dist = [0, 0, 0, 0, 0, 0]
  for (const e of entries) {
    const s = scores[e.id]?.[game]?.score ?? 0
    dist[s]++
  }
  const max = Math.max(...dist, 1)
  const color = GAME_META[game]?.color ?? '#4f7ef8'
  const played = dist.slice(1).reduce((a, b) => a + b, 0)

  return (
    <div className="sd-wrap">
      <div className="sd-bars">
        {dist.map((count, i) => (
          <div key={i} className="sd-col">
            <div className="sd-bar" style={{ height: `${Math.round((count / max) * 48)}px`, background: i === 0 ? '#e0e0e0' : color }} />
            <span className="sd-score">{i}</span>
          </div>
        ))}
      </div>
      <div className="sd-meta">
        {played > 0
          ? `${played}/${entries.length} played · avg ${entries.length > 0 ? (entries.reduce((s, e) => s + (scores[e.id]?.[game]?.score ?? 0), 0) / entries.length).toFixed(1) : 0}`
          : 'Not played yet'}
      </div>
    </div>
  )
}

export default function Stats() {
  const { setScreen, activeEntries, loadedLists, selectedIds, scores } = useApp()

  const globalCounts = useMemo(() => {
    const c = { unseen: 0, learning: 0, mastered: 0, due: 0 }
    for (const e of activeEntries) {
      const status = getEntryStatus(scores, e.id)
      c[status]++
      if (isDue(scores, e.id)) c.due++
    }
    return c
  }, [activeEntries, scores])

  const perList = useMemo(() =>
    selectedIds.map(id => {
      const list = loadedLists[id]
      if (!list) return null
      const c = { unseen: 0, learning: 0, mastered: 0 }
      for (const e of list.entries) {
        const status = getEntryStatus(scores, e.id)
        c[status]++
      }
      return { id, label: list.id, entries: list.entries, counts: c }
    }).filter(Boolean),
  [selectedIds, loadedLists, scores])

  // Per-game summary: avg score + % played
  const perGame = useMemo(() =>
    GAMES.filter(g => GAME_META[g]).map(game => {
      const played  = activeEntries.filter(e => (scores[e.id]?.[game]?.score ?? 0) > 0).length
      const avgScore = activeEntries.length > 0
        ? (activeEntries.reduce((s, e) => s + (scores[e.id]?.[game]?.score ?? 0), 0) / activeEntries.length).toFixed(1)
        : '—'
      const masteredPct = activeEntries.length > 0
        ? Math.round(activeEntries.filter(e => (scores[e.id]?.[game]?.score ?? 0) >= 4).length / activeEntries.length * 100)
        : 0
      return { game, played, avgScore, masteredPct }
    }),
  [activeEntries, scores])

  const total = activeEntries.length

  return (
    <div className="stats-screen">
      <div className="stats-header">
        <button className="stats-back" onClick={() => setScreen('setup')}>← Back</button>
        <span className="stats-title">Progress</span>
      </div>

      <div className="stats-body">
        {total === 0 ? (
          <div className="stats-empty">Select a language on the home screen first.</div>
        ) : (<>

          {/* ── Overview cards ── */}
          <div className="stats-overview">
            <div className="stats-overview-card">
              <div className="stats-overview-num" style={{ color: '#22a06b' }}>{globalCounts.mastered}</div>
              <div className="stats-overview-label">Mastered</div>
            </div>
            <div className="stats-overview-card">
              <div className="stats-overview-num" style={{ color: '#f0a500' }}>{globalCounts.learning}</div>
              <div className="stats-overview-label">Learning</div>
            </div>
            <div className="stats-overview-card">
              <div className="stats-overview-num" style={{ color: '#bbb' }}>{globalCounts.unseen}</div>
              <div className="stats-overview-label">Unseen</div>
            </div>
            <div className="stats-overview-card">
              <div className="stats-overview-num" style={{ color: '#4f7ef8' }}>{globalCounts.due}</div>
              <div className="stats-overview-label">Due for review</div>
            </div>
          </div>

          {/* ── Status bars ── */}
          <section className="stats-section">
            <h2>Overall · {total} words</h2>
            <div className="status-rows">
              {['mastered', 'learning', 'unseen'].map(s => (
                <div key={s} className="status-row">
                  <span className="status-dot" style={{ background: STATUS_COLORS[s] }} />
                  <span className="status-name">{s.charAt(0).toUpperCase() + s.slice(1)}</span>
                  <Bar value={globalCounts[s]} max={total} color={STATUS_COLORS[s]} />
                  <span className="status-pct">{total > 0 ? Math.round((globalCounts[s] / total) * 100) : 0}%</span>
                </div>
              ))}
            </div>
          </section>

          {/* ── Per-game breakdown ── */}
          <section className="stats-section">
            <h2>By game</h2>
            <div className="game-table">
              <div className="game-table-head">
                <span>Game</span><span>Played</span><span>Avg</span><span>≥4</span>
              </div>
              {perGame.map(({ game, played, avgScore, masteredPct }) => (
                <div key={game} className="game-table-row">
                  <span className="game-table-name" style={{ color: GAME_META[game].color }}>
                    {GAME_META[game].label}
                  </span>
                  <span>{played}/{total}</span>
                  <span>{avgScore}</span>
                  <span>{masteredPct}%</span>
                </div>
              ))}
            </div>
          </section>

          {/* ── Per-list stacked bars ── */}
          {perList.length > 1 && (
            <section className="stats-section">
              <h2>By list</h2>
              {perList.map(l => (
                <div key={l.id} className="list-stat">
                  <div className="list-stat-label">{l.label} · {l.entries.length}</div>
                  <div className="list-stat-bar">
                    {['mastered', 'learning', 'unseen'].map(s => {
                      const pct = l.entries.length > 0 ? (l.counts[s] / l.entries.length) * 100 : 0
                      return pct > 0 ? (
                        <div key={s} className="list-stat-segment"
                          style={{ width: `${pct}%`, background: STATUS_COLORS[s] }}
                          title={`${s}: ${l.counts[s]}`} />
                      ) : null
                    })}
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* ── Score histograms ── */}
          <section className="stats-section">
            <h2>Score distributions</h2>
            <p className="stats-hint">Number of words at each score level (0–5).</p>
            <div className="game-dists">
              {GAMES.filter(g => GAME_META[g]).map(game => (
                <div key={game} className="game-dist">
                  <div className="game-dist-label" style={{ color: GAME_META[game].color }}>
                    {GAME_META[game].label}
                  </div>
                  <ScoreDist entries={activeEntries} scores={scores} game={game} />
                </div>
              ))}
            </div>
          </section>

        </>)}
      </div>
    </div>
  )
}
