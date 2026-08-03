import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { filterByLevel } from '../engine/settings'
import LevelChips from './LevelChips'
import CategoryChips from './CategoryChips'
import Tutorial from './Tutorial'
import './Setup.css'
import './ReadingToggle.css'

const LANGUAGE_FLAGS = { zh: '🇨🇳', es: '🇪🇸', de: '🇩🇪', ja: '🇯🇵', en: '🇬🇧', fr: '🇫🇷' }

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
const LISTENING_GAMES = [
  { id: 'listening', label: '🎧 Listening', desc: 'Hands-free audio review, box by box' },
]
const GRAMMAR_GAMES = [
  { id: 'grammar',  label: '📐 Grammar Patterns', desc: 'Fill blanks, word order, pick correct' },
  { id: 'matching', label: '🎯 Matching Drills',   desc: 'Gender, tones, measure words' },
]
const STATS_BAR_SCORE_GAME = 'flashcard'

function getLanguages(availableLists) {
  const seen = new Set()
  return availableLists
    .filter(l => { if (seen.has(l.language)) return false; seen.add(l.language); return true })
    .map(l => ({ language: l.language, label: l.languageLabel }))
}

// Single accordion — only one group open at a time
function GroupCard({ title, subtitle, icon, games, canStart, setScreen, isOpen, onOpen, extraButton }) {
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
          {extraButton && (
            <button
              className={`sub-game-btn ${!canStart ? 'disabled' : ''}`}
              disabled={!canStart}
              onClick={() => setScreen(extraButton.id)}
            >
              <span className="sub-game-label">{extraButton.label}</span>
              <span className="sub-game-desc">{extraButton.desc}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function Setup() {
  const {
    availableLists, scores, activeEntries, visibleEntries, vulgarFilteredEntries, setScreen,
    activeLanguage, setActiveLanguage, settings,
  } = useApp()

  const [langPickerOpen, setLangPickerOpen] = useState(false)
  const [openGroup,      setOpenGroup]      = useState('drills')
  const [tutorialOpen,   setTutorialOpen]   = useState(false)

  // Filtered by the same global level selection LevelChips drives, so the
  // stats-bar count matches what's actually shown/playable, not the full list.
  // Uses visibleEntries (vulgar-content filtered) rather than raw activeEntries.
  const filteredEntries = useMemo(
    () => filterByLevel(visibleEntries, settings.levels?.global ?? null),
    [visibleEntries, settings.levels?.global]
  )

  // Same level scope, but WITHOUT the category filter applied — this is what
  // CategoryChips needs to see so its own chips don't vanish the moment a
  // category gets selected (it must know everything available at this level,
  // not just what's currently passing the category filter).
  const categoryScopeEntries = useMemo(
    () => filterByLevel(vulgarFilteredEntries, settings.levels?.global ?? null),
    [vulgarFilteredEntries, settings.levels?.global]
  )

  const languages   = getLanguages(availableLists)
  const canStart    = activeEntries.length >= 3
  const currentFlag = activeLanguage ? LANGUAGE_FLAGS[activeLanguage] ?? '🌐' : '🌐'
  const currentLangLabel = languages.find(l => l.language === activeLanguage)?.label ?? 'Choose language'

  function avgScore() {
    if (filteredEntries.length === 0) return 0
    const total = filteredEntries.reduce((s, e) => {
      const rec = scores[e.id]
      return s + (rec?.[STATS_BAR_SCORE_GAME]?.score ?? 0)
    }, 0)
    return (total / filteredEntries.length).toFixed(1)
  }

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
        <div className="setup-nav">
          <button className="setup-nav-btn setup-nav-btn--adventure" onClick={() => setScreen('adventure')} title="Adventure Mode">⚔️</button>
          <button className="setup-nav-btn" onClick={() => setScreen('stats')}    title="Stats">📊</button>
          <button className="setup-nav-btn" onClick={() => setScreen('settings')} title="Settings">⚙️</button>
          <button className="reading-toggle" onClick={() => setTutorialOpen(true)} title="Help">?</button>
        </div>
      </div>

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
      <LevelChips />

      {/* Category filter */}
      <CategoryChips entries={categoryScopeEntries} />

      {/* Status bar */}
      {canStart && (
        <div className="stats-bar">
          {filteredEntries.length} words · avg {avgScore()} / 5
        </div>
      )}

      {/* Vocab Browser + Grammar Dictionary */}
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
        <button
          className="vocab-browser-btn"
          onClick={() => setScreen('grammar-dict')}
        >
          <span className="vocab-browser-icon">📖</span>
          <div>
            <div className="vocab-browser-label">Grammar Dictionary</div>
            <div className="vocab-browser-desc">Searchable grammar patterns reference</div>
          </div>
        </button>

      </div>

      {/* Game groups — single accordion */}
      <div className="setup-section">
        <GroupCard title="Vocabulary Drills" subtitle="Flashcard · Race Car · Match · Typing"
          icon="🎯" games={DRILL_GAMES} canStart={canStart} setScreen={setScreen}
          isOpen={openGroup === 'drills'} onOpen={() => toggleGroup('drills')}
          extraButton={['zh','ja'].includes(activeLanguage) ? {
            id: 'stroke-order', label: '✍️ Stroke Order', desc: 'Write characters stroke by stroke'
          } : null} />
        <GroupCard title="Listening" subtitle="Hands-free audio review"
          icon="🎧" games={LISTENING_GAMES} canStart={canStart} setScreen={setScreen}
          isOpen={openGroup === 'listening'} onOpen={() => toggleGroup('listening')} />
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

      <div className="setup-version">v0.66</div>

      {tutorialOpen && <Tutorial onDone={() => setTutorialOpen(false)} />}
    </div>
  )
}
