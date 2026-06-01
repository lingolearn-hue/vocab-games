import { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { srsPick } from '../engine/srs'
import RubyText from '../components/RubyText'
import './Typing.css'

// Normalise a string for loose comparison:
// lowercase, trim, collapse whitespace, strip diacritics
function normalise(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

// Check if user input matches any accepted answer
function isCorrect(input, entry, direction) {
  const norm = normalise(input)
  if (norm === '') return false
  if (direction === 'entry->translation') {
    return entry.translation.some(t => normalise(t) === norm)
  } else {
    // translation->entry: accept entry and all translations
    if (normalise(entry.entry) === norm) return true
    if (entry.translation.some(t => normalise(t) === norm)) return true
    return false
  }
}

export default function Typing() {
  const { activeEntries: allEntries, direction, showReading, scoreActions, scores, settings, setScreen, getEntriesForGame } = useApp()
  const { entries: activeEntries, isEmpty: levelEmpty } = getEntriesForGame('typing')
  const { requireCorrect, skipEnabled } = settings.typing

  const [entry,       setEntry]       = useState(null)
  const [input,       setInput]       = useState('')
  const [feedback,    setFeedback]    = useState(null)  // null | 'correct' | 'wrong'
  const [showAnswer,  setShowAnswer]  = useState(false)
  const [mustRetype,  setMustRetype]  = useState(false) // after wrong: require correct retype
  const [retypeVal,   setRetypeVal]   = useState('')
  const [score,       setScore]       = useState(0)
  const [streak,      setStreak]      = useState(0)
  const [total,       setTotal]       = useState(0)
  const [correct,     setCorrect]     = useState(0)
  const [seenIds,     setSeenIds]     = useState(new Set())

  const inputRef  = useRef(null)
  const retypeRef = useRef(null)

  const nextEntry = useCallback(() => {
    const pool = activeEntries.filter(e => !seenIds.has(e.id))
    const src  = pool.length > 0 ? pool : activeEntries
    const [e]  = srsPick(src, 'typing')
    if (!e) return
    setEntry(e)
    setInput('')
    setFeedback(null)
    setShowAnswer(false)
    setMustRetype(false)
    setRetypeVal('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [activeEntries, seenIds])

  useEffect(() => {
    if (activeEntries.length > 0) nextEntry()
  }, [activeEntries])

  // Focus input on mount and when feedback clears
  useEffect(() => {
    if (!feedback && !mustRetype) inputRef.current?.focus()
    if (mustRetype) retypeRef.current?.focus()
  }, [feedback, mustRetype])

  function getPromptText() {
    if (!entry) return ''
    return direction === 'entry->translation' ? entry.entry : entry.translation[0]
  }

  function getPromptReading() {
    if (!entry || direction !== 'entry->translation') return null
    return showReading ? entry.reading : null
  }

  function getAcceptedAnswers() {
    if (!entry) return []
    if (direction === 'entry->translation') return entry.translation
    return [entry.entry, ...entry.translation]
  }

  function submit() {
    if (!entry || feedback) return
    if (input.trim() === '') return

    const ok = isCorrect(input, entry, direction)
    setTotal(t => t + 1)
    setFeedback(ok ? 'correct' : 'wrong')
    setShowAnswer(true)

    if (ok) {
      const mult = Math.min(3, 1 + streak * 0.25)
      setScore(s => s + Math.round(10 * mult))
      setStreak(s => s + 1)
      setCorrect(c => c + 1)
      scoreActions.correct(entry.id, 'typing')
      setSeenIds(prev => new Set([...prev, entry.id]))
      // Auto-advance after delay
      setTimeout(() => nextEntry(), 1200)
    } else {
      setStreak(0)
      scoreActions.wrong(entry.id, 'typing')
      if (requireCorrect) {
        setMustRetype(true)
        setRetypeVal('')
        setTimeout(() => retypeRef.current?.focus(), 50)
      }
    }
  }

  function submitRetype() {
    if (!entry || !mustRetype) return
    const ok = isCorrect(retypeVal, entry, direction)
    if (ok) {
      setMustRetype(false)
      nextEntry()
    } else {
      // Shake and clear
      retypeRef.current?.classList.add('shake')
      setTimeout(() => {
        retypeRef.current?.classList.remove('shake')
        setRetypeVal('')
        retypeRef.current?.focus()
      }, 400)
    }
  }

  function skip() {
    if (!entry || mustRetype) return
    if (feedback === null) {
      setTotal(t => t + 1)
      setStreak(0)
      scoreActions.wrong(entry.id, 'typing')
    }
    nextEntry()
  }

  function onKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); submit() }
    if (e.key === 'Escape') {
      if (mustRetype) return
      skip()
    }
  }

  function onRetypeKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); submitRetype() }
  }

  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0
  const entryScore = entry ? scores[entry.id]?.typing?.score ?? 0 : 0

  if (!entry) {
    return (
      <div className="ty-screen">
        <div className="ty-header">
          <button className="ty-back" onClick={() => setScreen('setup')}>← Back</button>
        </div>
        <div className="ty-empty">No words loaded.</div>
      </div>
    )
  }

  return (
    <div className={`ty-screen ${feedback || ''}`}>
      <div className="ty-header">
        <button className="ty-back" onClick={() => setScreen('setup')}>← Back</button>
        <div className="ty-stats">
          <span className="ty-score">{score}</span>
          {streak > 1 && <span className="ty-streak">🔥 {streak}</span>}
          {total > 0 && <span className="ty-acc">{accuracy}%</span>}
        </div>
        <div className="ty-header-right">
          <button className="ty-settings-btn" onClick={() => setScreen('settings')} title="Settings">⚙️</button>
        </div>
      </div>

      {levelEmpty && (
        <div className="level-warning">
          ⚠ <strong>No entries at selected level</strong> — showing all levels instead. Change in Settings.
        </div>
      )}
      {/* Prompt card */}
      <div className="ty-card-area">
        <div className={`ty-card ${feedback || ''}`}>
          <div className="ty-prompt">
            <RubyText
              text={getPromptText()}
              reading={getPromptReading()}
              visible={!!getPromptReading()}
              size="lg"
            />
          </div>

          {/* Score dots */}
          <div className="ty-score-dots">
            {[1,2,3,4,5].map(i => (
              <span key={i} className={`ty-dot ${i <= entryScore ? 'filled' : ''}`} />
            ))}
          </div>
        </div>
      </div>

      {/* Input area */}
      <div className="ty-input-area">

        {/* Main input (hidden after wrong + requireCorrect) */}
        {!mustRetype && (
          <div className="ty-input-wrap">
            <input
              ref={inputRef}
              className={`ty-input ${feedback || ''}`}
              type="text"
              placeholder={direction === 'entry->translation' ? 'Type the translation…' : 'Type the word…'}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={!!feedback}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            {!feedback && (
              <button className="ty-submit" onClick={submit}>→</button>
            )}
          </div>
        )}

        {/* Answer reveal */}
        {showAnswer && (
          <div className={`ty-answer-reveal ${feedback}`}>
            {feedback === 'correct' ? (
              <span className="ty-correct-msg">✓ Correct!</span>
            ) : (
              <div className="ty-wrong-reveal">
                <span className="ty-wrong-msg">✗ Answer{getAcceptedAnswers().length > 1 ? 's' : ''}:</span>
                <span className="ty-answer-text">
                  {getAcceptedAnswers().join(' · ')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Retype prompt */}
        {mustRetype && (
          <div className="ty-retype-area">
            <p className="ty-retype-hint">Type it correctly to continue:</p>
            <div className="ty-input-wrap">
              <input
                ref={retypeRef}
                className="ty-input ty-retype"
                type="text"
                placeholder="Retype the correct answer…"
                value={retypeVal}
                onChange={e => setRetypeVal(e.target.value)}
                onKeyDown={onRetypeKeyDown}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              <button className="ty-submit" onClick={submitRetype}>→</button>
            </div>
          </div>
        )}

        <div className="ty-keyboard-hint">
          Enter to check{skipEnabled ? ' · Esc to skip' : ''}
        </div>
      </div>
    </div>
  )
}
