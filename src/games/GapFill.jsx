import { useState, useEffect, useCallback, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { parseFixedSentence, buildGenericQuestion } from '../engine/vocab'
import { srsPickDistinct } from '../engine/srs'
import { buildLookup } from '../engine/reader'
import { TextWithLookup } from '../components/TextWithLookup'
import RubyText from '../components/RubyText'
import './GapFill.css'

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

function buildQuestion(activeSentences, activeEntries, direction, usedIds, fixedRatio = 0.6) {
  // Decide: fixed or generic (60/40 if fixed available)
  const hasFixed   = activeSentences.fixed.length > 0
  const hasGeneric = activeSentences.generic.length > 0 && activeEntries.length >= 3

  if (!hasFixed && !hasGeneric) return null

  const useFixed = hasFixed && (!hasGeneric || Math.random() < fixedRatio)

  if (useFixed) {
    // Pick a random fixed sentence
    const pool = activeSentences.fixed
    const raw  = pool[Math.floor(Math.random() * pool.length)]
    const parsed = parseFixedSentence(raw.text)
    if (!parsed) return null
    return {
      type: 'fixed',
      lang: raw.lang,
      before:      parsed.before,
      after:       parsed.after,
      answer:      parsed.answer,
      options:     shuffle([parsed.answer, ...parsed.distractors]).slice(0, 3),
      entry:       null,
    }
  }

  // Generic: pick an entry, pick a matching template
  const eligible = activeEntries.filter(e => !usedIds.has(e.id))
  const pool     = eligible.length >= 3 ? eligible : activeEntries
  const [entry]  = srsPickDistinct(pool, 1, 'gapfill')
  if (!entry) return null

  const templates = activeSentences.generic.filter(t =>
    !entry.pos || !t.pos || t.pos === entry.pos
  )
  if (templates.length === 0) return null

  const template = templates[Math.floor(Math.random() * templates.length)]
  const parsed   = buildGenericQuestion(template.template, entry, direction)
  if (!parsed) return null

  // 2 random distractors from active entries (same pos preferred)
  const distractorPool = activeEntries.filter(e => e.id !== entry.id)
  const preferred = distractorPool.filter(e => e.pos === entry.pos)
  const distSrc   = preferred.length >= 2 ? preferred : distractorPool
  const dists     = srsPickDistinct(distSrc, 2, 'gapfill').map(e =>
    direction === 'entry->translation' ? e.translation[0] : e.entry
  )

  return {
    type:    'generic',
    lang:    template.lang,
    before:  parsed.before,
    after:   parsed.after,
    answer:  parsed.answer,
    options: shuffle([parsed.answer, ...dists]),
    entry,
  }
}

const FEEDBACK_DURATION = 900

export default function GapFill() {
<<<<<<< HEAD
  const { activeEntries, activeSentences, direction, showReading, scoreActions, scores, settings, setScreen, activeLanguage, loadedLists, selectedIds } = useApp()
=======
  const { activeEntries: allEntries, activeSentences, direction, showReading, scoreActions, scores, settings, setScreen, activeLanguage, loadedLists, selectedIds, getEntriesForGame } = useApp()
  const { entries: activeEntries, isEmpty: levelEmpty } = getEntriesForGame('gapfill')
>>>>>>> 8ad062d (Initial commit_4)
  const fixedRatio = settings.gapfill.fixedRatio

  const language = useMemo(() => {
    if (activeLanguage) return activeLanguage
    const firstList = selectedIds.map(id => loadedLists[id]).find(Boolean)
    return firstList?.language ?? 'en'
  }, [activeLanguage, selectedIds, loadedLists])

  const lookup = useMemo(() => buildLookup(activeEntries), [activeEntries])

  const [question,   setQuestion]   = useState(null)
  const [selected,   setSelected]   = useState(null)   // chosen option
  const [feedback,   setFeedback]   = useState(null)   // 'correct'|'wrong'
  const [score,      setScore]      = useState(0)
  const [streak,     setStreak]     = useState(0)
  const [total,      setTotal]      = useState(0)
  const [correct,    setCorrect]    = useState(0)
  const [usedIds,    setUsedIds]    = useState(new Set())

  const nextQuestion = useCallback(() => {
    const q = buildQuestion(activeSentences, activeEntries, direction, usedIds, fixedRatio)
    setQuestion(q)
    setSelected(null)
    setFeedback(null)
  }, [activeSentences, activeEntries, direction, usedIds])

  useEffect(() => {
    if (activeEntries.length > 0) nextQuestion()
  }, [activeEntries, activeSentences])

  function choose(option) {
    if (feedback) return
    setSelected(option)
    const isCorrect = option === question.answer

    setTotal(t => t + 1)
    if (isCorrect) {
      setCorrect(c => c + 1)
      setStreak(s => s + 1)
      setScore(s => s + Math.round(10 * Math.min(3, 1 + streak * 0.25)))
      setFeedback('correct')
      if (question.entry) scoreActions.correct(question.entry.id, 'gapfill')
      if (question.entry) setUsedIds(prev => new Set([...prev, question.entry.id]))
    } else {
      setStreak(0)
      setFeedback('wrong')
      if (question.entry) scoreActions.wrong(question.entry.id, 'gapfill')
    }

    setTimeout(nextQuestion, FEEDBACK_DURATION)
  }

  // Keyboard 1/2/3
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') { setScreen('setup'); return }
      if (!question || feedback) return
      if (e.key === '1') choose(question.options[0])
      if (e.key === '2') choose(question.options[1])
      if (e.key === '3') choose(question.options[2])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [question, feedback])

  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0

  if (!question) {
    return (
      <div className="gf-screen">
        <div className="gf-header">
          <button className="gf-back" onClick={() => setScreen('setup')}>← Back</button>
        </div>
        <div className="gf-empty">
          {activeEntries.length === 0
            ? 'Select a vocab list to start.'
            : 'No sentence templates available for this list.'}
        </div>
      </div>
    )
  }

  return (
    <div className={`gf-screen ${feedback || ''}`}>
      <div className="gf-header">
        <button className="gf-back" onClick={() => setScreen('setup')}>← Back</button>
        <div className="gf-stats">
          <span className="gf-score">{score}</span>
          <span className="gf-streak">{streak > 1 ? `🔥 ${streak}` : ''}</span>
          <span className="gf-acc">{total > 0 ? `${accuracy}%` : ''}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button className="gf-gear" onClick={() => setScreen('settings')} title="Settings">⚙️</button>
        </div>
      </div>

<<<<<<< HEAD
=======
      {levelEmpty && (
        <div className="level-warning">
          ⚠ <strong>No entries at selected level</strong> — showing all levels instead. Change in Settings.
        </div>
      )}

>>>>>>> 8ad062d (Initial commit_4)
      {/* Sentence card */}
      <div className="gf-card-area">
        <div className={`gf-card ${feedback || ''}`}>
          <p className="gf-lang-label">{question.lang}</p>
          <p className="gf-sentence">
            <TextWithLookup text={question.before} language={language} lookup={lookup} scores={scores} showReading={showReading} />
            <span className={`gf-blank ${feedback || ''}`}>
              {selected || '___'}
            </span>
            <TextWithLookup text={question.after} language={language} lookup={lookup} scores={scores} showReading={showReading} />
          </p>

          {/* Show entry with ruby when answered */}
          {feedback && question.entry && (
            <div className="gf-entry-hint">
              <RubyText
                text={question.entry.entry}
                reading={question.entry.reading}
                visible={showReading}
                size="md"
              />
              <span className="gf-entry-trans">
                {question.entry.translation.join(' · ')}
              </span>
            </div>
          )}

          {feedback === 'wrong' && (
            <p className="gf-correct-hint">✓ {question.answer}</p>
          )}
        </div>
      </div>

      {/* Options */}
      <div className="gf-options">
        {question.options.map((opt, i) => {
          let state = 'idle'
          if (feedback) {
            if (opt === question.answer) state = 'correct'
            else if (opt === selected)  state = 'wrong'
          }
          return (
            <button
              key={opt}
              className={`gf-option gf-option--${state}`}
              onClick={() => choose(opt)}
              disabled={!!feedback}
            >
              <span className="gf-option-num">{i + 1}</span>
              <span className="gf-option-text">{opt}</span>
            </button>
          )
        })}
      </div>

      <div className="gf-keyboard-hint">Press 1 / 2 / 3 to answer</div>
    </div>
  )
}
