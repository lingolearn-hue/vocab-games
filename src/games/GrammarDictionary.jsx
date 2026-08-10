import { useState, useMemo, useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import LevelChooser from '../components/LevelChooser'
import HelpButton from '../components/HelpButton'
import QuizOverlay from '../components/QuizOverlay'
import { hasQuiz } from '../engine/grammarQuiz'
import './GrammarDictionary.css'

async function loadGrammar(language) {
  try {
    const res = await fetch(`./grammar/${language}-en.json`)
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

const LEVEL_ORDER = {
  ja: ['N5','N4','N3','N2','N1'],
  zh: ['HSK1','HSK2','HSK3','HSK4','HSK5','HSK6','HSK7'],
  de: ['A1','A2','B1','B2','C1'],
  es: ['A1','A2','B1','B2','C1'],
  en: ['A1','A2','B1','B2','C1'],
}

const GD_LEVEL_KEY = 'vocabGrammarDictLevel' // per-language: selected level

function loadGdLevel(language) {
  try {
    const all = JSON.parse(localStorage.getItem(GD_LEVEL_KEY) || '{}')
    return all[language] || null
  } catch {
    return null
  }
}

function saveGdLevel(language, level) {
  try {
    const all = JSON.parse(localStorage.getItem(GD_LEVEL_KEY) || '{}')
    all[language] = level
    localStorage.setItem(GD_LEVEL_KEY, JSON.stringify(all))
  } catch { /* storage unavailable — selection just won't persist */ }
}

function PatternCard({ pattern, isOpen, onToggle, vocabEntries }) {
  const [activeQuizType, setActiveQuizType] = useState(null)

  return (
    <div className={`gd-card ${isOpen ? 'open' : ''}`}>
      <button className="gd-card-header" onClick={onToggle}>
        <div className="gd-card-left">
          <span className="gd-level-badge">{pattern.level}</span>
          <span className="gd-title">{pattern.title}</span>
        </div>
        <span className="gd-arrow">{isOpen ? '▾' : '›'}</span>
      </button>

      {isOpen && (
        <div className="gd-card-body">
          <p className="gd-explanation">{pattern.explanation}</p>

          {pattern.conjugationTable && (
            <table className="gd-conj-table">
              <tbody>
                {pattern.conjugationTable.map((row, i) => (
                  <tr key={i}>
                    <td className="gd-conj-pronoun">{row.pronoun}</td>
                    <td className="gd-conj-form">{row.form}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {hasQuiz(pattern.quizType) && (
            <button className="gd-quiz-btn" onClick={() => setActiveQuizType(pattern.quizType)}>
              🎯 Practise this
            </button>
          )}

          {(hasQuiz(pattern.quizTypeMc) || hasQuiz(pattern.quizTypeTiles)) && (
            <div className="gd-quiz-btn-row">
              {hasQuiz(pattern.quizTypeMc) && (
                <button className="gd-quiz-btn" onClick={() => setActiveQuizType(pattern.quizTypeMc)}>
                  🎯 Multiple choice
                </button>
              )}
              {hasQuiz(pattern.quizTypeTiles) && (
                <button className="gd-quiz-btn" onClick={() => setActiveQuizType(pattern.quizTypeTiles)}>
                  🔀 Arrange the words
                </button>
              )}
            </div>
          )}

          {pattern.type === 'fill-blank' && (
            <div className="gd-example">
              <div className="gd-example-label">Example{pattern.examples?.length > 1 ? 's' : ''}</div>
              {pattern.examples?.length ? (
                pattern.examples.map((ex, i) => (
                  <div key={i} className="gd-template">{ex}</div>
                ))
              ) : (
                <div className="gd-template">{pattern.template}</div>
              )}
            </div>
          )}

          {pattern.type === 'pick-correct' && (
            <div className="gd-examples">
              <div className="gd-example-label">Examples</div>
              {pattern.sentences.map((s, i) => (
                <div key={i} className={`gd-sentence ${s.correct ? 'correct' : 'wrong'}`}>
                  <span className="gd-sentence-mark">{s.correct ? '✓' : '✗'}</span>
                  <div>
                    <span className="gd-sentence-text">{s.text}</span>
                    {!s.correct && s.error && <div className="gd-sentence-err">{s.error}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {pattern.type === 'tile-order' && (
            <div className="gd-example">
              <div className="gd-example-label">Word order</div>
              <div className="gd-tiles">
                {(pattern.answers?.[0]?.order ?? pattern.tiles.map((_,i) => i)).map(i => (
                  <span key={i} className="gd-tile">{pattern.tiles[i]}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeQuizType && (
        <QuizOverlay
          quizType={activeQuizType}
          title={pattern.title}
          level={pattern.level}
          vocabEntries={vocabEntries}
          onClose={() => setActiveQuizType(null)}
        />
      )}
    </div>
  )
}

export default function GrammarDictionary({ patterns: chapterPatterns, onBack }) {
  const { activeLanguage, goBack, vulgarFilteredEntries } = useApp()
  const handleBack = onBack ?? goBack
  const [allPatterns, setAllPatterns] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  // Level filter — single-select, persistent per language. Defaults to A1
  // (or the lowest available level for languages without an A1) rather
  // than "all levels", since a learner realistically stays at one level
  // for a long stretch and starting unfiltered just adds noise.
  const [activeLevels, setActiveLevelsRaw] = useState(null)
  const levelPrefLoadedFor = useRef(null)
  const [showChapterOnly, setShowChapterOnly] = useState(!!chapterPatterns?.length)
  // Accordion: only one pattern's content open at a time — opening another
  // collapses whichever was open, rather than stacking several expanded
  // cards' worth of explanation/examples/quiz buttons on screen at once.
  const [openId, setOpenId] = useState(null)

  // Load global grammar file
  useEffect(() => {
    if (!activeLanguage) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch on language change
    setLoading(true)
    loadGrammar(activeLanguage).then(data => {
      setAllPatterns(data?.patterns ?? [])
      setLoading(false)
    })
  }, [activeLanguage])

  const levelOrder = LEVEL_ORDER[activeLanguage] ?? []

  // Merge chapter patterns with global — chapter patterns shown with ★
  const mergedPatterns = useMemo(() => {
    const chapterIds = new Set((chapterPatterns ?? []).map(p => p.id))
    const global = allPatterns.map(p => ({ ...p, isChapter: chapterIds.has(p.id) }))
    // Add chapter-only patterns not in global list
    const extras = (chapterPatterns ?? [])
      .filter(p => !allPatterns.find(g => g.id === p.id))
      .map(p => ({ ...p, isChapter: true }))
    return [...extras, ...global]
  }, [allPatterns, chapterPatterns])

  const filtered = useMemo(() => {
    let p = mergedPatterns
    if (showChapterOnly && chapterPatterns?.length) p = p.filter(x => x.isChapter)
    if (activeLevels) p = p.filter(x => activeLevels.includes(x.level))
    if (search.trim()) {
      const q = search.toLowerCase()
      p = p.filter(x => x.title.toLowerCase().includes(q) || x.explanation.toLowerCase().includes(q))
    }
    return p
  }, [mergedPatterns, showChapterOnly, activeLevels, search, chapterPatterns])

  const levels = useMemo(() => {
    const s = new Set(mergedPatterns.map(p => p.level))
    return levelOrder.filter(l => s.has(l))
  }, [mergedPatterns, levelOrder])

  // Load the persisted level once per language, once we actually know
  // which levels this language has (so we can fall back sensibly if a
  // saved level no longer exists, or default to A1 the first time).
  useEffect(() => {
    if (!activeLanguage || levelPrefLoadedFor.current === activeLanguage || levels.length === 0) return
    levelPrefLoadedFor.current = activeLanguage
    const saved = loadGdLevel(activeLanguage)
    const fallback = levels.includes('A1') ? 'A1' : levels[0]
    setActiveLevelsRaw([levels.includes(saved) ? saved : fallback])
  }, [activeLanguage, levels])

  // Single-select: never allow clearing back to "no level selected" (i.e.
  // "all levels") — always keep exactly one level active.
  function setActiveLevels(next) {
    const level = next?.[0]
    if (!level) return
    setActiveLevelsRaw([level])
    saveGdLevel(activeLanguage, level)
  }

  return (
    <div className="gd-screen">
      <div className="gd-header">
        {<button className="gd-back" onClick={handleBack}>← Back</button>}
        <span className="gd-title-main">Grammar Dictionary</span>
        <div style={{ marginLeft: 'auto' }}>
          <HelpButton
            title="Grammar Dictionary"
            description="Search and browse grammar patterns for the active language, with explanations and examples."
          />
        </div>
      </div>

      {/* Search */}
      <div className="gd-search-wrap">
        <input
          className="gd-search"
          type="text"
          placeholder="Search grammar patterns…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Filters */}
      <div className="gd-filters">
        {chapterPatterns?.length > 0 && (
          <div className="gd-filter-row">
            <button
              className={`gd-chip ${showChapterOnly ? 'active' : ''}`}
              onClick={() => setShowChapterOnly(v => !v)}
            >★ This chapter</button>
          </div>
        )}
        <div className="gd-filter-row">
          <span className="gd-filter-label">Level</span>
          <LevelChooser levels={levels} value={activeLevels} onChange={setActiveLevels} className="gd-level-filter" single />
        </div>
      </div>

      {/* Results */}
      <div className="gd-list">
        {loading ? (
          <div className="gd-empty">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="gd-empty">No patterns match.</div>
        ) : (
          filtered.map(p => (
            <div key={p.id} className={`gd-item ${p.isChapter ? 'chapter-pattern' : ''}`}>
              {p.isChapter && <span className="gd-chapter-star" title="Current chapter">★</span>}
              <PatternCard
                pattern={p}
                isOpen={openId === p.id}
                onToggle={() => setOpenId(id => (id === p.id ? null : p.id))}
                vocabEntries={vulgarFilteredEntries}
              />
            </div>
          ))
        )}
      </div>

      <div className="gd-count">{filtered.length} pattern{filtered.length !== 1 ? 's' : ''}</div>
    </div>
  )
}
