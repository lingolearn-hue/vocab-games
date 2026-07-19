import { useState, useEffect, useRef, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { buildLookup } from '../engine/reader'
import { TextWithLookup } from '../components/TextWithLookup'
import HelpButton from '../components/HelpButton'
import './Dialogue.css'

async function loadDialogues(languageId) {
  try {
    const res = await fetch(`./dialogues/${languageId}-en.json`)
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

// Assign a color per speaker index
const BUBBLE_COLORS = ['#4f7ef8', '#22a06b', '#e05cb0', '#f0a500', '#8b5cf6', '#e5534b']
function speakerColor(idx) { return BUBBLE_COLORS[idx % BUBBLE_COLORS.length] }

// ── Filter chips ───────────────────────────────────────────────────────────

const TAG_LABELS = {
  observe: 'Read & Answer', choice: 'Take Part',
  beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced',
  shopping: 'Shopping', social: 'Social', food: 'Food', cafe: 'Café',
  navigation: 'Directions', city: 'City', housing: 'Housing', work: 'Work',
  negotiation: 'Negotiation', technology: 'Technology', society: 'Society',
  environment: 'Environment',
}
const TAG_GROUPS = [
  { label: 'Type',   tags: ['observe', 'choice'] },
  { label: 'Level',  tags: ['beginner', 'intermediate', 'advanced'] },
  { label: 'Topic',  tags: ['shopping', 'social', 'food', 'cafe', 'navigation', 'city', 'housing', 'work', 'negotiation', 'technology', 'society', 'environment'] },
]

function FilterChips({ allTags, activeTags, onToggle, onClear }) {
  return (
    <div className="dl-filter-bar">
      {TAG_GROUPS.map(group => {
        const available = group.tags.filter(t => allTags.has(t))
        if (!available.length) return null
        return (
          <div key={group.label} className="dl-filter-group">
            <span className="dl-filter-group-label">{group.label}</span>
            <div className="dl-filter-chips">
              {available.map(tag => (
                <button
                  key={tag}
                  className={`dl-chip ${activeTags.has(tag) ? 'active' : ''}`}
                  onClick={() => onToggle(tag)}
                >
                  {TAG_LABELS[tag] ?? tag}
                </button>
              ))}
            </div>
          </div>
        )
      })}
      {activeTags.size > 0 && (
        <button className="dl-chip-clear" onClick={onClear}>✕ Clear</button>
      )}
    </div>
  )
}

// ── Bubble ─────────────────────────────────────────────────────────────────

function Bubble({ turn, speakerIdx, isUser, showTranslation, language, lookup, scores, showReading }) {
  const color = speakerColor(speakerIdx)
  return (
    <div className={`dl-line ${isUser ? 'dl-line--user' : 'dl-line--other'}`}>
      {!isUser && <span className="dl-speaker" style={{ color }}>{turn.speaker}</span>}
      <div className="dl-bubble" style={{ '--bubble-color': color }}>
        <div className="dl-bubble-text">
          <TextWithLookup text={turn.text} language={language} lookup={lookup} scores={scores} showReading={showReading} />
        </div>
        {turn.translation && showTranslation && (
          <div className="dl-bubble-trans">{turn.translation}</div>
        )}
      </div>
    </div>
  )
}

// ── Question turn ──────────────────────────────────────────────────────────

function QuestionTurn({ turn, turnIdx, qState, onChoose, language, lookup, scores, showReading }) {
  const [showFeedback, setShowFeedback] = useState(false)
  const answered = !!qState

  if (answered) {
    const chosenOpt = turn.options[qState.chosen]
    return (
      <div className="dl-question dl-question--answered">
        <span className="dl-question-answered-label">{qState.correct ? '✓' : '✗'}</span>
        <button
          className={`dl-answered-text ${qState.correct ? 'correct' : 'wrong'}`}
          onClick={() => setShowFeedback(f => !f)}
        >
          {chosenOpt.text}
        </button>
        {showFeedback && chosenOpt.feedback && (
          <div className={`dl-feedback dl-feedback--${qState.correct ? 'correct' : 'wrong'}`}>
            <TextWithLookup text={chosenOpt.feedback} language={language} lookup={lookup} scores={scores} showReading={showReading} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="dl-question">
      <p className="dl-question-prompt">{turn.prompt}</p>
      <div className="dl-options">
        {turn.options.map((opt, oi) => (
          <button key={oi} className="dl-option dl-option--idle" onClick={() => onChoose(turnIdx, opt, oi)}>
            <span className="dl-option-num">{oi + 1}</span>
            <span className="dl-option-text">{opt.text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Choice turn (user participates) ───────────────────────────────────────

function ChoiceTurn({ turn, turnIdx, chosen, onChoose, showTranslation }) {
  if (chosen !== null) {
    const opt = turn.options[chosen]
    return (
      <div className="dl-choice-done">
        <div className="dl-line dl-line--user">
          <div className="dl-bubble dl-bubble--choice">
            <div className="dl-bubble-text">{opt.text}</div>
            {showTranslation && opt.translation && (
              <div className="dl-bubble-trans">{opt.translation}</div>
            )}
          </div>
        </div>
        {opt.response && (
          <div className="dl-choice-response">
            <span className="dl-choice-response-text">{opt.response}</span>
            {showTranslation && opt.responseTranslation && (
              <div className="dl-choice-response-trans">{opt.responseTranslation}</div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="dl-choice">
      <p className="dl-choice-prompt">
        {turn.prompt}
        {showTranslation && turn.promptTranslation && (
          <span className="dl-choice-prompt-trans"> — {turn.promptTranslation}</span>
        )}
      </p>
      <div className="dl-choice-options">
        {turn.options.map((opt, oi) => (
          <button key={oi} className="dl-choice-option" onClick={() => onChoose(turnIdx, oi)}>
            <span className="dl-choice-option-text">{opt.text}</span>
            {showTranslation && opt.translation && (
              <span className="dl-choice-option-trans">{opt.translation}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function Dialogue() {
  const { activeEntries, showReading, scores, goBack, activeLanguage, loadedLists, selectedIds } = useApp()

  const [dialogues,        setDialogues]        = useState([])
  const [loading,          setLoading]          = useState(true)
  const [activeTags,       setActiveTags]       = useState(new Set())
  const [activeDialogue,   setActiveDialogue]   = useState(null)
  const [turnIndex,        setTurnIndex]        = useState(0)
  const [questionState,    setQuestionState]    = useState({})  // { [idx]: { chosen, correct } }
  const [choiceState,      setChoiceState]      = useState({})  // { [idx]: chosenOptionIndex }
  const [correct,          setCorrect]          = useState(0)
  const [total,            setTotal]            = useState(0)
  const [showTranslations, setShowTranslations] = useState(false)
  const bodyRef = useRef(null)

  const language = useMemo(() => {
    if (activeLanguage) return activeLanguage
    const firstList = selectedIds.map(id => loadedLists[id]).find(Boolean)
    return firstList?.language ?? 'zh'
  }, [activeLanguage, selectedIds, loadedLists])

  const lookup = useMemo(() => buildLookup(activeEntries), [activeEntries])

  useEffect(() => {
    if (!activeLanguage) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch on language change
    setLoading(true)
    loadDialogues(activeLanguage).then(data => {
      setDialogues(data?.dialogues ?? [])
      setLoading(false)
    })
  }, [activeLanguage])

  // Auto-scroll to bottom when turns reveal
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [turnIndex, questionState, choiceState])

  // Auto-advance past 'line' turns — pause briefly between lines for readability
  useEffect(() => {
    if (!activeDialogue) return
    const turn = activeDialogue.turns[turnIndex]
    if (!turn || turn.type !== 'line') return
    const isLast = turnIndex >= activeDialogue.turns.length - 1
    if (isLast) return
    const t = setTimeout(() => {
      setTurnIndex(i => i + 1)
    }, 600)   // 600ms between consecutive lines
    return () => clearTimeout(t)
  }, [turnIndex, activeDialogue])

  // All tags present in loaded dialogues
  const allTags = useMemo(() => {
    const s = new Set()
    dialogues.forEach(d => (d.tags ?? []).forEach(t => s.add(t)))
    return s
  }, [dialogues])

  // Filtered dialogues
  const filteredDialogues = useMemo(() => {
    if (activeTags.size === 0) return dialogues
    return dialogues.filter(d => (d.tags ?? []).some(t => activeTags.has(t)))
  }, [dialogues, activeTags])

  function toggleTag(tag) {
    setActiveTags(prev => {
      const next = new Set(prev)
      next.has(tag) ? next.delete(tag) : next.add(tag)
      return next
    })
  }

  // Speaker → index map for colors
  const speakerMap = useMemo(() => {
    if (!activeDialogue) return {}
    const speakers = [...new Set(activeDialogue.turns.filter(t => t.type === 'line').map(t => t.speaker))]
    const map = {}
    speakers.forEach((s, i) => { map[s] = i })
    return map
  }, [activeDialogue])

  // The "user" speaker is identified as the second unique speaker in choice dialogues
  const userSpeaker = useMemo(() => {
    if (!activeDialogue || activeDialogue.type !== 'choice') return null
    const speakers = [...new Set(activeDialogue.turns.filter(t => t.type === 'line').map(t => t.speaker))]
    return speakers[1] ?? null
  }, [activeDialogue])

  function openDialogue(d) {
    setActiveDialogue(d)
    setTurnIndex(0)       // start at first turn, reveal progressively
    setQuestionState({})
    setChoiceState({})
    setCorrect(0)
    setTotal(0)
    setShowTranslations(false)
  }

  function chooseOption(turnIdx, opt, optionIndex) {
    if (questionState[turnIdx]) return
    const isCorrect = opt.correct
    setQuestionState(prev => ({ ...prev, [turnIdx]: { chosen: optionIndex, correct: isCorrect } }))
    setTotal(t => t + 1)
    if (isCorrect) setCorrect(c => c + 1)
    // Advance to next turn after answering
    setTurnIndex(i => Math.min(activeDialogue.turns.length - 1, Math.max(i, turnIdx + 1)))
  }

  function chooseDialogueOption(turnIdx, optionIndex) {
    if (choiceState[turnIdx] !== undefined) return
    setChoiceState(prev => ({ ...prev, [turnIdx]: optionIndex }))
    // Advance to next turn after choosing
    setTurnIndex(i => Math.min(activeDialogue.turns.length - 1, Math.max(i, turnIdx + 1)))
  }

  // Check if all interactive turns are done
  const allDone = useMemo(() => {
    if (!activeDialogue) return false
    return activeDialogue.turns.every((turn, idx) => {
      if (turn.type === 'question') return !!questionState[idx]
      if (turn.type === 'choice')   return choiceState[idx] !== undefined
      return true
    })
  }, [activeDialogue, questionState, choiceState])

  const accuracy = total > 0 ? Math.round((correct / total) * 100) : null

  // ── List view ──────────────────────────────────────────────────────────────
  if (!activeDialogue) {
    return (
      <div className="dl-screen">
        <div className="dl-header">
          <button className="dl-back" onClick={goBack}>← Back</button>
          <span className="dl-title">Dialogue</span>
          <HelpButton
            title="Dialogue"
            description="Follow a conversation turn by turn — tap to continue, answer questions along the way, and toggle EN per line for a translation."
          />
        </div>
        {!loading && allTags.size > 0 && (
          <FilterChips allTags={allTags} activeTags={activeTags} onToggle={toggleTag} onClear={() => setActiveTags(new Set())} />
        )}
        <div className="dl-body">
          {loading ? (
            <div className="dl-empty">Loading…</div>
          ) : filteredDialogues.length === 0 ? (
            <div className="dl-empty">
              {activeTags.size > 0 ? 'No dialogues match the filters.' : activeLanguage ? 'No dialogues available for this language yet.' : 'Select a language on the home screen first.'}
            </div>
          ) : (
            <div className="dl-list">
              {filteredDialogues.map(d => {
                const qCount = d.turns.filter(t => t.type === 'question').length
                const isChoice = d.type === 'choice'
                return (
                  <button key={d.id} className="dl-card" onClick={() => openDialogue(d)}>
                    <div className="dl-card-top">
                      <span className="dl-card-title">{d.title}</span>
                      <div className="dl-card-badges">
                        {d.level && <span className="dl-card-level">{d.level}</span>}
                        <span className={`dl-card-type ${isChoice ? 'choice' : 'observe'}`}>
                          {isChoice ? '💬 Take Part' : '👁 Read'}
                        </span>
                      </div>
                    </div>
                    {d.titleTranslation && <span className="dl-card-sub">{d.titleTranslation}</span>}
                    <span className="dl-card-meta">
                      {d.turns.filter(t => t.type === 'line').length} lines
                      {qCount > 0 && ` · ${qCount} question${qCount !== 1 ? 's' : ''}`}
                      {d.turns.some(t => t.type === 'choice') && ` · choices`}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Active dialogue view ───────────────────────────────────────────────────
  return (
    <div className="dl-screen">
      <div className="dl-header">
        <button className="dl-back" onClick={() => setActiveDialogue(null)}>← Back</button>
        <span className="dl-title dl-reading-title">{activeDialogue.title}</span>
        <div className="dl-score-wrap">
          <button className={`dl-trans-toggle ${showTranslations ? 'active' : ''}`}
            onClick={() => setShowTranslations(t => !t)} title="Show/hide translations">EN</button>
          {total > 0 && <span className="dl-acc">{accuracy}%</span>}
        </div>
        <HelpButton
          title="Dialogue"
          description="Follow a conversation turn by turn — tap to continue, answer questions along the way, and toggle EN per line for a translation."
        />
      </div>

      <div className="dl-body dl-reading-body" ref={bodyRef}>
        {activeDialogue.turns.slice(0, turnIndex + 1).map((turn, i) => {
          if (turn.type === 'line') {
            const idx = speakerMap[turn.speaker] ?? 0
            const isUser = turn.speaker === userSpeaker
            return (
              <Bubble key={i} turn={turn} speakerIdx={idx} isUser={isUser}
                showTranslation={showTranslations} language={language}
                lookup={lookup} scores={scores} showReading={showReading} />
            )
          }
          if (turn.type === 'question') {
            return (
              <QuestionTurn key={i} turn={turn} turnIdx={i}
                qState={questionState[i]} onChoose={chooseOption}
                language={language} lookup={lookup} scores={scores} showReading={showReading} />
            )
          }
          if (turn.type === 'choice') {
            return (
              <ChoiceTurn key={i} turn={turn} turnIdx={i}
                chosen={choiceState[i] ?? null}
                onChoose={chooseDialogueOption}
                showTranslation={showTranslations} />
            )
          }
          return null
        })}

        {allDone && (
          <div className="dl-finish">
            <div className="dl-finish-title">Finished!</div>
            {total > 0 && (
              <div className="dl-finish-stats">{correct} / {total} correct · {accuracy}%</div>
            )}
            <button className="dl-finish-btn" onClick={() => setActiveDialogue(null)}>Back to list</button>
          </div>
        )}
      </div>
    </div>
  )
}
