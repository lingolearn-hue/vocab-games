import { useState, useMemo, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { filterByLevel } from '../engine/settings'
import LevelChips from './LevelChips'
import CategoryChips from './CategoryChips'
import Tutorial from './Tutorial'
import DailyChallenge from './DailyChallenge'
import './Setup.css'
import './ReadingToggle.css'

const LANGUAGE_FLAGS = { zh: '🇨🇳', es: '🇪🇸', de: '🇩🇪', ja: '🇯🇵', en: '🇬🇧', fr: '🇫🇷' }
const LANGUAGE_NAMES = { zh: 'Chinese', es: 'Spanish', de: 'German', ja: 'Japanese', fr: 'French' }

const DRILL_GAMES = [
  { id: 'flashcard', label: '📇 Flashcard',  desc: 'Swipe to learn' },
  { id: 'racecar',   label: '🏎 Race Car',   desc: 'Steer into the answer' },
  { id: 'pairmatch', label: '🔗 Pair Match', desc: 'Connect word pairs' },
  { id: 'typing',    label: '⌨️ Typing',     desc: 'Type from memory' },
]
const CONTEXT_GAMES = [
  { id: 'gapfill',  label: '✏️ Gap Fill',       desc: 'Complete the sentence', unfinished: true },
  { id: 'reader',   label: '📖 Graded Reader',   desc: 'Tap words to look up' },
  { id: 'dialogue', label: '💬 Dialogue',         desc: 'Comprehension questions', unfinished: true },
]
const LISTENING_GAMES = [
  { id: 'listening', label: '🎧 Listening', desc: 'Hands-free audio review, box by box' },
]
const MATCHING_GAMES = [
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
              <span className="sub-game-label">
                {g.label}
                {g.unfinished && <span className="sub-game-unfinished" title="Still rough around the edges">🚧 unfinished</span>}
              </span>
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
    activeLanguage, setActiveLanguage, reverseSourceLanguage, settings,
  } = useApp()

  const [langPickerOpen,    setLangPickerOpen]    = useState(false)
  // Which panel shows while the picker is open — a single view at a time
  // rather than two independently-toggled booleans, so there's no way for
  // the "Learn English from…" panel to end up stacked with (or orphaned
  // from) the main list.
  const [langPickerView,    setLangPickerView]    = useState('main') // 'main' | 'reverse'
  const [openGroup,      setOpenGroup]      = useState('drills')
  const [tutorialOpen,   setTutorialOpen]   = useState(false)
  const [dailyChallengeOpen, setDailyChallengeOpen] = useState(false)
  const [appVersion, setAppVersion] = useState(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}version.json`)
      .then(r => r.ok ? r.json() : null)
      .then(v => v && setAppVersion(v.version))
      .catch(() => {})
  }, [])

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
  const currentLangLabel = activeLanguage === 'en' && reverseSourceLanguage
    ? `English (from ${LANGUAGE_NAMES[reverseSourceLanguage] ?? reverseSourceLanguage})`
    : languages.find(l => l.language === activeLanguage)?.label ?? 'Choose language'

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
        <button
          className="lang-flag-btn"
          onClick={() => {
            setLangPickerOpen(o => !o)
            setLangPickerView('main') // always reopen at the top level, never mid-flow
          }}
          title="Change language"
        >
          <span className="lang-flag-icon">{currentFlag}</span>
          <span className="lang-flag-label">{currentLangLabel}</span>
          <span className="lang-flag-arrow">{langPickerOpen ? '▾' : '›'}</span>
        </button>
        <div className="setup-nav">
          <button className="setup-nav-btn setup-nav-btn--adventure" onClick={() => setScreen('adventure')} title="Adventure Mode">⚔️</button>
          <button className="setup-nav-btn" onClick={() => setDailyChallengeOpen(true)} title="Daily Challenge">🎯</button>
          <button className="setup-nav-btn" onClick={() => setScreen('stats')}    title="Stats">📊</button>
          <button className="setup-nav-btn" onClick={() => setScreen('settings')} title="Settings">⚙️</button>
          <button className="reading-toggle" onClick={() => setTutorialOpen(true)} title="Help">?</button>
        </div>
      </div>

      {/* Language picker — one panel at a time: the top-level list, or (once
          English is tapped) the "Learn English from…" source picker, never
          both stacked and never left orphaned if the picker closes some
          other way, since both live under the same langPickerOpen gate and
          langPickerView always resets to 'main' whenever the picker (re)opens
          or a selection completes. */}
      {langPickerOpen && langPickerView === 'main' && (
        <div className="lang-picker">
          {languages.map(lang => {
            if (lang.language === 'en') {
              return (
                <button
                  key="en"
                  className={`lang-picker-item ${activeLanguage === 'en' ? 'active' : ''}`}
                  onClick={() => {
                    if (activeLanguage === 'en') {
                      setActiveLanguage(null)
                      setLangPickerOpen(false)
                    } else {
                      setLangPickerView('reverse')
                    }
                  }}
                >
                  <span>{LANGUAGE_FLAGS.en}</span>
                  <span>{lang.label}</span>
                </button>
              )
            }
            return (
              <button
                key={lang.language}
                className={`lang-picker-item ${activeLanguage === lang.language ? 'active' : ''}`}
                onClick={() => { setActiveLanguage(activeLanguage === lang.language ? null : lang.language); setLangPickerOpen(false) }}
              >
                <span>{LANGUAGE_FLAGS[lang.language] ?? '🌐'}</span>
                <span>{lang.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* "Learn English from…" — reverse-build source picker */}
      {langPickerOpen && langPickerView === 'reverse' && (
        <div className="lang-picker lang-picker--reverse">
          <div className="lang-picker-reverse-title">Learn English from…</div>
          {languages.filter(l => l.language !== 'en').map(lang => (
            <button
              key={lang.language}
              className={`lang-picker-item ${activeLanguage === 'en' && reverseSourceLanguage === lang.language ? 'active' : ''}`}
              onClick={() => {
                setActiveLanguage('en', lang.language)
                setLangPickerOpen(false)
              }}
            >
              <span>{LANGUAGE_FLAGS[lang.language] ?? '🌐'}</span>
              <span>{lang.label}</span>
            </button>
          ))}
          <button className="lang-picker-reverse-cancel" onClick={() => setLangPickerView('main')}>
            ← Back
          </button>
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
        <GroupCard title="Matching Drills" subtitle="Gender · Tones · Measure Words"
          icon="🎯" games={MATCHING_GAMES} canStart={canStart} setScreen={setScreen}
          isOpen={openGroup === 'matching'} onOpen={() => toggleGroup('matching')} />
      </div>

      {!canStart && (
        <p className="hint">{activeLanguage ? 'Loading vocabulary…' : 'Tap the flag above to choose a language.'}</p>
      )}

      <div className="setup-version">{appVersion ? `v${appVersion}` : ''}</div>

      {tutorialOpen && <Tutorial onDone={() => setTutorialOpen(false)} />}
      {dailyChallengeOpen && (
        <DailyChallenge lang={activeLanguage || 'en'} onClose={() => setDailyChallengeOpen(false)} />
      )}
    </div>
  )
}
