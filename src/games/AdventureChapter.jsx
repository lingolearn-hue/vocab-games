import { useState, useEffect, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { buildLookup } from '../engine/reader'
import { loadTSVChapter } from '../engine/dialogueTSV'
import { TextWithLookup } from '../components/TextWithLookup'
import SpeakButton from '../components/SpeakButton'
import GrammarDictionary from './GrammarDictionary'
import './AdventureChapter.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveWordIds(wordIds, activeEntries) {
  if (!wordIds?.length) return []
  const byEntry = new Map(activeEntries.map(e => [e.entry, e]))
  return wordIds.map(id => byEntry.get(id)).filter(Boolean)
}

// ── Vocab Phase ───────────────────────────────────────────────────────────────

function VocabPhase({ chapter, entries, language, onBack }) {
  const { setScreen, setSessionEntries } = useApp()

  function launchGame(game) {
    setSessionEntries(entries)
    setScreen(game)
  }

  return (
    <div className="advc-phase">
      <div className="advc-phase-header">
        <button className="advc-back-small" onClick={onBack}>← Back</button>
        <div className="advc-phase-icon">📚</div>
        <h2 className="advc-phase-title">{chapter.vocabLesson?.title ?? 'Vocabulary'}</h2>
      </div>
      <p className="advc-phase-desc">{chapter.vocabLesson?.description}</p>

      <div className="advc-word-list">
        {entries.map(e => (
          <div key={e.id} className="advc-word-item">
            <span className="advc-word-entry">{e.entry}</span>
            {e.reading && <span className="advc-word-reading">{e.reading}</span>}
            <span className="advc-word-trans">{e.translation[0]}</span>
            <SpeakButton text={e.entry} language={language} size="sm" />
          </div>
        ))}
        {entries.length === 0 && (
          <p className="advc-warn">⚠ No vocab entries found for this chapter.</p>
        )}
      </div>

      <div className="advc-game-row">
        <span className="advc-game-label">Train with:</span>
        <div className="advc-game-btns">
          <button className="advc-game-btn" onClick={() => launchGame('flashcard')} disabled={entries.length < 1}>🃏 Flashcard</button>
          <button className="advc-game-btn" onClick={() => launchGame('pairmatch')} disabled={entries.length < 2}>🔗 Match</button>
          <button className="advc-game-btn" onClick={() => launchGame('racecar')}   disabled={entries.length < 3}>🏎 Race Car</button>
        </div>
      </div>
    </div>
  )
}

// ── Grammar Phase ─────────────────────────────────────────────────────────────

function GrammarPhase({ chapter, onBack }) {
  const [doneIds, setDoneIds] = useState(new Set())
  const [showDict, setShowDict] = useState(false)
  const patterns = chapter.grammarLesson?.patterns ?? []

  if (showDict) return <GrammarDictionary patterns={patterns} onBack={() => setShowDict(false)} />

  return (
    <div className="advc-phase">
      <div className="advc-phase-header">
        <button className="advc-back-small" onClick={onBack}>← Back</button>
        <div className="advc-phase-icon">📐</div>
        <h2 className="advc-phase-title">{chapter.grammarLesson?.title ?? 'Grammar'}</h2>
      </div>
      <p className="advc-phase-desc">{chapter.grammarLesson?.description}</p>

      <div className="advc-pattern-list">
        {patterns.map(p => (
          <GrammarPatternCard key={p.id} pattern={p} done={doneIds.has(p.id)} onDone={() => setDoneIds(prev => new Set([...prev, p.id]))} />
        ))}
      </div>

      <button className="advc-dict-btn" onClick={() => setShowDict(true)}>📖 Grammar Dictionary</button>
    </div>
  )
}

function GrammarPatternCard({ pattern, done, onDone }) {
  const [open, setOpen] = useState(false)
  const [answered, setAnswered] = useState(null)
  const [chosen, setChosen] = useState(null)

  const options = useMemo(() => {
    if (pattern.type !== 'fill-blank') return []
    return [...pattern.distractors].sort(() => Math.random() - 0.5)
  }, [pattern.id])

  function answerFillBlank(opt) {
    if (answered) return
    const correct = opt === pattern.distractors[0]
    setChosen(opt); setAnswered(correct ? 'correct' : 'wrong')
    if (correct) setTimeout(onDone, 600)
  }

  function answerPickCorrect(sentence) {
    if (answered) return
    setAnswered(sentence.correct ? 'correct' : 'wrong')
    setChosen(sentence.text)
    if (sentence.correct) setTimeout(onDone, 600)
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
              {pattern.hint && !answered && <p className="advc-hint">{pattern.hint}</p>}
              <div className="advc-options">
                {options.map(opt => (
                  <button key={opt}
                    className={`advc-option ${answered && opt === chosen ? (answered === 'correct' ? 'correct' : 'wrong') : ''} ${answered && opt === pattern.distractors[0] && answered === 'wrong' ? 'correct' : ''}`}
                    onClick={() => answerFillBlank(opt)} disabled={!!answered}>{opt}</button>
                ))}
              </div>
              {answered === 'wrong' && <button className="advc-try-again" onClick={() => { setAnswered(null); setChosen(null) }}>Try again</button>}
            </div>
          )}
          {pattern.type === 'pick-correct' && (
            <div className="advc-exercise">
              <p className="advc-pick-label">Which sentence is correct?</p>
              {pattern.sentences.map((s, i) => (
                <button key={i}
                  className={`advc-sentence-btn ${answered && chosen === s.text ? (s.correct ? 'correct' : 'wrong') : ''}`}
                  onClick={() => answerPickCorrect(s)} disabled={!!answered && s.correct}>
                  {s.text}
                  {answered && chosen === s.text && !s.correct && <span className="advc-sentence-err">{s.error}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Dialogue Phase ────────────────────────────────────────────────────────────

function DialoguePhase({ dialogue, language, lookup, scores, showReading, onBack, onDone }) {
  const [questionState, setQuestionState] = useState({})
  const [choiceState, setChoiceState]     = useState({})
  const [turnIndex, setTurnIndex]         = useState(0)
  const [showTrans, setShowTrans]         = useState(false)

  const speakerColors = ['#4f7ef8', '#22a06b', '#e05cb0', '#f0a500']
  const speakerMap = useMemo(() => {
    const speakers = [...new Set(dialogue.turns.filter(t => t.type === 'line').map(t => t.speaker))]
    return Object.fromEntries(speakers.map((s, i) => [s, i]))
  }, [dialogue])

  // Auto-advance line turns
  useEffect(() => {
    const turn = dialogue.turns[turnIndex]
    if (!turn || turn.type !== 'line') return
    if (turnIndex >= dialogue.turns.length - 1) return
    const t = setTimeout(() => setTurnIndex(i => i + 1), 600)
    return () => clearTimeout(t)
  }, [turnIndex, dialogue])

  function chooseQuestion(idx, opt, oi) {
    if (questionState[idx]) return
    setQuestionState(p => ({ ...p, [idx]: { chosen: oi, correct: opt.correct } }))
    setTurnIndex(i => Math.min(dialogue.turns.length - 1, Math.max(i, idx + 1)))
  }
  function chooseChoice(idx, oi) {
    if (choiceState[idx] !== undefined) return
    setChoiceState(p => ({ ...p, [idx]: oi }))
    setTurnIndex(i => Math.min(dialogue.turns.length - 1, Math.max(i, idx + 1)))
  }

  const allDone = dialogue.turns.every((t, i) => {
    if (t.type === 'question') return !!questionState[i]
    if (t.type === 'choice')   return choiceState[i] !== undefined
    return true
  })

  return (
    <div className="advc-phase advc-phase--dialogue">
      <div className="advc-dialogue-header">
        <button className="advc-back-small" onClick={onBack}>← Back</button>
        <div>
          <h2 className="advc-phase-title">{dialogue.title}</h2>
          {dialogue.titleTranslation && <p className="advc-phase-sub">{dialogue.titleTranslation}</p>}
        </div>
        <button className={`advc-trans-toggle ${showTrans ? 'active' : ''}`} onClick={() => setShowTrans(t => !t)}>EN</button>
      </div>

      <div className="advc-bubbles">
        {dialogue.turns.slice(0, turnIndex + 1).map((turn, i) => {
          const color = speakerColors[speakerMap[turn.speaker] ?? 0]
          const isNarrator = turn.speaker === 'narrator' || turn.speaker === 'Narrator'
          const isUser = dialogue.type === 'choice' && turn.speaker === dialogue.speakers?.[dialogue.speakers.length - 1]

          if (turn.type === 'line') return (
            <div key={i} className={`advc-line ${isNarrator ? 'narrator' : isUser ? 'user' : 'other'}`}>
              {!isUser && !isNarrator && <span className="advc-speaker" style={{ color }}>{turn.speaker}</span>}
              <div className={`advc-bubble ${isNarrator ? 'advc-bubble--narrator' : ''}`} style={isNarrator ? {} : { '--bcolor': color }}>
                <TextWithLookup text={turn.text} language={language} lookup={lookup} scores={scores} showReading={showReading} />
                {showTrans && turn.translation && <div className="advc-bubble-trans">{turn.translation}</div>}
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
                <p className="advc-question-prompt">
                  {turn.prompt}
                  {showTrans && turn.translation && <span className="advc-choice-sub"> — {turn.translation}</span>}
                </p>
                {turn.options.map((opt, oi) => (
                  <button key={oi} className="advc-q-option" onClick={() => chooseQuestion(i, opt, oi)}>
                    <span className="advc-q-num">{oi + 1}</span> {opt.text}
                    {showTrans && opt.translation && <span className="advc-choice-sub"> ({opt.translation})</span>}
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
                    <div className="advc-bubble advc-bubble--choice">{opt.text}
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
                <p className="advc-choice-prompt">{turn.prompt}{showTrans && <span className="advc-choice-sub"> — {turn.promptTranslation}</span>}</p>
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

      {allDone && <button className="advc-continue-btn" onClick={onDone}>Continue →</button>}
    </div>
  )
}

// ── Passage Phase ─────────────────────────────────────────────────────────────

function PassagePhase({ passage, language, lookup, scores, showReading, onBack, onDone }) {
  const [showTrans, setShowTrans] = useState(false)
  return (
    <div className="advc-phase">
      <div className="advc-phase-header">
        <button className="advc-back-small" onClick={onBack}>← Back</button>
        <div className="advc-phase-icon">📖</div>
        <h2 className="advc-phase-title">{passage.title}</h2>
      </div>
      <div className="advc-passage-controls">
        <button className={`advc-trans-toggle ${showTrans ? 'active' : ''}`} onClick={() => setShowTrans(t => !t)}>EN</button>
        <SpeakButton text={passage.text} language={language} size="sm" />
      </div>
      <div className="advc-passage-text">
        <TextWithLookup text={passage.text} language={language} lookup={lookup} scores={scores} showReading={showReading} />
      </div>
      {showTrans && <div className="advc-passage-trans">{passage.translation}</div>}
      <button className="advc-continue-btn" onClick={onDone}>Complete Chapter →</button>
    </div>
  )
}

// ── Complete Phase ────────────────────────────────────────────────────────────

function CompletePhase({ chapter, onMap }) {
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
      <button className="advc-map-btn" onClick={onMap}>← Chapter Map</button>
    </div>
  )
}

// ── Chapter Overview Hub ──────────────────────────────────────────────────────

function ChapterHub({ chapter, wordEntries, dialogues, language, lookup, scores, showReading, currentPhase, onPhaseAdvance, onComplete, onBack }) {
  const [activeView, setActiveView] = useState(null)
  const [doneParts, setDoneParts]   = useState(new Set())

  const isComplete = currentPhase === 'complete'
  const phaseOrder = ['vocab','grammar','dialogue','passage','complete']
  const phaseDone  = p =>
    phaseOrder.indexOf(currentPhase) > phaseOrder.indexOf(p) ||
    currentPhase === 'complete' || doneParts.has(p)

  function markPartDone(part) {
    setDoneParts(prev => new Set([...prev, part]))
    const idx    = phaseOrder.indexOf(part)
    const curIdx = phaseOrder.indexOf(currentPhase ?? 'vocab')
    if (idx >= curIdx) onPhaseAdvance(phaseOrder[Math.min(idx + 1, phaseOrder.length - 2)])
    setActiveView(null)
  }

  // Active sub-view — always has its own ← Back to hub
  if (activeView === 'vocab') return (
    <VocabPhase chapter={chapter} entries={wordEntries} language={language} onBack={() => setActiveView(null)} />
  )
  if (activeView === 'grammar') return (
    <GrammarPhase chapter={chapter} onBack={() => setActiveView(null)} />
  )
  if (activeView?.type === 'dialogue') {
    const dl = dialogues[activeView.idx]
    if (!dl) { setActiveView(null); return null }
    return (
      <DialoguePhase
        dialogue={dl} language={language} lookup={lookup} scores={scores} showReading={showReading}
        onBack={() => setActiveView(null)}
        onDone={() => markPartDone('dialogue')}
      />
    )
  }
  if (activeView?.type === 'passage') return (
    <PassagePhase
      passage={chapter.passage} language={language} lookup={lookup} scores={scores} showReading={showReading}
      onBack={() => setActiveView(null)}
      onDone={() => markPartDone('passage')}
    />
  )
  if (isComplete) return <CompletePhase chapter={chapter} onMap={onBack} />

  // ── Hub layout ──
  return (
    <div className="advc-hub">
      {/* Story intro */}
      <div className="advc-story-intro">
        <p>{chapter.storyIntro}</p>
        <p className="advc-story-trans">{chapter.storyIntroTranslation}</p>
      </div>

      <div className="advc-hub-body">
        {/* Left: vocab shortcut */}
        <div className="advc-hub-left">
          <button className="advc-hub-vocab-btn" onClick={() => setActiveView('vocab')}>
            <span className="advc-hub-vocab-icon">📚</span>
            <span className="advc-hub-vocab-label">Vocab</span>
            <span className="advc-hub-vocab-count">{wordEntries.length} words</span>
            {phaseDone('vocab') && <span className="advc-hub-check">✓</span>}
          </button>
          <button className="advc-hub-vocab-btn" onClick={() => setActiveView('grammar')}>
            <span className="advc-hub-vocab-icon">📐</span>
            <span className="advc-hub-vocab-label">Grammar</span>
            <span className="advc-hub-vocab-count">{chapter.grammarLesson?.patterns?.length ?? 0} patterns</span>
            {phaseDone('grammar') && <span className="advc-hub-check">✓</span>}
          </button>
        </div>

        {/* Right: dialogues + passage */}
        <div className="advc-hub-right">
          <div className="advc-hub-section-label">Dialogues</div>
          {dialogues.length === 0 && (
            <p className="advc-hub-empty">No dialogues loaded.</p>
          )}
          {dialogues.map((dl, i) => (
            <button key={dl.id} className="advc-hub-content-btn" onClick={() => setActiveView({ type: 'dialogue', idx: i })}>
              <span className="advc-hub-content-icon">💬</span>
              <div className="advc-hub-content-info">
                <span className="advc-hub-content-title">{dl.title}</span>
                <span className="advc-hub-content-meta">{dl.turns?.filter(t => t.type === 'line').length ?? 0} lines</span>
              </div>
              {phaseDone('dialogue') && <span className="advc-hub-check">✓</span>}
            </button>
          ))}

          {chapter.passage && (
            <>
              <div className="advc-hub-section-label" style={{ marginTop: dialogues.length ? '0.8rem' : 0 }}>Reading</div>
              <button className="advc-hub-content-btn" onClick={() => setActiveView({ type: 'passage' })}>
                <span className="advc-hub-content-icon">📖</span>
                <div className="advc-hub-content-info">
                  <span className="advc-hub-content-title">{chapter.passage.title}</span>
                  <span className="advc-hub-content-meta">{chapter.passage.titleTranslation}</span>
                </div>
                {phaseDone('passage') && <span className="advc-hub-check">✓</span>}
              </button>
            </>
          )}

          {/* Complete chapter button — shown when all content visited */}
          {(phaseDone('dialogue') || dialogues.length === 0) && (!chapter.passage || phaseDone('passage')) && (
            <button className="advc-hub-complete-btn" onClick={onComplete}>
              ⭐ Complete Chapter
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main AdventureChapter ─────────────────────────────────────────────────────

export default function AdventureChapter({ chapter, currentPhase, onPhaseAdvance, onComplete, onBack }) {
  const { activeEntries, activeLanguage, showReading, scores } = useApp()
  const language = activeLanguage ?? 'ja'

  const lookup = useMemo(() => buildLookup(activeEntries), [activeEntries])

  // All content loaded from TSV — no campaign JSON needed
  const [dialogues,   setDialogues]   = useState([])
  const [passages,    setPassages]    = useState([])
  const [wordEntries, setWordEntries] = useState([])
  const [tsvMeta,     setTsvMeta]     = useState(null)

  useEffect(() => {
    const chNum = String(chapter.number ?? 1).padStart(2, '0')
    const path  = `./dialogues/tsv/adv01${chNum}.tsv`
    loadTSVChapter(path, language).then(data => {
      if (!data) return
      const { meta, sections } = data
      setTsvMeta(meta)
      setDialogues(sections.flatMap(s => s.dialogues))
      setPassages(sections.flatMap(s => s.passages))
      // Resolve vocab wordIds from TSV @vocab lines
      const allVocab = [...new Set(sections.flatMap(s => s.vocab))]
      if (allVocab.length) {
        const byEntry = new Map(activeEntries.map(e => [e.entry, e]))
        setWordEntries(allVocab.map(w => byEntry.get(w)).filter(Boolean))
      }
    })
  }, [chapter.number, language, activeEntries])

  // Use TSV meta if available, fall back to campaign JSON fields
  const chapterTitle  = tsvMeta?.chapterTitle?.en   ?? chapter.titleTranslation
  const chapterLevel  = tsvMeta?.level               ?? chapter.level
  const storyIntro    = tsvMeta?.storyIntro?.[language] ?? tsvMeta?.storyIntro?.en ?? chapter.storyIntro ?? ''
  const storyOutro    = tsvMeta?.storyOutro?.[language] ?? tsvMeta?.storyOutro?.en ?? chapter.storyOutro ?? ''
  const artifact      = tsvMeta?.artifact ?? chapter.grammarArtifact

  // Phase step bar
  const phaseOrder = ['vocab', 'grammar', 'dialogue', 'passage', 'complete']
  const PHASE_LABELS = { vocab: '📚', grammar: '📐', dialogue: '💬', passage: '📖', complete: '⭐' }
  const currentIdx = phaseOrder.indexOf(currentPhase === 'complete' ? 'complete' : (currentPhase ?? 'vocab'))

  return (
    <div className="advc-screen">
      <div className="advc-header">
        <button className="advc-back" onClick={onBack}>← Map</button>
        <div className="advc-header-center">
          <span className="advc-chapter-num">Chapter {chapter.number}</span>
          <span className="advc-chapter-name">{chapterTitle}</span>
        </div>
        <span className="advc-level-tag">{chapterLevel}</span>
      </div>

      <div className="advc-phase-bar">
        {phaseOrder.map((p, i) => (
          <div key={p} className={`advc-phase-step ${i <= currentIdx ? 'done' : ''} ${i === currentIdx ? 'current' : ''}`}>
            <span className="advc-phase-step-icon">{PHASE_LABELS[p]}</span>
          </div>
        ))}
      </div>

      <div className="advc-content">
        <ChapterHub
          chapter={{ ...chapter, storyIntro, storyOutro, storyIntroTranslation: tsvMeta?.storyIntro?.en, grammarArtifact: artifact, passage: passages[0] ?? chapter.passage }}
          wordEntries={wordEntries}
          dialogues={dialogues}
          language={language}
          lookup={lookup}
          scores={scores}
          showReading={showReading}
          currentPhase={currentPhase ?? 'vocab'}
          onPhaseAdvance={onPhaseAdvance}
          onComplete={onComplete}
          onBack={onBack}
        />
      </div>
    </div>
  )
}
