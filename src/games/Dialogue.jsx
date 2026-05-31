import { useState, useEffect, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { buildLookup } from '../engine/reader'
import { TextWithLookup } from '../components/TextWithLookup'
import './Dialogue.css'

async function loadDialogues(languageId) {
  try {
    const res = await fetch(`./dialogues/${languageId}-en.json`)
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

const SPEAKER_COLORS = [
  '#4f7ef8', '#22a06b', '#e05cb0', '#f0a500', '#8b5cf6', '#e5534b'
]
function speakerColor(name, index) {
  return SPEAKER_COLORS[index % SPEAKER_COLORS.length]
}

export default function Dialogue() {
  const { activeEntries, showReading, scores, setScreen, activeLanguage, loadedLists, selectedIds } = useApp()

  const [dialogues,       setDialogues]       = useState([])
  const [activeDialogue,  setActiveDialogue]  = useState(null)
  const [turnIndex,       setTurnIndex]       = useState(0)    // how far we've revealed
  const [questionState,   setQuestionState]   = useState({})   // { [turnIndex]: { chosen, correct } }
  const [score,           setScore]           = useState(0)
  const [correct,         setCorrect]         = useState(0)
  const [total,           setTotal]           = useState(0)
  const [finished,        setFinished]        = useState(false)

  const language = useMemo(() => {
    if (activeLanguage) return activeLanguage
    const firstList = selectedIds.map(id => loadedLists[id]).find(Boolean)
    return firstList?.language ?? 'zh'
  }, [activeLanguage, selectedIds, loadedLists])

  const lookup = useMemo(() => buildLookup(activeEntries), [activeEntries])

  useEffect(() => {
    if (!activeLanguage) return
    loadDialogues(activeLanguage).then(data => {
      setDialogues(data?.dialogues ?? [])
    })
  }, [activeLanguage])

  function openDialogue(d) {
    setActiveDialogue(d)
    setTurnIndex(0)
    setQuestionState({})
    setScore(0)
    setCorrect(0)
    setTotal(0)
    setFinished(false)
    // Advance past any leading line turns immediately
    let i = 0
    while (i < d.turns.length && d.turns[i].type === 'line') i++
    // Show all lines up to (and including) the first question, or all if no questions
    setTurnIndex(i)
  }

  function advance() {
    if (!activeDialogue) return
    const turns = activeDialogue.turns
    // Find the next turn to reveal after current position
    let next = turnIndex + 1
    while (next < turns.length && turns[next].type === 'line') next++
    // next is now pointing at the next question (or past end)
    if (next >= turns.length) {
      setTurnIndex(turns.length - 1)
      setFinished(true)
    } else {
      setTurnIndex(next)
    }
  }

  function chooseOption(turnIdx, option, optionIndex) {
    if (questionState[turnIdx]) return  // already answered
    const isCorrect = option.correct
    setQuestionState(prev => ({ ...prev, [turnIdx]: { chosen: optionIndex, correct: isCorrect } }))
    setTotal(t => t + 1)
    if (isCorrect) {
      setCorrect(c => c + 1)
      setScore(s => s + 10)
    }
  }

  // Build speaker → color map for this dialogue
  const speakerMap = useMemo(() => {
    if (!activeDialogue) return {}
    const speakers = [...new Set(activeDialogue.turns.filter(t => t.type === 'line').map(t => t.speaker))]
    const map = {}
    speakers.forEach((s, i) => { map[s] = speakerColor(s, i) })
    return map
  }, [activeDialogue])

  // ── Dialogue list ──────────────────────────────────────────────────────────
  if (!activeDialogue) {
    return (
      <div className="dl-screen">
        <div className="dl-header">
          <button className="dl-back" onClick={() => setScreen('setup')}>← Back</button>
          <span className="dl-title">Dialogue</span>
        </div>
        <div className="dl-body">
          {dialogues.length === 0 ? (
            <div className="dl-empty">
              {activeLanguage ? 'No dialogues available for this language yet.' : 'Select a language on the home screen first.'}
            </div>
          ) : (
            <div className="dl-list">
              {dialogues.map(d => {
                const qCount = d.turns.filter(t => t.type === 'question').length
                return (
                  <button key={d.id} className="dl-card" onClick={() => openDialogue(d)}>
                    <div className="dl-card-top">
                      <span className="dl-card-title">{d.title}</span>
                      {d.level && <span className="dl-card-level">{d.level}</span>}
                    </div>
                    {d.titleTranslation && <span className="dl-card-sub">{d.titleTranslation}</span>}
                    <span className="dl-card-meta">{d.turns.filter(t => t.type === 'line').length} lines · {qCount} question{qCount !== 1 ? 's' : ''}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Active dialogue ────────────────────────────────────────────────────────
  const turns = activeDialogue.turns
  // Visible turns: all lines up to turnIndex, plus the question at turnIndex if it's one
  const visibleTurns = turns.slice(0, turnIndex + 1)
  const currentTurn = turns[turnIndex]
  const isAtQuestion = currentTurn?.type === 'question'
  const currentQState = isAtQuestion ? questionState[turnIndex] : null
  const questionAnswered = !!currentQState

  const accuracy = total > 0 ? Math.round((correct / total) * 100) : null

  return (
    <div className="dl-screen">
      <div className="dl-header">
        <button className="dl-back" onClick={() => setActiveDialogue(null)}>← Back</button>
        <span className="dl-title dl-reading-title">{activeDialogue.title}</span>
        <div className="dl-score-wrap">
          {total > 0 && <span className="dl-acc">{accuracy}%</span>}
          <span className="dl-score">{score}</span>
        </div>
      </div>

      <div className="dl-body dl-reading-body">
        {visibleTurns.map((turn, i) => {
          if (turn.type === 'line') {
            const color = speakerMap[turn.speaker] ?? '#888'
            return (
              <div key={i} className="dl-line">
                <span className="dl-speaker" style={{ color }}>{turn.speaker}</span>
                <div className="dl-bubble" style={{ borderColor: color + '44' }}>
                  <div className="dl-bubble-text">
                    <TextWithLookup
                      text={turn.text}
                      language={language}
                      lookup={lookup}
                      scores={scores}
                      showReading={showReading}
                    />
                  </div>
                  {turn.translation && (
                    <div className="dl-bubble-trans">{turn.translation}</div>
                  )}
                </div>
              </div>
            )
          }

          if (turn.type === 'question') {
            const qState = questionState[i]
            return (
              <div key={i} className="dl-question">
                <p className="dl-question-prompt">{turn.prompt}</p>
                <div className="dl-options">
                  {turn.options.map((opt, oi) => {
                    let state = 'idle'
                    if (qState) {
                      if (opt.correct)          state = 'correct'
                      else if (qState.chosen === oi) state = 'wrong'
                    }
                    return (
                      <button
                        key={oi}
                        className={`dl-option dl-option--${state}`}
                        onClick={() => chooseOption(i, opt, oi)}
                        disabled={!!qState}
                      >
                        <span className="dl-option-num">{oi + 1}</span>
                        <span className="dl-option-text">{opt.text}</span>
                      </button>
                    )
                  })}
                </div>

                {/* Feedback line */}
                {qState && (
                  <div className={`dl-feedback dl-feedback--${qState.correct ? 'correct' : 'wrong'}`}>
                    {qState.correct ? '✓ ' : '✗ '}
                    <TextWithLookup
                      text={turn.options.find((_, oi) => oi === qState.chosen)?.feedback ?? ''}
                      language={language}
                      lookup={lookup}
                      scores={scores}
                      showReading={showReading}
                    />
                  </div>
                )}
              </div>
            )
          }

          return null
        })}

        {/* Continue / Finish button */}
        {!finished && (
          <div className="dl-continue-wrap">
            {(!isAtQuestion || questionAnswered) && (
              <button className="dl-continue" onClick={advance}>
                {turnIndex + 1 >= turns.length ? 'Finish' : 'Continue →'}
              </button>
            )}
          </div>
        )}

        {finished && (
          <div className="dl-finish">
            <div className="dl-finish-title">完成！ Finished!</div>
            <div className="dl-finish-stats">
              {total > 0
                ? `${correct} / ${total} correct · ${accuracy}%`
                : 'No questions in this dialogue.'}
            </div>
            <button className="dl-finish-btn" onClick={() => setActiveDialogue(null)}>Back to list</button>
          </div>
        )}
      </div>
    </div>
  )
}
