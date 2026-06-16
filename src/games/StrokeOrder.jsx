import { useState, useEffect, useRef, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import HanziWriter from 'hanzi-writer'
import {
  initSession, getBoxCounts, getPassState,
  recordCorrect as leitnerCorrect,
  recordWrong   as leitnerWrong,
  recordMaster  as leitnerMaster,
  getBox,
} from '../engine/leitner'
import './StrokeOrder.css'

const CJK_RE = /[\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf]/
function isCJK(text)     { return text && CJK_RE.test(text) }
function getChars(entry) { return [...(entry?.entry ?? '')].filter(ch => CJK_RE.test(ch)) }

// ── 米字格 grid ───────────────────────────────────────────────────────────────

function MiziGrid({ size }) {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, size, size)
    ctx.strokeStyle = '#7a9ab5'
    ctx.lineWidth = 1
    ctx.strokeRect(0.5, 0.5, size - 1, size - 1)
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size)
    ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2)
    ctx.moveTo(0, 0);        ctx.lineTo(size, size)
    ctx.moveTo(size, 0);     ctx.lineTo(0, size)
    ctx.stroke()
    ctx.setLineDash([])
  }, [size])
  return (
    <canvas
      ref={ref} width={size} height={size}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', borderRadius: 12 }}
    />
  )
}

// ── Single character writer ───────────────────────────────────────────────────

function CharWriter({ char, showOutline, showHanzi, showGrid, size = 260, onComplete, onWrong }) {
  const containerRef = useRef(null)
  const writerRef    = useRef(null)
  const [phase, setPhase] = useState('idle')

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
      showOutline:            showOutline,
      outlineColor:           '#d8d8d8',
      strokeColor:            '#222',
      radicalColor:           '#4f7ef8',
      highlightColor:         '#4f7ef8',
      drawingColor:           '#1a1a2e',
      drawingWidth:           10,
      strokeAnimationSpeed:   1,
      delayBetweenStrokes:    150,
      showHintAfterMisses:    2,
      leniency:               1.2,
      onLoadCharDataError:    () => setPhase('error'),
    })

    writer.quiz({
      onMistake:       () => onWrong?.(),
      onCorrectStroke: () => {},
      onComplete:      () => { setPhase('done'); onComplete?.() },
    })
    setPhase('quiz')
    writerRef.current = writer
    return () => { try { writer.cancelQuiz(); writer.cancelAnimation() } catch {} }
  }, [char, size, showOutline])

  return (
    <div className="so-char-row">
      <div className="so-glyph-slot">
        {showHanzi && <div className="so-char-glyph">{char}</div>}
      </div>
      <div className="so-char-block">
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <div ref={containerRef} className="so-canvas" style={{ width: size, height: size }} />
          {showGrid && <MiziGrid size={size} />}
        </div>
        {phase === 'error' && <div className="so-error">No data for "{char}"</div>}
        {phase === 'done'  && <div className="so-char-done">✓</div>}
      </div>
    </div>
  )
}

// ── Practice card — one entry ─────────────────────────────────────────────────

function PracticeCard({ entry, entryIds, showHanzi, showGrid, onToggleHanzi, onToggleGrid, onAdvance }) {
  if (!entry) return null
  const box         = getBox(entry.id, 'stroke')
  const showOutline = box <= 1
  const chars       = getChars(entry)

  const [doneChars, setDoneChars] = useState(new Set())
  const [mistaken,  setMistaken]  = useState(false)
  const charRefs  = useRef([])
  const resultRef = useRef(null)

  const allDone    = chars.length > 0 && doneChars.size >= chars.length
  const activeChar = chars.findIndex((_, i) => !doneChars.has(i))

  useEffect(() => {
    if (allDone) {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } else if (activeChar >= 0 && charRefs.current[activeChar]) {
      charRefs.current[activeChar].scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [doneChars, allDone, activeChar])

  function handleResult(correct) {
    if (correct) leitnerCorrect(entry.id, entryIds, 'stroke')
    else         leitnerWrong(entry.id, entryIds, 'stroke')
    onAdvance()
  }

  return (
    <div className="so-practice">
      <div className="so-practice-header">
        <div className="so-practice-title">
          <span className="so-practice-word">{entry.translation?.[0] ?? entry.entry}</span>
        </div>
        <div className="so-toggles">
          <button className={`so-toggle ${showHanzi ? 'active' : ''}`} onClick={onToggleHanzi}>字</button>
          <button className={`so-toggle ${showGrid  ? 'active' : ''}`} onClick={onToggleGrid}>⊞</button>
        </div>
      </div>

      <div className="so-outline-hint">
        {showOutline ? '📝 Outline visible — trace the strokes' : '🧠 No outline — write from memory'}
      </div>

      <div className="so-chars-grid">
        {chars.map((ch, i) => (
          <div key={`${ch}-${i}`} ref={el => charRefs.current[i] = el}>
            <CharWriter
              char={ch} showOutline={showOutline}
              showHanzi={showHanzi} showGrid={showGrid} size={260}
              onComplete={() => setDoneChars(prev => new Set([...prev, i]))}
              onWrong={() => setMistaken(true)}
            />
          </div>
        ))}
      </div>

      {allDone && (
        <div className="so-result-row" ref={resultRef}>
          {mistaken ? (
            <>
              <p className="so-result-msg">Some mistakes — back to box 1</p>
              <button className="so-result-btn so-result-btn--wrong" onClick={() => handleResult(false)}>✗ Got it wrong</button>
            </>
          ) : (
            <>
              <p className="so-result-msg">All strokes correct!</p>
              <button className="so-result-btn so-result-btn--correct" onClick={() => handleResult(true)}>✓ Got it right</button>
            </>
          )}
          <button className="so-result-btn so-result-btn--master"
            onClick={() => { leitnerMaster(entry.id, entryIds, 'stroke'); onAdvance() }}>⭐ Master</button>
        </div>
      )}
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function StrokeOrder() {
  const { goBack, getEntriesForGame } = useApp()
  const { entries: activeEntries } = getEntriesForGame('stroke-order')

  const cjkEntries = useMemo(() => activeEntries.filter(e => isCJK(e.entry)), [activeEntries])
  const entryIds   = useMemo(() => cjkEntries.map(e => e.id), [cjkEntries])

  const [boxCounts,  setBoxCounts]  = useState([0,0,0,0,0,0])
  const [passState,  setPassState]  = useState({ b1PassCount:0, currentPass:1, passDone:0, passTotal:0, barFills:{1:0,2:0,3:0,4:0} })
  const [deck,       setDeck]       = useState([])   // [{entry, box}]
  const [deckIndex,  setDeckIndex]  = useState(0)
  const [showHanzi,  setShowHanzi]  = useState(true)
  const [showGrid,   setShowGrid]   = useState(true)

  const entriesKey = entryIds.join(',')

  function refreshState() {
    setBoxCounts(getBoxCounts(entryIds, 'stroke'))
    setPassState(getPassState('stroke'))
  }

  // Init session and build deck from pass queue
  useEffect(() => {
    if (cjkEntries.length === 0) return
    initSession(cjkEntries, 'stroke')
    const entryMap = new Map(cjkEntries.map(e => [e.id, e]))
    const ps = getPassState('stroke')
    setPassState(ps)
    setBoxCounts(getBoxCounts(entryIds, 'stroke'))
    const d = (ps.passQueue ?? [])
      .map(id => ({ entry: entryMap.get(id), box: ps.currentPass }))
      .filter(s => s.entry)
    setDeck(d)
    setDeckIndex(0)
  }, [entriesKey])

  function handleAdvance() {
    refreshState()
    const nextIndex = deckIndex + 1
    if (nextIndex >= deck.length) {
      // Pass complete — rebuild from new pass queue
      const ps = getPassState('stroke')
      const entryMap = new Map(cjkEntries.map(e => [e.id, e]))
      const newDeck = (ps.passQueue ?? [])
        .map(id => ({ entry: entryMap.get(id), box: ps.currentPass }))
        .filter(s => s.entry)
      setDeck(newDeck)
      setDeckIndex(0)
    } else {
      setDeckIndex(nextIndex)
    }
  }

  const currentItem  = deck[deckIndex] ?? null
  const currentEntry = currentItem?.entry ?? null
  const currentBox   = passState.currentPass

  return (
    <div className="so-screen">
      {/* Header */}
      <div className="so-header">
        <button className="so-back" onClick={goBack}>← Back</button>
        <span className="so-title">Stroke Order</span>
        <span className="so-progress">{deck.length > 0 ? `${deckIndex + 1} / ${deck.length}` : ''}</span>
      </div>

      {/* Leitner box bar — mirrors Flashcard */}
      <div className="so-leitner-bar">
        {[0,1,2,3,4,5].map(b => (
          <div key={b} className={`so-leitner-box ${currentBox === b ? 'active' : ''} ${b === 0 ? 'box-unseen' : b === 5 ? 'box-mastered' : ''}`}>
            <span className="so-leitner-label">{b === 0 ? '○' : b === 5 ? '★' : `B${b}`}</span>
            <span className="so-leitner-count">{boxCounts[b] ?? 0}</span>
            {b >= 1 && b <= 4 && (
              <div className="so-leitner-progress">
                <div className="so-leitner-fill" style={{ width: `${((passState.barFills?.[b] ?? 0) * 100).toFixed(1)}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Content */}
      {cjkEntries.length === 0 ? (
        <div className="so-empty">Stroke order requires Chinese or Japanese.<br/>Switch language to use this tool.</div>
      ) : !currentEntry ? (
        <div className="so-empty">No cards in queue.<br/>All done! ⭐</div>
      ) : (
        <div className="so-scroll">
          <PracticeCard
            key={currentEntry.id + '-' + deckIndex}
            entry={currentEntry}
            entryIds={entryIds}
            showHanzi={showHanzi}
            showGrid={showGrid}
            onToggleHanzi={() => setShowHanzi(v => !v)}
            onToggleGrid={() => setShowGrid(v => !v)}
            onAdvance={handleAdvance}
          />
        </div>
      )}
    </div>
  )
}
