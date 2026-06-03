import { useState, useEffect, useMemo, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { buildLookup } from '../engine/reader'
import { TextWithLookup } from '../components/TextWithLookup'
import SpeakButton from '../components/SpeakButton'
import GrammarDictionary from './GrammarDictionary'
import './AdventureChapter.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

const PHASES = ['vocab', 'grammar', 'dialogue', 'passage', 'complete']

function phaseIndex(phase) { return PHASES.indexOf(phase) }

// Resolve chapter word IDs to actual vocab entries
function resolveWordIds(wordIds, activeEntries) {
  if (!wordIds?.length) return []
  const byEntry = new Map(activeEntries.map(e => [e.entry, e]))
  return wordIds.map(id => byEntry.get(id)).filter(Boolean)
}

// ── Phase: Vocab ───────────────────────────────────────────────────────────────

function VocabPhase({ chapter, entries, onDone, language }) {
  const { setScreen, setSessionEntries } = useApp()
  const [launched, setLaunched] = useState(false)

  function launchGame(game) {
    setSessionEntries(entries)
    setLaunched(true)
    setScreen(game)
  }

  // When player returns from a game back to adventure
  useEffect(() => {
    if (launched) {
      setSessionEntries(null)
      setLaunched(false)
    }
  }, [])

  return (
    <div className="advc-phase">
      <div className="advc-phase-icon">📚</div>
      <h2 className="advc-phase-title">{chapter.vocabLesson.title}</h2>
      <p className="advc-phase-desc">{chapter.vocabLesson.description}</p>

      {/* Word preview list */}
      <div className="advc-word-list">
        {entries.map(e => (
          <div key={e.id} className="advc-word-item">
            <span className="advc-word-entry">{e.entry}</span>
            {e.reading && <span className="advc-word-reading">{e.reading}</span>}
            <span className="advc-word-trans">{e.translation[0]}</span>
            <SpeakButton text={e.entry} language={language} size="sm" />
          </div>
        ))}
      </div>

      {entries.length === 0 && (
        <p className="advc-warn">⚠ Vocab entries not found. Make sure your Japanese vocab list is loaded.</p>
      )}

      <div className="advc-game-row">
        <span className="advc-game-label">Train with:</span>
        <div className="advc-game-btns">
          <button className="advc-game-btn" onClick={() => launchGame('flashcard')} disabled={entries.length < 1}>
            🃏 Flashcard
          </button>
          <button className="advc-game-btn" onClick={() => launchGame('pairmatch')} disabled={entries.length < 2}>
            🔗 Match
          </button>
          <button className="advc-game-btn" onClick={() => launchGame('racecar')} disabled={entries.length < 3}>
            🏎 Race Car
          </button>
        </div>
      </div>

      <button className="advc-continue-btn" onClick={onDone}>
        Continue to Grammar →
      </button>
    </div>
  )
}

// ── Phase: Grammar ─────────────────────────────────────────────────────────────

function GrammarPhase({ chapter, onDone }) {
  const [doneIds, setDoneIds] = useState(new Set())
  const [showDict, setShowDict] = useState(false)
  const patterns = chapter.grammarLesson.patterns ?? []

  function markDone(id) {
    setDoneIds(prev => new Set([...prev, id]))
  }

  if (showDict) {
    return (
      <GrammarDictionary
        patterns={patterns}
        onBack={() => setShowDict(false)}
      />
    )
  }

  return (
    <div className="advc-phase">
      <div className="advc-phase-icon">📐</div>
      <h2 className="advc-phase-title">{chapter.grammarLesson.title}</h2>
      <p className="advc-phase-desc">{chapter.grammarLesson.description}</p>

      <div className="advc-pattern-list">
        {patterns.map(p => (
          <GrammarPatternCard
            key={p.id}
            pattern={p}
            done={doneIds.has(p.id)}
            onDone={() => markDone(p.id)}
          />
        ))}
      </div>

      <button className="advc-dict-btn" onClick={() => setShowDict(true)}>
        📖 Grammar Dictionary
      </button>

      <button className="advc-continue-btn" onClick={onDone}>
        Continue to Dialogue →
      </button>
    </div>
  )
}

function GrammarPatternCard({ pattern, done, onDone }) {
  const [open, setOpen] = useState(false)
  const [answered, setAnswered] = useState(null)
  const [chosen, setChosen] = useState(null)
  const [tileOrder, setTileOrder] = useState(null)

  // Shuffle distractors for fill-blank
  const options = useMemo(() => {
    if (pattern.type !== 'fill-blank') return []
    return [...pattern.distractors].sort(() => Math.random() - 0.5)
  }, [pattern])

  function answerFillBlank(opt) {
    if (answered) return
    const correct = opt === pattern.distractors[0]
    setChosen(opt)
    setAnswered(correct ? 'correct' : 'wrong')
    if (correct) setTimeout(onDone, 800)
  }

  function answerPickCorrect(sentence, isCorrect) {
    if (answered) return
    setAnswered(isCorrect ? 'correct' : 'wrong')
    setChosen(sentence.text)
    if (isCorrect) setTimeout(onDone, 800)
  }

  return (
    <div className={`advc-pattern ${done ? 'done' : ''}`}>
      <button className="advc-pattern-header" onClick={() => setOpen(o => !o)}>
        <span className="advc-pattern-done-icon">{done ? '✓' : '○'}</span>
        <span className="advc-pattern-title">{pattern.title}</span>
        <span className="advc-pattern-arrow">{open ? '▾' : '›'}</span>
      </button>
      {open && (
        <div className="advc-pattern-body">
          <p className="advc-pattern-explanation">{pattern.explanation}</p>

          {pattern.type === 'fill-blank' && (
            <div className="advc-exercise">
              <p className="advc-template">{pattern.template.replace('___', '＿＿＿')}</p>
              <p className="advc-hint">{pattern.hint}</p>
              <div className="advc-options">
                {options.map(opt => (
                  <button
                    key={opt}
                    className={`advc-option ${answered && opt === chosen ? (answered === 'correct' ? 'correct' : 'wrong') : ''} ${answered && opt === pattern.distractors[0] && answered === 'wrong' ? 'correct' : ''}`}
                    onClick={() => answerFillBlank(opt)}
                    disabled={!!answered}
                  >{opt}</button>
                ))}
              </div>
              {answered === 'wrong' && (
                <button className="advc-try-again" onClick={() => { setAnswered(null); setChosen(null) }}>Try again</button>
              )}
            </div>
          )}

          {pattern.type === 'pick-correct' && (
            <div className="advc-exercise">
              <p className="advc-pick-label">Which sentences are correct?</p>
              {pattern.sentences.map((s, i) => (
                <button
                  key={i}
                  className={`advc-sentence-btn ${answered && chosen === s.text ? (s.correct ? 'correct' : 'wrong') : ''}`}
                  onClick={() => answerPickCorrect(s, s.correct)}
                  disabled={!!answered && s.correct}
                >
                  {s.text}
                  {answered && chosen === s.text && !s.correct && (
                    <span className="advc-sentence-err">{s.error}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Phase: Dialogue ────────────────────────────────────────────────────────────

function DialoguePhase({ chapter, onDone, language, lookup, scores, showReading }) {
  const dialogue = chapter.dialogue
  const [questionState, setQuestionState] = useState({})
  const [choiceState, setChoiceState] = useState({})
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [showTrans, setShowTrans] = useState(false)

  const speakerColors = ['#4f7ef8', '#22a06b', '#e05cb0', '#f0a500']
  const speakerMap = useMemo(() => {
    const speakers = [...new Set(dialogue.turns.filter(t => t.type === 'line').map(t => t.speaker))]
    return Object.fromEntries(speakers.map((s, i) => [s, i]))
  }, [dialogue])

  const userSpeaker = dialogue.speakers?.[1] ?? null

  function chooseQuestion(idx, opt, oi) {
    if (questionState[idx]) return
    setQuestionState(p => ({ ...p, [idx]: { chosen: oi, correct: opt.correct } }))
    setScore(s => ({ correct: s.correct + (opt.correct ? 1 : 0), total: s.total + 1 }))
  }

  function chooseChoice(idx, oi) {
    if (choiceState[idx] !== undefined) return
    setChoiceState(p => ({ ...p, [idx]: oi }))
  }

  const allDone = dialogue.turns.every((t, i) => {
    if (t.type === 'question') return !!questionState[i]
    if (t.type === 'choice') return choiceState[i] !== undefined
    return true
  })

  return (
    <div className="advc-phase advc-phase--dialogue">
      <div className="advc-dialogue-header">
        <div className="advc-phase-icon">💬</div>
        <div>
          <h2 className="advc-phase-title">{dialogue.title}</h2>
          <p className="advc-phase-sub">{dialogue.titleTranslation}</p>
        </div>
        <button className={`advc-trans-toggle ${showTrans ? 'active' : ''}`} onClick={() => setShowTrans(t => !t)}>EN</button>
      </div>

      <div className="advc-bubbles">
        {dialogue.turns.map((turn, i) => {
          const color = speakerColors[speakerMap[turn.speaker] ?? 0]
          const isUser = turn.speaker === userSpeaker

          if (turn.type === 'line') return (
            <div key={i} className={`advc-line ${isUser ? 'user' : 'other'}`}>
              {!isUser && <span className="advc-speaker" style={{ color }}>{turn.speaker}</span>}
              <div className="advc-bubble" style={{ '--bcolor': color }}>
                <TextWithLookup text={turn.text} language={language} lookup={lookup} scores={scores} showReading={showReading} />
                {showTrans && <div className="advc-bubble-trans">{turn.translation}</div>}
              </div>
            </div>
          )

          if (turn.type === 'question') {
            const qs = questionState[i]
            if (qs) {
              const opt = turn.options[qs.chosen]
              return (
                <div key={i} className="advc-qanswered">
                  <span>{qs.correct ? '✓' : '✗'}</span>
                  <span className={`advc-qanswered-text ${qs.correct ? 'correct' : 'wrong'}`}>{opt.text}</span>
                </div>
              )
            }
            return (
              <div key={i} className="advc-question">
                <p className="advc-question-prompt">{turn.prompt}</p>
                {turn.options.map((opt, oi) => (
                  <button key={oi} className="advc-q-option" onClick={() => chooseQuestion(i, opt, oi)}>
                    <span className="advc-q-num">{oi + 1}</span> {opt.text}
                  </button>
                ))}
              </div>
            )
          }

          if (turn.type === 'choice') {
            const ci = choiceState[i]
            if (ci !== undefined) {
              const opt = turn.options[ci]
              return (
                <div key={i} className="advc-choice-done">
                  <div className="advc-line user">
                    <div className="advc-bubble advc-bubble--choice">
                      {opt.text}
                      {showTrans && <div className="advc-bubble-trans">{opt.translation}</div>}
                    </div>
                  </div>
                  {opt.response && (
                    <div className="advc-line other">
                      <div className="advc-bubble" style={{ '--bcolor': speakerColors[0] }}>
                        {opt.response}
                        {showTrans && <div className="advc-bubble-trans">{opt.responseTranslation}</div>}
                      </div>
                    </div>
                  )}
                </div>
              )
            }
            return (
              <div key={i} className="advc-choice">
                <p className="advc-choice-prompt">
                  {turn.prompt}
                  {showTrans && <span className="advc-choice-sub"> — {turn.promptTranslation}</span>}
                </p>
                {turn.options.map((opt, oi) => (
                  <button key={oi} className="advc-choice-opt" onClick={() => chooseChoice(i, oi)}>
                    <span className="advc-choice-text">{opt.text}</span>
                    {showTrans && <span className="advc-choice-sub">{opt.translation}</span>}
                  </button>
                ))}
              </div>
            )
          }
          return null
        })}
      </div>

      {allDone && (
        <button className="advc-continue-btn" onClick={onDone}>
          Continue to Reading →
        </button>
      )}
    </div>
  )
}

// ── Phase: Passage ─────────────────────────────────────────────────────────────

function PassagePhase({ chapter, onDone, language, lookup, scores, showReading }) {
  const passage = chapter.passage
  const [showTrans, setShowTrans] = useState(false)

  return (
    <div className="advc-phase">
      <div className="advc-phase-icon">📖</div>
      <h2 className="advc-phase-title">{passage.title}</h2>
      <p className="advc-phase-sub">{passage.titleTranslation}</p>

      <div className="advc-passage-controls">
        <button className={`advc-trans-toggle ${showTrans ? 'active' : ''}`} onClick={() => setShowTrans(t => !t)}>
          EN
        </button>
        <SpeakButton text={passage.text} language={language} size="sm" />
      </div>

      <div className="advc-passage-text">
        <TextWithLookup text={passage.text} language={language} lookup={lookup} scores={scores} showReading={showReading} />
      </div>

      {showTrans && (
        <div className="advc-passage-trans">{passage.translation}</div>
      )}

      <button className="advc-continue-btn" onClick={onDone}>
        Complete Chapter →
      </button>
    </div>
  )
}

// ── Phase: Complete ────────────────────────────────────────────────────────────

function CompletePhase({ chapter, onNext, onMap }) {
  const artifact = chapter.grammarArtifact
  return (
    <div className="advc-phase advc-phase--complete">
      <div className="advc-complete-star">⭐</div>
      <h2 className="advc-complete-title">Chapter Complete!</h2>
      <p className="advc-complete-chapter">{chapter.title}</p>
      <p className="advc-complete-sub">{chapter.titleTranslation}</p>

      {artifact && (
        <div className="advc-artifact">
          <span className="advc-artifact-icon">{artifact.icon}</span>
          <div>
            <div className="advc-artifact-name">{artifact.name}</div>
            <div className="advc-artifact-grammar">{artifact.grammar}</div>
          </div>
        </div>
      )}

      <p className="advc-outro">{chapter.storyOutro}</p>
      <p className="advc-outro-trans">{chapter.storyOutroTranslation}</p>

      <div className="advc-complete-btns">
        {onNext && <button className="advc-continue-btn" onClick={onNext}>Next Chapter →</button>}
        <button className="advc-map-btn" onClick={onMap}>← Chapter Map</button>
      </div>
    </div>
  )
}

// ── Main AdventureChapter ─────────────────────────────────────────────────────

export default function AdventureChapter({ chapter, currentPhase, onPhaseAdvance, onComplete, onBack }) {
  const { activeEntries, activeLanguage, showReading, scores } = useApp()
  const language = activeLanguage ?? 'ja'

  const wordEntries = useMemo(
    () => resolveWordIds(chapter.vocabLesson?.wordIds, activeEntries),
    [chapter, activeEntries]
  )

  const lookup = useMemo(() => buildLookup(activeEntries), [activeEntries])

  // Determine which phase to show
  const phase = currentPhase === 'complete' ? 'complete' : (currentPhase ?? 'vocab')

  function advanceTo(nextPhase) {
    onPhaseAdvance(nextPhase)
  }

  // Phase step bar
  const PHASE_LABELS = { vocab: '📚', grammar: '📐', dialogue: '💬', passage: '📖', complete: '⭐' }
  const phaseOrder = ['vocab', 'grammar', 'dialogue', 'passage', 'complete']
  const currentIdx = phaseOrder.indexOf(phase)

  return (
    <div className="advc-screen">
      {/* Header */}
      <div className="advc-header">
        <button className="advc-back" onClick={onBack}>← Map</button>
        <div className="advc-header-center">
          <span className="advc-chapter-num">Chapter {chapter.number}</span>
          <span className="advc-chapter-name">{chapter.titleTranslation}</span>
        </div>
        <span className="advc-level-tag">{chapter.level}</span>
      </div>

      {/* Phase progress bar */}
      <div className="advc-phase-bar">
        {phaseOrder.map((p, i) => (
          <div key={p} className={`advc-phase-step ${i <= currentIdx ? 'done' : ''} ${i === currentIdx ? 'current' : ''}`}>
            <span className="advc-phase-step-icon">{PHASE_LABELS[p]}</span>
          </div>
        ))}
      </div>

      {/* Story intro (shown before vocab phase only) */}
      {phase === 'vocab' && (
        <div className="advc-story-intro">
          <p>{chapter.storyIntro}</p>
          <p className="advc-story-trans">{chapter.storyIntroTranslation}</p>
        </div>
      )}

      {/* Phase content */}
      <div className="advc-content">
        {phase === 'vocab' && (
          <VocabPhase
            chapter={chapter}
            entries={wordEntries}
            language={language}
            onDone={() => advanceTo('grammar')}
          />
        )}
        {phase === 'grammar' && (
          <GrammarPhase
            chapter={chapter}
            onDone={() => advanceTo('dialogue')}
          />
        )}
        {phase === 'dialogue' && (
          <DialoguePhase
            chapter={chapter}
            language={language}
            lookup={lookup}
            scores={scores}
            showReading={showReading}
            onDone={() => advanceTo('passage')}
          />
        )}
        {phase === 'passage' && (
          <PassagePhase
            chapter={chapter}
            language={language}
            lookup={lookup}
            scores={scores}
            showReading={showReading}
            onDone={onComplete}
          />
        )}
        {phase === 'complete' && (
          <CompletePhase
            chapter={chapter}
            onMap={onBack}
          />
        )}
      </div>
    </div>
  )
}
