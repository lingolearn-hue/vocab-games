import { useState, useEffect, useCallback, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { parseFixedSentence } from '../engine/vocab'
import HelpButton from '../components/HelpButton'
import './GapFill.css'

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }

const FEEDBACK_DURATION = 900

export default function GapFill() {
  const {
    activeSentences, settings, goBack, vocabLoading
  } = useApp()

  // Level filter — use global level setting
  const activeLevels = settings.levels?.global ?? null

  // Filter sentences by level
  const sentences = useMemo(() => {
    if (!activeLevels || activeLevels.length === 0) return activeSentences
    return activeSentences.filter(s => !s.level || activeLevels.includes(s.level))
  }, [activeSentences, activeLevels])

  const [question,    setQuestion]    = useState(null)
  const [chosen,      setChosen]      = useState(null)
  const [feedback,    setFeedback]    = useState(null)  // null | 'correct' | 'wrong'
  const [total,       setTotal]       = useState(0)
  const [correct,     setCorrect]     = useState(0)
  const [usedIndices, setUsedIndices] = useState(new Set())

  function buildQuestion(pool, used) {
    if (!pool || pool.length === 0) return null
    // Pick from unused sentences first
    const available = pool.filter((_, i) => !used.has(i))
    const src = available.length > 0 ? available : pool
    const idx = pool.indexOf(src[Math.floor(Math.random() * src.length)])
    const raw = pool[idx]
    const parsed = parseFixedSentence(raw.text)
    if (!parsed) return null
    const options = shuffle([parsed.answer, ...parsed.distractors])
    return {
      index: idx,
      before:      parsed.before,
      after:       parsed.after,
      answer:      parsed.answer,
      options,
      translation: raw.translation ?? null,
      level:       raw.level ?? null,
    }
  }

  const nextQuestion = useCallback(() => {
    const q = buildQuestion(sentences, usedIndices)
    if (!q) return
    setQuestion(q)
    setChosen(null)
    setFeedback(null)
    setUsedIndices(prev => {
      const next = new Set(prev)
      next.add(q.index)
      // Reset when all used
      if (next.size >= sentences.length) return new Set()
      return next
    })
  }, [sentences, usedIndices])

  // Reset when sentences change (language / level change)
  const sentencesKey = sentences.map((_, i) => i).join(',') + sentences.length
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets quiz state when the sentence pool changes
    setUsedIndices(new Set())
    setQuestion(null)
    if (sentences.length > 0) {
      const q = buildQuestion(sentences, new Set())
      setQuestion(q)
    }
  }, [sentencesKey])

  function choose(opt) {
    if (feedback) return
    setChosen(opt)
    const isCorrect = opt === question.answer
    setFeedback(isCorrect ? 'correct' : 'wrong')
    setTotal(t => t + 1)
    if (isCorrect) {
      setCorrect(c => c + 1)
      setTimeout(() => nextQuestion(), FEEDBACK_DURATION)
    }
  }

  const accuracy = total > 0 ? Math.round((correct / total) * 100) : null

  if (vocabLoading || sentences.length === 0) {
    return (
      <div className="gf-screen">
        <div className="gf-header">
          <button className="gf-back" onClick={goBack}>← Back</button>
          <span className="gf-title">Gap Fill</span>
        </div>
        <div className="gf-empty">
          {vocabLoading ? 'Loading…' : activeLevels ? 'No sentences match the selected levels.' : 'No sentences loaded for this language yet.'}
        </div>
      </div>
    )
  }

  return (
    <div className="gf-screen">
      <div className="gf-header">
        <button className="gf-back" onClick={goBack}>← Back</button>
        <span className="gf-title">Gap Fill</span>
        <div className="gf-header-right">
          {total > 0 && (
            <span className="gf-session">{correct}/{total}{accuracy !== null ? ` · ${accuracy}%` : ''}</span>
          )}
          <HelpButton
            title="Gap Fill"
            description="Read the sentence and tap the missing word to fill the gap. Score and accuracy for this session are shown at the top."
          />
        </div>
      </div>

      <div className="gf-body">
        {question && (
          <>
            <div className={`gf-card ${feedback || ''}`}>
              {question.level && <span className="gf-level">{question.level}</span>}
              <div className="gf-sentence">
                <span className="gf-before">{question.before}</span>
                <span className={`gf-blank ${feedback || ''}`}>
                  {chosen ?? '___'}
                </span>
                <span className="gf-after">{question.after}</span>
              </div>
              {question.translation && feedback && (
                <div className="gf-translation">{question.translation}</div>
              )}
            </div>

            <div className="gf-options">
              {question.options.map(opt => {
                let state = ''
                if (feedback) {
                  if (opt === question.answer) state = 'correct'
                  else if (opt === chosen)     state = 'wrong'
                }
                return (
                  <button
                    key={opt}
                    className={`gf-option gf-option--${state || 'idle'}`}
                    onClick={() => choose(opt)}
                    disabled={!!feedback}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>

            {feedback === 'wrong' && (
              <div className="gf-wrong-bar">
                <span>Correct: <strong>{question.answer}</strong></span>
                <button className="gf-next-btn" onClick={nextQuestion}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
