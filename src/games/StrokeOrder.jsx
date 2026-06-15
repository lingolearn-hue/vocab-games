import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import HanziWriter from 'hanzi-writer'
import {
  initEntries, buildSequence, getBoxCounts,
  recordCorrect as leitnerCorrect,
  recordWrong   as leitnerWrong,
  recordMaster  as leitnerMaster,
  getBox,
} from '../engine/leitner'
import './StrokeOrder.css'

const CJK_RE = /[\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf]/

function isCJK(text)    { return text && CJK_RE.test(text) }
function getChars(entry) {
  return [...(entry?.entry ?? '')].filter(ch => CJK_RE.test(ch))
}

// ── Single character writer ───────────────────────────────────────────────────

function CharWriter({ char, showOutline, size = 220, onComplete, onWrong }) {
  const containerRef = useRef(null)
  const writerRef    = useRef(null)
  const [phase, setPhase] = useState('idle')  // idle | quiz | done | error

  useEffect(() => {
    if (!containerRef.current || !char) return
    if (writerRef.current) {
      try { writerRef.current.cancelQuiz(); writerRef.current.cancelAnimation() } catch {}
      containerRef.current.innerHTML = ''
      writerRef.current = null
    }
    setPhase('idle')

    const writer = HanziWriter.create(containerRef.current, char, {
      width:                  size,
      height:                 size,
      padding:                16,
      // Box 1: faint outline visible. Box 2+: outline hidden.
      showOutline:            showOutline,
      outlineColor:           '#d8d8d8',
      strokeColor:            '#222',
      radicalColor:           '#4f7ef8',
      highlightColor:         '#4f7ef8',
      drawingColor:           '#4f7ef8',
      drawingWidth:           4,
      strokeAnimationSpeed:   1,
      delayBetweenStrokes:    150,
      // Quiz settings
      showHintAfterMisses:    3,
      acceptBackwardsStrokes: false,
      onLoadCharDataError:    () => setPhase('error'),
    })

    writerRef.current = writer
    return () => {
      try { writer.cancelQuiz(); writer.cancelAnimation() } catch {}
    }
  }, [char, size, showOutline])

  const startQuiz = useCallback(() => {
    if (!writerRef.current || phase === 'quiz') return
    setPhase('quiz')
    writerRef.current.quiz({
      onMistake:       () => onWrong?.(),
      onCorrectStroke: () => {},
      onComplete:      () => { setPhase('done'); onComplete?.() },
    })
  }, [phase, onComplete, onWrong])

  const animate = useCallback(() => {
    if (!writerRef.current || phase === 'quiz') return
    setPhase('idle')
    writerRef.current.cancelQuiz()
    writerRef.current.animateCharacter({ onComplete: () => setPhase('idle') })
  }, [phase])

  const reset = useCallback(() => {
    if (!writerRef.current) return
    writerRef.current.cancelQuiz()
    writerRef.current.showCharacter()
    setPhase('idle')
  }, [])

  return (
    <div className="so-char-block">
      <div className="so-char-label">{char}</div>
      <div ref={containerRef} className="so-canvas" style={{ width: size, height: size }} />
      {phase === 'error' ? (
        <div className="so-error">No data for "{char}"</div>
      ) : phase === 'done' ? (
        <div className="so-char-done">✓ Complete</div>
      ) : (
        <div className="so-char-controls">
          <button className="so-btn" onClick={animate} disabled={phase === 'quiz'}>▶ Show</button>
          <button className="so-btn so-btn--quiz" onClick={startQuiz} disabled={phase === 'quiz'}>✏️ Write</button>
          {phase === 'quiz' && (
            <button className="so-btn so-btn--reset" onClick={reset}>↺ Reset</button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Practice view — one entry, all its characters ─────────────────────────────

function PracticeView({ entry, entryIds, onBack, onAdvance }) {
  const box         = getBox(entry.id)
  const showOutline = box <= 1   // box 0 or 1: show outline
  const chars       = getChars(entry)

  // Track completion per character
  const [doneChars, setDoneChars] = useState(new Set())
  const [mistaken,  setMistaken]  = useState(false)

  const allDone = chars.length > 0 && doneChars.size >= chars.length

  function handleCharComplete(i) {
    setDoneChars(prev => new Set([...prev, i]))
  }

  function handleMistake() {
    setMistaken(true)
  }

  function handleResult(correct) {
    if (correct) leitnerCorrect(entry.id, entryIds)
    else         leitnerWrong(entry.id)
    onAdvance()
  }

  return (
    <div className="so-practice">
      <div className="so-practice-header">
        <button className="so-back-to-list" onClick={onBack}>← List</button>
        <div className="so-practice-title">
          <span className="so-practice-word">{entry.entry}</span>
          <span className="so-practice-trans">{entry.translation?.[0]}</span>
        </div>
        <span className="so-box-badge">B{box === 0 ? '1' : box}</span>
      </div>

      <div className="so-outline-hint">
        {showOutline
          ? '📝 Outline visible — trace the strokes in order'
          : '🧠 No outline — write from memory'}
      </div>

      <div className="so-chars-grid">
        {chars.map((ch, i) => (
          <CharWriter
            key={`${ch}-${i}`}
            char={ch}
            showOutline={showOutline}
            size={200}
            onComplete={() => handleCharComplete(i)}
            onWrong={handleMistake}
          />
        ))}
      </div>

      {allDone && (
        <div className="so-result-row">
          {mistaken ? (
            <>
              <p className="so-result-msg">Some mistakes — back to box 1</p>
              <button className="so-result-btn so-result-btn--wrong" onClick={() => handleResult(false)}>
                ✗ Got it wrong
              </button>
            </>
          ) : (
            <>
              <p className="so-result-msg">All strokes correct!</p>
              <button className="so-result-btn so-result-btn--correct" onClick={() => handleResult(true)}>
                ✓ Got it right
              </button>
            </>
          )}
          <button className="so-result-btn so-result-btn--master"
            onClick={() => { leitnerMaster(entry.id, entryIds); onAdvance() }}>
            ⭐ Master
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main StrokeOrder screen ───────────────────────────────────────────────────

export default function StrokeOrder() {
  const { activeEntries, goBack } = useApp()

  const cjkEntries = useMemo(() =>
    activeEntries.filter(e => isCJK(e.entry)),
    [activeEntries]
  )
  const entryIds = useMemo(() => cjkEntries.map(e => e.id), [cjkEntries])

  const [boxCounts,  setBoxCounts]  = useState([0,0,0,0,0,0])
  const [sequence,   setSequence]   = useState([])
  const [seqIndex,   setSeqIndex]   = useState(0)
  const [search,     setSearch]     = useState('')
  const [view,       setView]       = useState('list')  // 'list' | 'practice' | 'queue'
  const [activeEntry, setActiveEntry] = useState(null)

  // Initialise Leitner for CJK entries
  useEffect(() => {
    if (cjkEntries.length === 0) return
    initEntries(cjkEntries)
    setBoxCounts(getBoxCounts(entryIds))
    const seq = buildSequence(entryIds)
    const entryMap = new Map(cjkEntries.map(e => [e.id, e]))
    setSequence(seq.map(s => entryMap.get(s.id)).filter(Boolean))
    setSeqIndex(0)
  }, [entryIds.join(',')])

  function refreshCounts() {
    setBoxCounts(getBoxCounts(entryIds))
    const seq = buildSequence(entryIds)
    const entryMap = new Map(cjkEntries.map(e => [e.id, e]))
    setSequence(seq.map(s => entryMap.get(s.id)).filter(Boolean))
  }

  function openEntry(entry) {
    setActiveEntry(entry)
    setView('practice')
  }

  function handleAdvance() {
    refreshCounts()
    // Stay in queue mode — go to next in sequence
    if (view === 'queue') {
      const next = seqIndex + 1
      if (next < sequence.length) {
        setSeqIndex(next)
        setActiveEntry(sequence[next])
      } else {
        // Sequence done — rebuild
        refreshCounts()
        setSeqIndex(0)
        setView('list')
      }
    } else {
      setView('list')
      setActiveEntry(null)
    }
  }

  function startQueue() {
    if (sequence.length === 0) return
    setSeqIndex(0)
    setActiveEntry(sequence[0])
    setView('queue')
  }

  const filtered = search.trim()
    ? cjkEntries.filter(e =>
        e.entry.includes(search) ||
        e.translation?.some(t => t.toLowerCase().includes(search.toLowerCase()))
      ).slice(0, 40)
    : cjkEntries.slice(0, 40)

  const currentBox = activeEntry ? getBox(activeEntry.id) : null

  return (
    <div className="so-screen">
      {/* Header */}
      <div className="so-header">
        <button className="so-back" onClick={view === 'list' ? goBack : () => { setView('list'); setActiveEntry(null) }}>
          ← {view === 'list' ? 'Back' : 'List'}
        </button>
        <span className="so-title">Stroke Order</span>
      </div>

      {/* Leitner box bar */}
      <div className="so-leitner-bar">
        {[0,1,2,3,4,5].map(b => (
          <div key={b} className={`so-leitner-box ${currentBox === b ? 'active' : ''} ${b === 0 ? 'box-unseen' : b === 5 ? 'box-mastered' : ''}`}>
            <span className="so-leitner-label">{b === 0 ? '○' : b === 5 ? '★' : `B${b}`}</span>
            <span className="so-leitner-count">{boxCounts[b] ?? 0}</span>
          </div>
        ))}
      </div>

      {cjkEntries.length === 0 ? (
        <div className="so-empty">
          Stroke order requires Chinese or Japanese.<br/>Switch language to use this tool.
        </div>
      ) : view === 'practice' || view === 'queue' ? (
        <div className="so-scroll">
          <PracticeView
            entry={activeEntry}
            entryIds={entryIds}
            onBack={() => { setView('list'); setActiveEntry(null) }}
            onAdvance={handleAdvance}
          />
          {view === 'queue' && (
            <div className="so-queue-progress">
              {seqIndex + 1} / {sequence.length}
            </div>
          )}
        </div>
      ) : (
        <div className="so-scroll">
          {/* Start queue button */}
          {sequence.length > 0 && (
            <button className="so-queue-btn" onClick={startQueue}>
              ▶ Start Practice Queue ({sequence.length} cards)
            </button>
          )}

          {/* Search */}
          <div className="so-search-bar">
            <input
              className="so-search"
              placeholder="Search entries…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Entry list */}
          <div className="so-list">
            {filtered.map(entry => {
              const box = getBox(entry.id)
              return (
                <button
                  key={entry.id}
                  className="so-entry-row"
                  onClick={() => openEntry(entry)}
                >
                  <span className="so-entry-word">{entry.entry}</span>
                  <span className="so-entry-trans">{entry.translation?.[0] ?? ''}</span>
                  <span className={`so-entry-box so-entry-box--${box}`}>
                    {box === 0 ? '○' : box === 5 ? '★' : `B${box}`}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
