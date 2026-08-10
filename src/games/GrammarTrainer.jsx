import { useState, useEffect, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import {
  loadGrammarPatterns, sortPatternsByPriority, filterPatternsByLevel,
  getLevelsFromPatterns, getCategoriesFromPatterns,
  instantiateTemplate, buildPickCorrectOptions, buildOptions,
  recordGrammarCorrect, recordGrammarWrong, getAllGrammarScores,
} from '../engine/grammar'
import LevelChooser from '../components/LevelChooser'
import HelpButton from '../components/HelpButton'
import QuizOverlay from '../components/QuizOverlay'
import TileOrderExercise from '../components/TileOrderExercise'
import { hasQuiz } from '../engine/grammarQuiz'
import './GrammarTrainer.css'

const TYPE_META = {
  'fill-blank':   { label: 'Fill the Blank', icon: '✏️', desc: 'Choose the correct word to complete the sentence' },
  'pick-correct': { label: 'Pick Correct',   icon: '✔️', desc: 'Identify the grammatically correct sentence' },
  'tile-order':   { label: 'Word Order',     icon: '🔀', desc: 'Arrange tiles into the correct order' },
}

const CATEGORY_LABELS = {
  'articles': 'Articles', 'conjugation': 'Conjugation', 'word-order': 'Word Order',
  'prepositions': 'Prepositions', 'tense': 'Tense', 'adjectives': 'Adjectives',
  'conjunctions': 'Conjunctions', 'measure-words': 'Measure Words', 'particles': 'Particles',
  'basic-sentences': 'Basic Sentences', 'negation': 'Negation', 'ba-construction': '把 Construction',
  'bei-construction': '被 Passive', 'resultative-complements': 'Resultative',
  'comparison': 'Comparison', 'potential-complements': 'Potential',
  'complex-sentences': 'Complex Sentences', 'te-form': 'て-form',
  'grammar-patterns': 'Grammar Patterns', 'verbs': 'Verbs', 'conditionals': 'Conditionals',
  'honorifics': 'Honorifics', 'ser-estar': 'Ser vs Estar', 'subjunctive': 'Subjunctive',
}

// ── Exercise components ────────────────────────────────────────────────────────

function FillBlank({ pattern, onResult }) {
  // Both text and the correct answer come from the same instantiateTemplate()
  // call — has to be a single memo, not two separate ones each re-rolling
  // the random pick, or text and options could end up describing different
  // random choices.
  const { text, correctAnswer } = useMemo(
    () => instantiateTemplate(pattern.template), [pattern.id]
  )

  // Two distractor conventions coexist in the data: a plain literal array
  // (distractors[0] = correct, rest = wrong — used when the template's
  // blank has one fixed correct answer regardless of which random option
  // got picked, e.g. modal-verb patterns with a fixed subject), and
  // "auto:xxx" pool references that need resolving against the actual
  // correctAnswer instantiateTemplate produced (used when the blank's
  // right answer depends on which random option got picked, e.g. "which
  // article goes with this randomly-chosen noun"). Mixing these up was a
  // real bug: every auto:-based pattern rendered a single button showing
  // the literal string "auto:xxx" instead of real distractor words, since
  // it never touched correctAnswer or resolved the pool at all.
  const usesAutoPool = pattern.distractors.some(d => typeof d === 'string' && d.startsWith('auto:'))

  const options = useMemo(() => {
    if (usesAutoPool) return buildOptions(pattern, correctAnswer)
    // Two colon-bracket usages coexist in the data: genuinely-varying
    // ("Hund:ein|Katze:eine|..." — the right answer changes depending on
    // which option got picked) and self-mapping/flavor-only ("Student:
    // Student|müde:müde|..." — every option secretly agrees, used just to
    // vary the surrounding sentence, not the blank). Trust correctAnswer
    // when it resolves to one of our known distractors (case-insensitive
    // — some patterns capitalize the bracket option, e.g. "El"/"La", but
    // list lowercase 'el'/'la' as the actual distractors); otherwise fall
    // back to the fixed first distractor, which is correct for the
    // self-mapping/no-bracket case. This was a real, live bug: several
    // patterns (de-g-002, de-g-009, de-g-016, and more in other
    // languages) have genuinely-varying brackets but were always showing
    // distractors[0] as "correct" regardless of which noun/verb the
    // bracket actually picked — verified live (e.g. "(Katze)" showing
    // "ein" marked correct instead of "eine").
    const matched = correctAnswer
      ? pattern.distractors.find(d => d.toLowerCase() === correctAnswer.toLowerCase())
      : null
    const correct = matched ?? pattern.distractors[0]
    const wrong = pattern.distractors.filter(d => d !== correct)
    return [{ text: correct, correct: true }, ...wrong.map(d => ({ text: d, correct: false }))]
      .sort(() => Math.random() - 0.5)
  }, [pattern.id, correctAnswer])

  const correctText = options.find(o => o.correct)?.text ?? pattern.distractors[0]

  const [chosen,   setChosen]   = useState(null)
  const [feedback, setFeedback] = useState(null)

  function choose(opt) {
    if (feedback) return
    setChosen(opt.text)
    if (opt.correct) {
      setFeedback('correct')
      recordGrammarCorrect(pattern.id)
      onResult(true)        // immediate — no delay
    } else {
      setFeedback('wrong')
      recordGrammarWrong(pattern.id)
    }
  }

  const displayText = text.replace('___', chosen ? `[${chosen}]` : '___')

  return (
    <div className="gt-exercise">
      {/* Feedback banner above sentence — no layout shift */}
      <div className={`gt-feedback-banner ${feedback || 'hidden'}`}>
        {feedback === 'correct' && <span className="gt-fb-correct">✓ Correct!</span>}
        {feedback === 'wrong'   && <span className="gt-fb-wrong">✗ Correct answer: <strong>{correctText}</strong></span>}
      </div>
      <div className={`gt-sentence ${feedback || ''}`}>
        {displayText.split(/(\([^)]+\))/).map((part, i) =>
          part.startsWith('(')
            ? <em key={i} className="gt-wildcard">{part}</em>
            : <span key={i}>{part}</span>
        )}
      </div>
      {pattern.hint && !feedback && <p className="gt-hint">💡 {pattern.hint}</p>}
      <div className="gt-options">
        {options.map((opt, i) => {
          let state = ''
          if (feedback) {
            if (opt.correct) state = 'correct'
            else if (opt.text === chosen) state = 'wrong'
          }
          return (
            <button
              key={i}
              className={`gt-option gt-option--${state || 'idle'}`}
              onClick={() => choose(opt)}
              disabled={!!feedback}
            >
              {opt.text}
            </button>
          )
        })}
      </div>
      {feedback === 'wrong' && (
        <button className="gt-next-btn" onClick={() => onResult(false)}>
          Next →
        </button>
      )}
    </div>
  )
}

function PickCorrect({ pattern, onResult }) {
  const options  = useMemo(() => buildPickCorrectOptions(pattern.sentences), [pattern.id])
  const [chosen,   setChosen]   = useState(null)
  const [feedback, setFeedback] = useState(null)

  function choose(opt) {
    if (feedback) return
    setChosen(opt)
    if (opt.correct) {
      setFeedback('correct')
      recordGrammarCorrect(pattern.id)
      onResult(true)        // immediate
    } else {
      setFeedback('wrong')
      recordGrammarWrong(pattern.id)
    }
  }

  return (
    <div className="gt-exercise">
      <div className={`gt-feedback-banner ${feedback || 'hidden'}`}>
        {feedback === 'correct' && <span className="gt-fb-correct">✓ Correct!</span>}
        {feedback === 'wrong'   && <span className="gt-fb-wrong">✗ Not quite — see correct answer below.</span>}
      </div>
      <p className="gt-pick-prompt">Which sentence is grammatically correct?</p>
      <div className="gt-pick-options">
        {options.map((opt, i) => {
          let state = ''
          if (feedback) {
            if (opt.correct) state = 'correct'
            else if (opt === chosen) state = 'wrong'
          }
          return (
            <button
              key={i}
              className={`gt-pick-option gt-pick-option--${state || 'idle'}`}
              onClick={() => choose(opt)}
              disabled={!!feedback}
            >
              {opt.text}
              {feedback && state === 'wrong' && opt.error && (
                <span className="gt-pick-error">{opt.error}</span>
              )}
            </button>
          )
        })}
      </div>
      {feedback === 'wrong' && (
        <button className="gt-next-btn" onClick={() => onResult(false)}>
          Next →
        </button>
      )}
    </div>
  )
}

function TileOrder({ pattern, onResult }) {
  function handleCheck(isCorrect) {
    if (isCorrect) recordGrammarCorrect(pattern.id)
    else recordGrammarWrong(pattern.id)
  }

  return (
    <div className="gt-exercise">
      <TileOrderExercise
        tiles={pattern.tiles}
        answers={pattern.answers}
        onCheck={handleCheck}
        onNext={onResult}
      />
    </div>
  )
}

// ── Type-selection screen ──────────────────────────────────────────────────────

function TypeSelector({ patterns, onSelect, scores }) {

  const typeCount = type => patterns.filter(p => p.type === type).length

  return (
    <div className="gt-type-select">
      <p className="gt-type-prompt">What do you want to practise?</p>
      <div className="gt-type-cards">
        {Object.entries(TYPE_META).map(([type, meta]) => {
          const count = typeCount(type)
          if (count === 0) return null
          const patternsOfType = patterns.filter(p => p.type === type)
          const s = patternsOfType.map(p => scores[p.id] ?? { attempts: 0, correct: 0 })
          const totalAttempts = s.reduce((a, x) => a + x.attempts, 0)
          const totalCorrect  = s.reduce((a, x) => a + x.correct, 0)
          const acc = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : null
          return (
            <button key={type} className="gt-type-card" onClick={() => onSelect(type)}>
              <span className="gt-type-icon">{meta.icon}</span>
              <div className="gt-type-info">
                <span className="gt-type-label">{meta.label}</span>
                <span className="gt-type-desc">{meta.desc}</span>
                <span className="gt-type-count">
                  {count} pattern{count !== 1 ? 's' : ''}
                  {acc !== null && ` · ${acc}% accuracy`}
                </span>
              </div>
              <span className="gt-type-arrow">›</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function GrammarTrainer() {
  const { goBack, activeLanguage, vulgarFilteredEntries } = useApp()

  const [allPatterns,       setAllPatterns]       = useState([])
  const [activeLevels,      setActiveLevels]       = useState(null)
  const [activeCategories,  setActiveCategories]   = useState([])
  const [selectedType,      setSelectedType]       = useState(null) // null = type selector
  const [streamIndex,       setStreamIndex]        = useState(0)    // position in stream
  const [cycleCount,        setCycleCount]         = useState(0)    // forces re-sort each cycle
  const [scores,            setScores]             = useState({})
  const [sessionCorrect,    setSessionCorrect]     = useState(0)
  const [sessionTotal,      setSessionTotal]       = useState(0)
  const [quizOpen,          setQuizOpen]           = useState(false)

  useEffect(() => {
    if (!activeLanguage) return
    loadGrammarPatterns(activeLanguage).then(data => {
      if (data?.patterns) {
        setAllPatterns(data.patterns)
        setScores(getAllGrammarScores())
      }
    })
  }, [activeLanguage])

  const availableLevels     = useMemo(() => getLevelsFromPatterns(allPatterns), [allPatterns])
  const availableCategories = useMemo(() => getCategoriesFromPatterns(allPatterns), [allPatterns])

  // All filtered patterns regardless of type (for type selector counts)
  const filteredPatterns = useMemo(() => {
    let ps = allPatterns
    if (activeLevels)     ps = filterPatternsByLevel(ps, activeLevels)
    if (activeCategories.length > 0) ps = ps.filter(p => activeCategories.includes(p.category))
    return ps
  }, [allPatterns, activeLevels, activeCategories])

  // Stream: filtered by type + sorted by priority, cycled infinitely
  const stream = useMemo(() => {
    if (!selectedType) return []
    const typed = filteredPatterns.filter(p => p.type === selectedType)
    return sortPatternsByPriority(typed)
  }, [filteredPatterns, selectedType, cycleCount]) // cycleCount triggers re-sort

  const currentPattern = stream.length > 0
    ? stream[streamIndex % stream.length]
    : null

  function handleResult(correct) {
    setSessionTotal(t => t + 1)
    if (correct) setSessionCorrect(c => c + 1)
    setScores(getAllGrammarScores())
    const nextIndex = streamIndex + 1
    // Re-sort at the start of each cycle
    if (nextIndex % stream.length === 0) setCycleCount(c => c + 1)
    setStreamIndex(nextIndex)
  }

  function handleLevelsChange(next) {
    setActiveLevels(next)
    setStreamIndex(0)
    setSelectedType(null)
  }

  function toggleCategory(cat) {
    setActiveCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
    setStreamIndex(0)
    setSelectedType(null)
  }

  const accuracy = sessionTotal > 0 ? Math.round((sessionCorrect / sessionTotal) * 100) : null

  return (
    <div className="gt-screen">
      <div className="gt-header">
        <button
          className="gt-back"
          onClick={() => {
            if (selectedType) setSelectedType(null)
            else goBack()
          }}
        >
          {selectedType ? '← Types' : '← Back'}
        </button>
        <span className="gt-title">
          {selectedType ? TYPE_META[selectedType]?.label : 'Grammar'}
        </span>
        <div className="gt-header-right">
          {sessionTotal > 0 && (
            <span className="gt-session-score">{sessionCorrect}/{sessionTotal}{accuracy !== null ? ` · ${accuracy}%` : ''}</span>
          )}
          <HelpButton
            title="Grammar Drills"
            description="Practice grammar patterns for the selected category — fill in blanks or choose the correct form. Filter by level or category using the chips below."
          />
        </div>
      </div>

      {/* Filter bar — always visible */}
      <div className="gt-filter-bar">
        <div className="gt-filter-chips">
          <LevelChooser levels={availableLevels} value={activeLevels} onChange={handleLevelsChange} className="gt-level-filter" />
          {availableCategories.map(cat => (
            <button
              key={cat}
              className={`gt-chip gt-chip--cat ${activeCategories.includes(cat) ? 'active' : ''}`}
              onClick={() => toggleCategory(cat)}
            >
              {CATEGORY_LABELS[cat] ?? cat}
            </button>
          ))}
          {(activeLevels || activeCategories.length > 0) && (
            <button className="gt-chip-clear" onClick={() => { setActiveLevels(null); setActiveCategories([]); setSelectedType(null) }}>
              ✕ Clear
            </button>
          )}
        </div>
        <span className="gt-count">{filteredPatterns.length} pattern{filteredPatterns.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="gt-body">
        {filteredPatterns.length === 0 ? (
          <div className="gt-empty">No patterns match the selected filters.</div>
        ) : !selectedType ? (
          // ── Type selector ──
          <TypeSelector
            patterns={filteredPatterns}
            onSelect={type => { setSelectedType(type); setStreamIndex(0); setCycleCount(0) }}
            scores={scores}
          />
        ) : !currentPattern ? (
          <div className="gt-empty">No patterns of this type match the filters.</div>
        ) : (
          // ── Exercise stream ──
          <>
            <div className="gt-pattern-header">
              <div className="gt-pattern-meta">
                <span className="gt-pattern-level">{currentPattern.level}</span>
                <span className="gt-pattern-category">{CATEGORY_LABELS[currentPattern.category] ?? currentPattern.category}</span>
                <span className="gt-pattern-pos">
                  {(streamIndex % stream.length) + 1} / {stream.length}
                  {streamIndex >= stream.length && ` · cycle ${Math.floor(streamIndex / stream.length) + 1}`}
                </span>
              </div>
              <h2 className="gt-pattern-title">{currentPattern.title}</h2>
              <p className="gt-explanation">{currentPattern.explanation}</p>
              {hasQuiz(currentPattern.quizType) && (
                <button className="gt-quiz-btn" onClick={() => setQuizOpen(true)}>
                  🎯 Quick practice
                </button>
              )}
            </div>

            {(() => {
              const s = scores[currentPattern.id]
              if (!s || s.attempts === 0) return (
                <div className="gt-score-row"><span className="gt-score-unseen">New</span></div>
              )
              const acc = Math.round((s.correct / s.attempts) * 100)
              return (
                <div className="gt-score-row">
                  <span className="gt-score-acc" style={{ color: acc >= 80 ? '#22a06b' : acc >= 50 ? '#f0a500' : '#e5534b' }}>
                    {acc}% · {s.attempts} attempt{s.attempts !== 1 ? 's' : ''} · streak {s.streak}
                  </span>
                </div>
              )
            })()}

            {currentPattern.type === 'fill-blank' && (
              <FillBlank key={`${currentPattern.id}-${streamIndex}`} pattern={currentPattern} onResult={handleResult} />
            )}
            {currentPattern.type === 'pick-correct' && (
              <PickCorrect key={`${currentPattern.id}-${streamIndex}`} pattern={currentPattern} onResult={handleResult} />
            )}
            {currentPattern.type === 'tile-order' && (
              <TileOrder key={`${currentPattern.id}-${streamIndex}`} pattern={currentPattern} onResult={handleResult} />
            )}
          </>
        )}
      </div>

      {quizOpen && currentPattern && (
        <QuizOverlay
          quizType={currentPattern.quizType}
          title={currentPattern.title}
          vocabEntries={vulgarFilteredEntries}
          onClose={() => setQuizOpen(false)}
        />
      )}
    </div>
  )
}
