import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { GAME_META } from '../engine/srs'
import './Stats.css'

const GAMES = ['racecar', 'pairmatch', 'flashcard', 'gapfill', 'typing']
const STATUS_COLORS = { unseen: '#bbb', learning: '#f0a500', mastered: '#22a06b' }

function Bar({ value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="stat-bar-wrap">
      <div className="stat-bar-track">
        <div className="stat-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="stat-bar-val">{value}</span>
    </div>
  )
}

function ScoreDist({ entries, scores, game }) {
  const dist = [0, 0, 0, 0, 0, 0] // index = score 0–5
  for (const e of entries) {
    const s = scores[e.id]?.[game]?.score ?? 0
    dist[s]++
  }
  const max = Math.max(...dist, 1)
  const color = GAME_META[game]?.color ?? '#4f7ef8'

  return (
    <div className="sd-wrap">
      <div className="sd-bars">
        {dist.map((count, i) => (
          <div key={i} className="sd-col">
            <div
              className="sd-bar"
              style={{ height: `${Math.round((count / max) * 48)}px`, background: color }}
            />
            <span className="sd-score">{i}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Stats() {
  const { setScreen, activeEntries, loadedLists, selectedIds, scores } = useApp()

  const globalCounts = useMemo(() => {
    const c = { unseen: 0, learning: 0, mastered: 0 }
    for (const e of activeEntries) {
      const status = scores[e.id]?.global ?? 'unseen'
      c[status]++
    }
    return c
  }, [activeEntries, scores])

  const perList = useMemo(() => {
    return selectedIds.map(id => {
      const list = loadedLists[id]
      if (!list) return null
      const c = { unseen: 0, learning: 0, mastered: 0 }
      for (const e of list.entries) {
        const status = scores[e.id]?.global ?? 'unseen'
        c[status]++
      }
      return { id, label: list.id, entries: list.entries, counts: c }
    }).filter(Boolean)
  }, [selectedIds, loadedLists, scores])

  const total = activeEntries.length

  return (
    <div className="stats-screen">
      <div className="stats-header">
        <button className="stats-back" onClick={() => setScreen('setup')}>← Back</button>
        <span className="stats-title">Progress</span>
      </div>

      <div className="stats-body">

        {total === 0 ? (
          <div className="stats-empty">Select a vocab list on the home screen first.</div>
        ) : (
          <>
            {/* Overall status */}
            <section className="stats-section">
              <h2>Overall · {total} words</h2>

              <div className="status-rows">
                {['mastered', 'learning', 'unseen'].map(s => (
                  <div key={s} className="status-row">
                    <span className="status-dot" style={{ background: STATUS_COLORS[s] }} />
                    <span className="status-name">{s.charAt(0).toUpperCase() + s.slice(1)}</span>
                    <Bar value={globalCounts[s]} max={total} color={STATUS_COLORS[s]} />
                    <span className="status-pct">
                      {total > 0 ? Math.round((globalCounts[s] / total) * 100) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Per-list breakdown */}
            {perList.length > 1 && (
              <section className="stats-section">
                <h2>By list</h2>
                {perList.map(l => (
                  <div key={l.id} className="list-stat">
                    <div className="list-stat-label">{l.label} · {l.entries.length}</div>
                    <div className="list-stat-bar">
                      {['mastered', 'learning', 'unseen'].map(s => {
                        const pct = l.entries.length > 0
                          ? (l.counts[s] / l.entries.length) * 100
                          : 0
                        return pct > 0 ? (
                          <div
                            key={s}
                            className="list-stat-segment"
                            style={{ width: `${pct}%`, background: STATUS_COLORS[s] }}
                            title={`${s}: ${l.counts[s]}`}
                          />
                        ) : null
                      })}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* Per-game score distributions */}
            <section className="stats-section">
              <h2>Score distributions</h2>
              <p className="stats-hint">Bars show how many words are at each score level (0–5) per game.</p>
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

            {/* Mastery summary */}
            <section className="stats-section">
              <h2>Mastery</h2>
              <div className="mastery-grid">
                <div className="mastery-num" style={{ color: '#22a06b' }}>{globalCounts.mastered}</div>
                <div className="mastery-label">Mastered</div>
                <div className="mastery-num" style={{ color: '#f0a500' }}>{globalCounts.learning}</div>
                <div className="mastery-label">Learning</div>
                <div className="mastery-num" style={{ color: '#bbb' }}>{globalCounts.unseen}</div>
                <div className="mastery-label">Unseen</div>
              </div>
            </section>
          </>
        )}

      </div>
    </div>
  )
}
