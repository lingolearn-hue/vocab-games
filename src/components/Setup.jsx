<<<<<<< HEAD
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
=======
import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import './Setup.css'

const LANGUAGE_FLAGS = { zh: '🇨🇳', es: '🇪🇸', de: '🇩🇪', ja: '🇯🇵' }

// Level order per language family
const LEVEL_ORDER = {
  zh: ['HSK1','HSK2','HSK3','HSK4','HSK5','HSK6'],
  ja: ['N5','N4','N3','N2','N1'],
  de: ['A1','A2','B1','B2','C1','C2'],
  es: ['A1','A2','B1','B2','C1','C2'],
}

const DRILL_GAMES = [
  { id: 'flashcard', label: '🃏 Flashcard',  desc: 'Swipe to learn' },
  { id: 'racecar',   label: '🏎 Race Car',   desc: 'Steer into the answer' },
  { id: 'pairmatch', label: '🔗 Pair Match', desc: 'Connect word pairs' },
  { id: 'typing',    label: '⌨️ Typing',     desc: 'Type from memory' },
]
const CONTEXT_GAMES = [
  { id: 'gapfill',  label: '✏️ Gap Fill',       desc: 'Complete the sentence' },
  { id: 'reader',   label: '📖 Graded Reader',   desc: 'Tap words to look up' },
  { id: 'dialogue', label: '💬 Dialogue',         desc: 'Comprehension questions' },
]
const GRAMMAR_GAMES = [
  { id: 'grammar',  label: '📐 Grammar Patterns', desc: 'Fill blanks, word order, pick correct' },
  { id: 'matching', label: '🎯 Matching Drills',   desc: 'Gender, tones, measure words' },
]
const SCORE_GAMES = ['racecar', 'pairmatch', 'flashcard', 'gapfill', 'typing']

>>>>>>> 8ad062d (Initial commit_4)
function getLanguages(availableLists) {
  const seen = new Set()
  return availableLists
    .filter(l => { if (seen.has(l.language)) return false; seen.add(l.language); return true })
    .map(l => ({ language: l.language, label: l.languageLabel }))
}

<<<<<<< HEAD
export default function Setup() {
  const {
    availableLists, loadedLists, selectedIds,
    activeEntries, direction, setDirection,
    showReading, setShowReading, scores, setScreen,
    activeLanguage, setActiveLanguage,
  } = useApp()

  const languages = getLanguages(availableLists)
=======
// Single accordion — only one group open at a time
function GroupCard({ title, subtitle, icon, games, canStart, setScreen, isOpen, onOpen }) {
  return (
    <div className={`group-card ${isOpen ? 'open' : ''}`}>
      <button className="group-header" onClick={onOpen}>
        <span className="group-icon">{icon}</span>
        <div className="group-info">
          <span className="group-name">{title}</span>
          <span className="group-sub">{subtitle}</span>
        </div>
        <span className="group-arrow">{isOpen ? '▾' : '›'}</span>
      </button>
      {isOpen && (
        <div className="group-body">
          {games.map(g => (
            <button
              key={g.id}
              className={`sub-game-btn ${!canStart ? 'disabled' : ''}`}
              disabled={!canStart}
              onClick={() => setScreen(g.id)}
            >
              <span className="sub-game-label">{g.label}</span>
              <span className="sub-game-desc">{g.desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Setup() {
  const {
    availableLists, scores, activeEntries, setScreen,
    activeLanguage, setActiveLanguage, settings, updateSettings,
  } = useApp()

  const [langPickerOpen, setLangPickerOpen] = useState(false)
  const [openGroup,      setOpenGroup]      = useState('drills')

  const languages   = getLanguages(availableLists)
  const canStart    = activeEntries.length >= 3
  const currentFlag = activeLanguage ? LANGUAGE_FLAGS[activeLanguage] ?? '🌐' : '🌐'
  const currentLangLabel = languages.find(l => l.language === activeLanguage)?.label ?? 'Choose language'

  // Levels available in current language
  const orderedLevels = useMemo(() => {
    const order = LEVEL_ORDER[activeLanguage] ?? []
    const present = new Set(activeEntries.map(e => e.level).filter(Boolean))
    return order.filter(l => present.has(l))
  }, [activeLanguage, activeEntries])

  // Active level filter (stored in settings.levels.global)
  const activeLevels = settings.levels?.global ?? null // null = all

  function toggleLevel(level) {
    updateSettings(s => {
      const cur = s.levels?.global ?? null
      let next
      if (!cur) {
        next = [level]
      } else if (cur.includes(level)) {
        const filtered = cur.filter(l => l !== level)
        next = filtered.length === 0 ? null : filtered
      } else {
        const merged = [...cur, level]
        next = merged.length === orderedLevels.length ? null : merged
      }
      return { ...s, levels: { ...s.levels, global: next } }
    })
  }

  function isLevelActive(level) {
    return !activeLevels || activeLevels.includes(level)
  }
>>>>>>> 8ad062d (Initial commit_4)

  function avgScore() {
    if (activeEntries.length === 0) return 0
    const total = activeEntries.reduce((s, e) => {
      const rec = scores[e.id]
<<<<<<< HEAD
      const gameAvg = SCORE_GAMES.reduce((gs, g) => gs + (rec?.[g]?.score ?? 0), 0) / SCORE_GAMES.length
      return s + gameAvg
=======
      const avg = SCORE_GAMES.reduce((gs, g) => gs + (rec?.[g]?.score ?? 0), 0) / SCORE_GAMES.length
      return s + avg
>>>>>>> 8ad062d (Initial commit_4)
    }, 0)
    return (total / activeEntries.length).toFixed(1)
  }

<<<<<<< HEAD
  const canStart = activeEntries.length >= 3
  const listsForLang = activeLanguage
    ? availableLists.filter(l => l.language === activeLanguage)
    : []

  return (
    <div className="setup">
      <div className="setup-header">
        <h1 className="setup-title">Vocab Games</h1>
=======
  function toggleGroup(id) {
    setOpenGroup(prev => prev === id ? null : id)
  }

  return (
    <div className="setup">
      {/* Header */}
      <div className="setup-header">
        <button className="lang-flag-btn" onClick={() => setLangPickerOpen(o => !o)} title="Change language">
          <span className="lang-flag-icon">{currentFlag}</span>
          <span className="lang-flag-label">{currentLangLabel}</span>
          <span className="lang-flag-arrow">{langPickerOpen ? '▾' : '›'}</span>
        </button>
>>>>>>> 8ad062d (Initial commit_4)
        <div className="setup-nav">
          <button className="setup-nav-btn" onClick={() => setScreen('stats')}    title="Stats">📊</button>
          <button className="setup-nav-btn" onClick={() => setScreen('settings')} title="Settings">⚙️</button>
        </div>
      </div>

<<<<<<< HEAD
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
=======
      {/* Language picker dropdown */}
      {langPickerOpen && (
        <div className="lang-picker">
          {languages.map(lang => (
            <button
              key={lang.language}
              className={`lang-picker-item ${activeLanguage === lang.language ? 'active' : ''}`}
              onClick={() => { setActiveLanguage(activeLanguage === lang.language ? null : lang.language); setLangPickerOpen(false) }}
            >
              <span>{LANGUAGE_FLAGS[lang.language] ?? '🌐'}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Level filter */}
      {orderedLevels.length > 0 && (
        <div className="level-filter">
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

      {/* Status bar */}
      {canStart && (
        <div className="stats-bar">
          {activeEntries.length} words · avg {avgScore()} / 5
        </div>
      )}

      {/* Vocab Browser */}
      <div className="setup-section">
        <button
          className={`vocab-browser-btn ${!canStart ? 'disabled' : ''}`}
          disabled={!canStart}
          onClick={() => setScreen('vocab')}
        >
          <span className="vocab-browser-icon">🗂️</span>
          <div>
            <div className="vocab-browser-label">Vocab Browser</div>
            <div className="vocab-browser-desc">Browse, filter and track progress</div>
          </div>
        </button>
      </div>

      {/* Game groups — single accordion */}
      <div className="setup-section">
        <GroupCard title="Vocabulary Drills" subtitle="Flashcard · Race Car · Match · Typing"
          icon="🎯" games={DRILL_GAMES} canStart={canStart} setScreen={setScreen}
          isOpen={openGroup === 'drills'} onOpen={() => toggleGroup('drills')} />
        <GroupCard title="Language in Context" subtitle="Gap Fill · Reader · Dialogue"
          icon="📚" games={CONTEXT_GAMES} canStart={canStart} setScreen={setScreen}
          isOpen={openGroup === 'context'} onOpen={() => toggleGroup('context')} />
        <GroupCard title="Grammar Drills" subtitle="Patterns · Gender · Tones · Measure Words"
          icon="📐" games={GRAMMAR_GAMES} canStart={canStart} setScreen={setScreen}
          isOpen={openGroup === 'grammar'} onOpen={() => toggleGroup('grammar')} />
      </div>

      {!canStart && (
        <p className="hint">{activeLanguage ? 'Loading vocabulary…' : 'Tap the flag above to choose a language.'}</p>
      )}
>>>>>>> 8ad062d (Initial commit_4)
    </div>
  )
}
