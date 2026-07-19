import { useState, useEffect, useMemo, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { buildLookup } from '../engine/reader'
import { loadChapterJSON } from '../engine/campaignLoader'
import { TextWithLookup } from '../components/TextWithLookup'
import SpeakButton from '../components/SpeakButton'
import GrammarDictionary from './GrammarDictionary'
import './AdventureChapter.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

// ── Vocab Phase ───────────────────────────────────────────────────────────────

function VocabPhase({ chapter, entries, language }) {
  const { setScreen, setSessionEntries } = useApp()

  function launchGame(game) {
    setSessionEntries(entries)
    setScreen(game)
  }

  return (
    <div className="advc-phase">
      <div className="advc-phase-header">
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

function GrammarPhase({ chapter }) {
  const [doneIds, setDoneIds] = useState(new Set())
  const [showDict, setShowDict] = useState(false)
  const patterns = chapter.grammarLesson?.patterns ?? []

  if (showDict) return <GrammarDictionary patterns={patterns} onBack={() => setShowDict(false)} />

  return (
    <div className="advc-phase">
      <div className="advc-phase-header">
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

function DialoguePhase({ dialogue, language, lookup, scores, showReading, surfaceForms, onDone, isLastItem }) {
  const [questionState, setQuestionState] = useState({})
  const [choiceState, setChoiceState]     = useState({})
  const [turnIndex, setTurnIndex]         = useState(0)
  const [shownTrans, setShownTrans]       = useState(new Set())  // per-bubble
  const bubblesRef = useRef(null)

  const speakerColors = ['#4f7ef8', '#22a06b', '#e05cb0', '#f0a500']
  const speakerMap = useMemo(() => {
    const speakers = [...new Set(dialogue.turns.filter(t => t.type === 'line').map(t => t.speaker))]
    return Object.fromEntries(speakers.map((s, i) => [s, i]))
  }, [dialogue])

  // Scroll to bottom when new turn appears
  useEffect(() => {
    if (bubblesRef.current) {
      bubblesRef.current.scrollTop = bubblesRef.current.scrollHeight
    }
  }, [turnIndex, questionState, choiceState])

  const currentTurn = dialogue.turns[turnIndex]
  const isInteractive = currentTurn?.type === 'question' || currentTurn?.type === 'choice'
  const allDone = turnIndex >= dialogue.turns.length - 1 &&
    dialogue.turns.every((t, i) => {
      if (t.type === 'question') return !!questionState[i]
      if (t.type === 'choice')   return choiceState[i] !== undefined
      return true
    })

  function advance() {
    if (isInteractive) return  // wait for user interaction
    if (turnIndex < dialogue.turns.length - 1) setTurnIndex(i => i + 1)
  }

  function toggleTrans(idx) {
    setShownTrans(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

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

  return (
    <div className="advc-phase advc-phase--dialogue">
      <div className="advc-dialogue-header">
        <div>
          <h2 className="advc-phase-title">{dialogue.title}</h2>
          {dialogue.titleTranslation && <p className="advc-phase-sub">{dialogue.titleTranslation}</p>}
        </div>
      </div>

      <div className="advc-bubbles" ref={bubblesRef}>
        {dialogue.turns.slice(0, turnIndex + 1).map((turn, i) => {
          const color = speakerColors[speakerMap[turn.speaker] ?? 0]
          const isNarrator = turn.speaker === 'narrator' || turn.speaker === 'Narrator'
          const isUser = dialogue.type === 'choice' && turn.speaker === dialogue.speakers?.[dialogue.speakers.length - 1]
          const showTrans = shownTrans.has(i)

          if (turn.type === 'line') return (
            <div key={i} className={`advc-line ${isNarrator ? 'narrator' : isUser ? 'user' : 'other'}`}>
              {!isUser && !isNarrator && <span className="advc-speaker" style={{ color }}>{turn.speaker}</span>}
              <div className={`advc-bubble ${isNarrator ? 'advc-bubble--narrator' : ''}`} style={isNarrator ? {} : { '--bcolor': color }}>
                <TextWithLookup text={turn.text} language={language} lookup={lookup} scores={scores} showReading={showReading} surfaceForms={surfaceForms} />
                {showTrans && turn.translation && <div className="advc-bubble-trans">{turn.translation}</div>}
                {turn.translation && (
                  <button className="advc-bubble-en-btn" onClick={e => { e.stopPropagation(); toggleTrans(i) }}>
                    {showTrans ? '▲' : 'EN'}
                  </button>
                )}
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
                  {turn.translation && (
                    <button className="advc-bubble-en-btn advc-bubble-en-btn--inline" onClick={() => toggleTrans(i)}>
                      {showTrans ? '▲' : 'EN'}
                    </button>
                  )}
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
                <p className="advc-choice-prompt">
                  {turn.prompt}
                  {showTrans && <span className="advc-choice-sub"> — {turn.promptTranslation}</span>}
                  {turn.prompt && (
                    <button className="advc-bubble-en-btn advc-bubble-en-btn--inline" onClick={() => toggleTrans(i)}>
                      {showTrans ? '▲' : 'EN'}
                    </button>
                  )}
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

      {/* Tap zone at bottom — advances to next line, or shows Continue when done */}
      {allDone ? (
        <button className="advc-continue-btn" onClick={onDone}>{isLastItem ? 'End Chapter →' : 'Continue →'}</button>
      ) : !isInteractive ? (
        <button className="advc-tap-next" onClick={advance}>
          <span className="advc-tap-hint">tap to continue</span>
          <span className="advc-tap-arrow">▼</span>
        </button>
      ) : null}
    </div>
  )
}

// ── Passage Phase ─────────────────────────────────────────────────────────────

function PassagePhase({ passage, language, lookup, scores, showReading, surfaceForms, onDone, isLastItem }) {
  const parts = passage.parts ?? [passage]  // fall back to single-part shape for any legacy callers
  const [revealedCount, setRevealedCount] = useState(1)  // how many parts are shown so far
  const [shownTrans, setShownTrans] = useState(new Set())
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [revealedCount])

  function toggleTrans(i) {
    setShownTrans(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  function advance() {
    if (revealedCount < parts.length) setRevealedCount(c => c + 1)
  }

  const allRevealed = revealedCount >= parts.length
  const headerTitle = typeof passage.title === 'string' ? passage.title : (passage.title?.[language] || passage.title?.en || '')

  return (
    <div className="advc-phase">
      <div className="advc-phase-header">
        <div className="advc-phase-icon">📖</div>
        <h2 className="advc-phase-title">{headerTitle}</h2>
      </div>

      <div className="advc-passage-parts">
        {parts.slice(0, revealedCount).map((part, i) => (
          <div key={i} className="advc-passage-part">
            <div className="advc-passage-part-header">
              <span className="advc-passage-part-title">{part.title}</span>
              <div className="advc-passage-controls">
                <button className={`advc-trans-toggle ${shownTrans.has(i) ? 'active' : ''}`} onClick={() => toggleTrans(i)}>EN</button>
                <SpeakButton text={part.text} language={language} size="sm" />
              </div>
            </div>
            <div className="advc-passage-text">
              <TextWithLookup text={part.text} language={language} lookup={lookup} scores={scores} showReading={showReading} surfaceForms={surfaceForms} />
            </div>
            {shownTrans.has(i) && <div className="advc-passage-trans">{part.translation}</div>}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Tap zone at bottom — reveals next part, or shows Continue/End Chapter when all parts shown */}
      {allRevealed ? (
        <button className="advc-continue-btn" onClick={onDone}>{isLastItem ? 'End Chapter →' : 'Continue →'}</button>
      ) : (
        <button className="advc-tap-next" onClick={advance}>
          <span className="advc-tap-hint">tap to continue</span>
          <span className="advc-tap-arrow">▼</span>
        </button>
      )}
    </div>
  )
}

// ── Complete Phase ────────────────────────────────────────────────────────────

// ── Chapter Overview Hub ──────────────────────────────────────────────────────

function ChapterHub({ chapter, storyIntro, storyIntroTranslation, wordEntries, contentItems, surfaceForms, language, lookup, scores, showReading, currentPhase, onPhaseAdvance, onComplete, activeView, setActiveView }) {
  const [doneParts, setDoneParts]   = useState(new Set())       // 'vocab' / 'grammar' — single-item phases
  const [doneItems, setDoneItems]   = useState(new Set())       // individual content item indices (dialogue/passage)
  const [pendingItem, setPendingItem] = useState(null)  // item awaiting vocab-overlay dismissal before opening

  const isComplete = currentPhase === 'complete'
  const phaseOrder = ['vocab','grammar','dialogue','passage','complete']

  const dialogueItems = contentItems.filter(c => c.type === 'dialogue')
  const passageItems  = contentItems.filter(c => c.type === 'passage')
  const allDialoguesDone = dialogueItems.length === 0 ||
    contentItems.every((c, i) => c.type !== 'dialogue' || doneItems.has(i))
  const allPassagesDone = passageItems.length === 0 ||
    contentItems.every((c, i) => c.type !== 'passage' || doneItems.has(i))

  const phaseDone  = p => {
    if (phaseOrder.indexOf(currentPhase) > phaseOrder.indexOf(p) || currentPhase === 'complete') return true
    if (p === 'dialogue') return allDialoguesDone && dialogueItems.length > 0
    if (p === 'passage')  return allPassagesDone && passageItems.length > 0
    return doneParts.has(p)
  }

  // Mark a single dialogue/passage item done by index; advance overall phase only
  // once every item of that type has been completed. Then jump straight to the
  // next content item (going through its vocab overlay if it has one), or back
  // to the hub if this was the last item.
  function markItemDone(itemIdx, itemType) {
    setDoneItems(prev => new Set([...prev, itemIdx]))
    const willAllBeDone = contentItems.every((c, i) =>
      c.type !== itemType || i === itemIdx || doneItems.has(i)
    )
    if (willAllBeDone) {
      const idx    = phaseOrder.indexOf(itemType)
      const curIdx = phaseOrder.indexOf(currentPhase ?? 'vocab')
      if (idx >= curIdx) onPhaseAdvance(phaseOrder[Math.min(idx + 1, phaseOrder.length - 2)])
    }
    const nextIdx = itemIdx + 1
    if (nextIdx < contentItems.length) {
      openItem(contentItems[nextIdx], nextIdx)
    } else {
      setActiveView(null)
    }
  }

  // Open a content item (dialogue or passage). If it has section vocab, show the
  // overlay first; the overlay's dismissal then opens the actual content. Clearing
  // activeView here is essential — the overlay only renders in the hub-layout JSX,
  // so any current dialogue/passage view must be cleared for that JSX to be reached.
  function openItem(item, idx) {
    const view = item.type === 'dialogue' ? { type: 'dialogue', idx } : { type: 'passage', idx }
    if (item.sectionVocab?.length) {
      setActiveView(null)
      setPendingItem({ view, vocab: item.sectionVocab })
    } else {
      setActiveView(view)
    }
  }

  function dismissOverlay() {
    if (pendingItem) {
      setActiveView(pendingItem.view)
      setPendingItem(null)
    }
  }

  // Active sub-view — top-level header (in AdventureChapter) handles back navigation now
  if (activeView === 'vocab') return (
    <VocabPhase chapter={chapter} entries={wordEntries} language={language} />
  )
  if (activeView === 'grammar') return (
    <GrammarPhase chapter={chapter} />
  )
  if (activeView?.type === 'dialogue') {
    const dl = contentItems[activeView.idx]?.data
    if (!dl) { setActiveView(null); return null }
    return (
      <DialoguePhase
        dialogue={dl} language={language} lookup={lookup} scores={scores} showReading={showReading} surfaceForms={surfaceForms}
        onDone={() => markItemDone(activeView.idx, 'dialogue')}
        isLastItem={activeView.idx === contentItems.length - 1}
      />
    )
  }
  if (activeView?.type === 'passage') return (
    <PassagePhase
      passage={contentItems[activeView.idx]?.data} language={language} lookup={lookup} scores={scores} showReading={showReading} surfaceForms={surfaceForms}
      onDone={() => markItemDone(activeView.idx, 'passage')}
      isLastItem={activeView.idx === contentItems.length - 1}
    />
  )
  // ── Hub layout ──
  return (
    <div className="advc-hub">
      {/* Story intro */}
      <div className="advc-story-intro">
        {storyIntro && <p>{storyIntro}</p>}
        {storyIntroTranslation && storyIntroTranslation !== storyIntro && <p className="advc-story-trans">{storyIntroTranslation}</p>}
      </div>

      <div className="advc-hub-body">
        {/* Left: vocab shortcut */}
        <div className="advc-hub-left">
          <button className={`advc-hub-vocab-btn ${phaseDone('vocab') ? 'is-done' : ''}`} onClick={() => setActiveView('vocab')}>
            <span className="advc-hub-vocab-icon">📚</span>
            <span className="advc-hub-vocab-label">Vocab</span>
            <span className="advc-hub-vocab-count">{wordEntries.length} words</span>
            {phaseDone('vocab') && <span className="advc-hub-check">✓</span>}
          </button>
          <button className={`advc-hub-vocab-btn ${phaseDone('grammar') ? 'is-done' : ''}`} onClick={() => setActiveView('grammar')}>
            <span className="advc-hub-vocab-icon">📐</span>
            <span className="advc-hub-vocab-label">Grammar</span>
            <span className="advc-hub-vocab-count">{chapter.grammarLesson?.patterns?.length ?? 0} patterns</span>
            {phaseDone('grammar') && <span className="advc-hub-check">✓</span>}
          </button>
        </div>

        {/* Right: ordered dialogue + passage content */}
        <div className="advc-hub-right">
          {contentItems.length === 0 && (
            <p className="advc-hub-empty">No content loaded.</p>
          )}
          {contentItems.map((item, i) => {
            const title = item.type === 'dialogue'
              ? item.data.title
              : (typeof item.data.title === 'string' ? item.data.title : (item.data.title?.[language] || item.data.title?.en || ''))
            const meta = item.type === 'dialogue'
              ? `${item.data.turns?.filter(t => t.type === 'line').length ?? 0} lines`
              : `${item.data.parts?.length ?? 1} part${(item.data.parts?.length ?? 1) === 1 ? '' : 's'}`
            return (
              <button
                key={i}
                className={`advc-hub-content-btn ${doneItems.has(i) ? 'is-done' : ''}`}
                onClick={() => openItem(item, i)}
              >
                <span className="advc-hub-content-icon">{item.type === 'dialogue' ? '💬' : '📖'}</span>
                <div className="advc-hub-content-info">
                  <span className="advc-hub-content-title">{title}</span>
                  <span className="advc-hub-content-meta">{meta}</span>
                </div>
                {doneItems.has(i) && <span className="advc-hub-check">✓</span>}
              </button>
            )
          })}

          {/* Complete / completed status */}
          {isComplete ? (
            <div className="advc-hub-complete-badge">⭐ Chapter Complete</div>
          ) : (phaseDone('dialogue') || !contentItems.some(c => c.type === 'dialogue')) &&
             (!contentItems.some(c => c.type === 'passage') || phaseDone('passage')) ? (
            <button className="advc-hub-complete-btn" onClick={onComplete}>
              ⭐ Complete Chapter
            </button>
          ) : null}
        </div>
      </div>

      {/* Vocab overlay — shown before entering a dialogue/passage that has section vocab */}
      {pendingItem && (
        <VocabOverlay vocab={pendingItem.vocab} language={language} onDismiss={dismissOverlay} />
      )}
    </div>
  )
}

// ── Vocab Overlay ──────────────────────────────────────────────────────────────
// Shown as a blurred-background overlay before a dialogue/passage, listing that
// section's vocab words. Dismissed by a single tap anywhere on the overlay.

function VocabOverlay({ vocab, language, onDismiss }) {
  return (
    <div className="advc-vocab-overlay" onClick={onDismiss}>
      <div className="advc-vocab-overlay-card" onClick={e => e.stopPropagation()}>
        <div className="advc-vocab-overlay-header">📚 Vocabulary</div>
        <div className="advc-vocab-overlay-list">
          {vocab.map((e, i) => (
            <div key={e.id ?? i} className="advc-vocab-overlay-item">
              <span className="advc-vocab-overlay-word">
                {e.entry}
                {e.reading && <span className="advc-vocab-overlay-reading"> {e.reading}</span>}
              </span>
              <span className="advc-vocab-overlay-trans">{e.translation?.[0]}</span>
              <SpeakButton text={e.entry} language={language} size="sm" />
            </div>
          ))}
        </div>
        <div className="advc-vocab-overlay-hint">tap to continue</div>
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
  const [contentItems, setContentItems] = useState([])  // ordered list: {type, data, sectionVocab}
  const [wordEntries, setWordEntries] = useState([])
  const [tsvMeta,     setTsvMeta]     = useState(null)
  const [surfaceForms, setSurfaceForms] = useState({})

  useEffect(() => {
    loadChapterJSON(chapter.number, language, chapter.campaignKey ?? 'A').then(data => {
      if (!data) return
      const { meta, sections } = data
      setTsvMeta(meta)
      // Build a single ordered list of content items (dialogues + passages interleaved
      // in the order they appear in the source TSV), each tagged with its own section's
      // vocab — resolved to full entry objects (word + translation) for the overlay.
      const byEntry = new Map(activeEntries.map(e => [e.entry, e]))
      const items = []
      for (const s of sections) {
        const sectionVocabEntries = (s.vocab ?? []).map(w => byEntry.get(w)).filter(Boolean)
        for (const dl of s.dialogues) items.push({ type: 'dialogue', data: dl, sectionVocab: sectionVocabEntries })
        // Group all passage blocks within a section into ONE combined reading item
        // (e.g. genuine excerpt + simplified version travel together as one entry,
        // not as separate clickable list rows).
        if (s.passages?.length) {
          items.push({
            type: 'passage',
            data: { title: s.title, parts: s.passages },
            sectionVocab: sectionVocabEntries,
          })
        }
      }
      setContentItems(items)
      // Merge surfaceForms from all sections
      const merged = {}
      for (const s of sections) {
        for (const [lang, pairs] of Object.entries(s.surfaceForms ?? {})) {
          merged[lang] = { ...(merged[lang] ?? {}), ...pairs }
        }
      }
      setSurfaceForms(merged)
      const allVocab = [...new Set(sections.flatMap(s => s.vocab))]
      if (allVocab.length) {
        setWordEntries(allVocab.map(w => byEntry.get(w)).filter(Boolean))
      }
    })
  }, [chapter.number, language, activeEntries])

  // Use TSV meta if available, fall back to campaign JSON fields
  const chapterTitle  = (tsvMeta?.chapterTitle ?? tsvMeta?.titles)?.[language] ?? (tsvMeta?.chapterTitle ?? tsvMeta?.titles)?.en ?? chapter.title ?? chapter.titleTranslation
  const chapterLevel  = tsvMeta?.level               ?? chapter.level
  const storyIntro    = tsvMeta?.storyIntro?.[language] ?? tsvMeta?.storyIntro?.en ?? chapter.storyIntro ?? ''

  // Phase step bar
  const phaseOrder = ['vocab', 'grammar', 'dialogue', 'passage', 'complete']
  const PHASE_LABELS = { vocab: '📚', grammar: '📐', dialogue: '💬', passage: '📖', complete: '⭐' }
  const currentIdx = phaseOrder.indexOf(currentPhase === 'complete' ? 'complete' : (currentPhase ?? 'vocab'))

  // Sub-phase view state lives here so the header can tell whether we're inside a
  // sub-phase (vocab/grammar/dialogue/passage) or at the chapter hub itself, and
  // adjust the single back button's label/action accordingly:
  //  - inside a sub-phase → "← Chapter" goes to the hub (direct parent)
  //  - at the hub          → "← Map" goes to the campaign list (the real onBack)
  const [activeView, setActiveView] = useState(null)
  const atHub = activeView === null

  return (
    <div className="advc-screen">
      <div className="advc-header">
        <button className="advc-back" onClick={atHub ? onBack : () => setActiveView(null)}>
          {atHub ? '← Map' : '← Chapter'}
        </button>
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
          chapter={chapter}
          chapterTitle={chapterTitle}
          chapterLevel={chapterLevel}
          storyIntro={storyIntro}
          storyIntroTranslation={tsvMeta?.storyIntro?.en ?? ''}
          wordEntries={wordEntries}
          contentItems={contentItems}
          language={language}
          lookup={lookup}
          scores={scores}
          surfaceForms={surfaceForms}
          showReading={showReading}
          currentPhase={currentPhase ?? 'vocab'}
          onPhaseAdvance={onPhaseAdvance}
          onComplete={onComplete}
          onBack={onBack}
          activeView={activeView}
          setActiveView={setActiveView}
        />
      </div>
    </div>
  )
}
