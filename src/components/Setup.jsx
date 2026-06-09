import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import './Setup.css'

const LANGUAGE_FLAGS = { zh: '🇨🇳', es: '🇪🇸', de: '🇩🇪', ja: '🇯🇵', en: '🇬🇧' }

// Level order per language family
const LEVEL_ORDER = {
  zh: ['HSK1','HSK2','HSK3','HSK4','HSK5','HSK6'],
  ja: ['N5','N4','N3','N2','N1'],
  de: ['A1','A2','B1','B2','C1','C2'],
  es: ['A1','A2','B1','B2','C1','C2'],
  en: ['A1','A2','B1','B2','C1','C2'],
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

function getLanguages(availableLists) {
  const seen = new Set()
  return availableLists
    .filter(l => { if (seen.has(l.language)) return false; seen.add(l.language); return true })
    .map(l => ({ language: l.language, label: l.languageLabel }))
}

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

  function avgScore() {
    if (activeEntries.length === 0) return 0
    const total = activeEntries.reduce((s, e) => {
      const rec = scores[e.id]
      const avg = SCORE_GAMES.reduce((gs, g) => gs + (rec?.[g]?.score ?? 0), 0) / SCORE_GAMES.length
      return s + avg
    }, 0)
    return (total / activeEntries.length).toFixed(1)
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

      <div className="setup-version">v0.37</div>
    </div>
  )
}
