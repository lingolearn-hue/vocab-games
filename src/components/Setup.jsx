import { useApp } from '../context/AppContext'
import './Setup.css'

const GAMES = [
  { id: 'racecar',   label: '🏎  Race car',      desc: 'Steer into the correct answer' },
  { id: 'pairmatch', label: '🔗  Pair match',    desc: 'Connect 5 word pairs' },
  { id: 'flashcard', label: '🃏  Flashcard',     desc: 'Swipe to learn' },
  { id: 'gapfill',   label: '✏️  Gap fill',      desc: 'Complete the sentence' },
  { id: 'typing',    label: '⌨️  Typing',        desc: 'Type the answer from memory' },
  { id: 'reader',    label: '📖  Graded reader', desc: 'Read texts, tap words to look up' },
  { id: 'dialogue',  label: '💬  Dialogue',      desc: 'Scripted dialogues with comprehension questions' },
  { id: 'vocab',     label: '🗂️  Vocab browser', desc: 'Browse, filter and track progress' },
]

const SCORE_GAMES = ['racecar', 'pairmatch', 'flashcard', 'gapfill']

// Unique languages from available lists
function getLanguages(availableLists) {
  const seen = new Set()
  return availableLists
    .filter(l => { if (seen.has(l.language)) return false; seen.add(l.language); return true })
    .map(l => ({ language: l.language, label: l.languageLabel }))
}

export default function Setup() {
  const {
    availableLists, loadedLists, selectedIds,
    activeEntries, direction, setDirection,
    showReading, setShowReading, scores, setScreen,
    activeLanguage, setActiveLanguage,
  } = useApp()

  const languages = getLanguages(availableLists)

  function avgScore() {
    if (activeEntries.length === 0) return 0
    const total = activeEntries.reduce((s, e) => {
      const rec = scores[e.id]
      const gameAvg = SCORE_GAMES.reduce((gs, g) => gs + (rec?.[g]?.score ?? 0), 0) / SCORE_GAMES.length
      return s + gameAvg
    }, 0)
    return (total / activeEntries.length).toFixed(1)
  }

  const canStart = activeEntries.length >= 3
  const listsForLang = activeLanguage
    ? availableLists.filter(l => l.language === activeLanguage)
    : []

  return (
    <div className="setup">
      <div className="setup-header">
        <h1 className="setup-title">Vocab Games</h1>
        <div className="setup-nav">
          <button className="setup-nav-btn" onClick={() => setScreen('stats')}    title="Stats">📊</button>
          <button className="setup-nav-btn" onClick={() => setScreen('settings')} title="Settings">⚙️</button>
        </div>
      </div>

      {/* Language chooser */}
      <section className="setup-section">
        <h2>Language</h2>
        <div className="lang-grid">
          {languages.map(lang => (
            <button
              key={lang.language}
              className={`lang-card ${activeLanguage === lang.language ? 'active' : ''}`}
              onClick={() => setActiveLanguage(
                activeLanguage === lang.language ? null : lang.language
              )}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </section>

      {/* Sub-list selector — only shown when language has multiple lists */}
      {listsForLang.length > 1 && (
        <section className="setup-section">
          <h2>Lists</h2>
          <div className="list-grid">
            {listsForLang.map(def => {
              const active = selectedIds.includes(def.id)
              const loaded = loadedLists[def.id]
              return (
                <button
                  key={def.id}
                  className={`list-card ${active ? 'active' : ''}`}
                  onClick={() => {/* individual toggle handled manually if needed */}}
                >
                  <span className="list-label">{def.label}</span>
                  {loaded && <span className="list-meta">{loaded.entries.length} words</span>}
                </button>
              )
            })}
          </div>
        </section>
      )}

      <section className="setup-section">
        <h2>Direction</h2>
        <div className="toggle-row">
          <button
            className={`dir-btn ${direction === 'entry->translation' ? 'active' : ''}`}
            onClick={() => setDirection('entry->translation')}
          >
            Foreign → Translation
          </button>
          <button
            className={`dir-btn ${direction === 'translation->entry' ? 'active' : ''}`}
            onClick={() => setDirection('translation->entry')}
          >
            Translation → Foreign
          </button>
        </div>
      </section>

      <section className="setup-section">
        <h2>Reading</h2>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={showReading}
            onChange={e => setShowReading(e.target.checked)}
          />
          Show reading (pinyin / kana / romaji) on prompt side
        </label>
      </section>

      {canStart && (
        <div className="stats-bar">
          {activeEntries.length} words · avg score {avgScore()} / 5
        </div>
      )}

      <section className="setup-section">
        <h2>Choose a game</h2>
        <div className="game-grid">
          {GAMES.map(g => (
            <button
              key={g.id}
              className={`game-card ${!canStart ? 'disabled' : ''}`}
              disabled={!canStart}
              onClick={() => setScreen(g.id)}
            >
              <span className="game-label">{g.label}</span>
              <span className="game-desc">{g.desc}</span>
            </button>
          ))}
        </div>
        {!canStart && (
          <p className="hint">
            {activeLanguage ? 'Loading…' : 'Choose a language above to start.'}
          </p>
        )}
      </section>
    </div>
  )
}
