import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { srsPickDistinct } from '../engine/srs'
import { initEntries, buildSequence, getBoxCounts, recordCorrect as leitnerCorrect, recordWrong as leitnerWrong, recordMaster as leitnerMaster, getBox } from '../engine/leitner'
import { displayEntry } from '../engine/vocab'
import { getMnemonic, setMnemonic, getAllMnemonics } from '../engine/mnemonics'
import { buildLookup } from '../engine/reader'
import { TextWithLookup } from '../components/TextWithLookup'
import RubyText from '../components/RubyText'
import SpeakButton from '../components/SpeakButton'
import ReadingToggle from '../components/ReadingToggle'
import './Flashcard.css'

const SWIPE_THRESHOLD    =  60
const SWIPE_UP_THRESHOLD = -80
const SWIPE_DOWN_THRESHOLD = 80

export default function Flashcard() {
  const { activeEntries: allEntries, direction, showReading, scoreActions, scores, settings, setScreen, goBack, activeLanguage, loadedLists, selectedIds, getEntriesForGame, vocabLoading } = useApp()
  const { entries: activeEntries, isEmpty: levelEmpty } = getEntriesForGame('flashcard')
  const swipeSens = settings.flashcard.swipeSensitivity

  const language = useMemo(() => {
    if (activeLanguage) return activeLanguage
    const firstList = selectedIds.map(id => loadedLists[id]).find(Boolean)
    return firstList?.language ?? 'zh'
  }, [activeLanguage, selectedIds, loadedLists])

  const lookup = useMemo(() => buildLookup(activeEntries), [activeEntries])
  const SWIPE_THRESH    = SWIPE_THRESHOLD     / swipeSens
  const SWIPE_UP_THRESH = SWIPE_UP_THRESHOLD  * swipeSens
  const SWIPE_DN_THRESH = SWIPE_DOWN_THRESHOLD / swipeSens

  const [deck,       setDeck]       = useState([])
  const [deckIndex,  setDeckIndex]  = useState(0)
  const [detailOpen, setDetailOpen] = useState(false)
  const [boxCounts,  setBoxCounts]  = useState([0,0,0,0,0,0])

  // Flip state as a ref — direct DOM write, no React render cycle
  const flipRef      = useRef(null)   // ref to the fc-card-flip div
  const revealedRef  = useRef(false)  // current flip state (not React state)
  const [isRevealed, setIsRevealed] = useState(false)  // for conditional render only

  function setFlip(reveal, animate = true) {
    revealedRef.current = reveal
    setIsRevealed(reveal)             // trigger re-render only for detail pane show/hide
    const el = flipRef.current
    if (!el) return
    if (!animate) {
      el.style.transition = 'none'
      el.style.transform  = reveal ? 'rotateY(180deg)' : 'rotateY(0deg)'
      void el.offsetHeight             // force reflow
    } else {
      el.style.transition = 'transform 0.4s ease'
      el.style.transform  = reveal ? 'rotateY(180deg)' : 'rotateY(0deg)'
    }
  }
  const [swipeDir,   setSwipeDir]   = useState(null)
  const [animating,  setAnimating]  = useState(false)
  const [feedback,   setFeedback]   = useState(null)

  // Mnemonic edit state
  const [mnemonicText, setMnemonicText] = useState('')
  const [editingMnemonic, setEditingMnemonic] = useState(false)
  const mnemonicInputRef = useRef(null)

  // Touch tracking
  const touchStart  = useRef(null)
  const cardRef     = useRef(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const isDragging  = useRef(false)

  const entryIds = useMemo(() => activeEntries.map(e => e.id), [activeEntries])

  // Stable key — only rebuild deck when entry IDs actually change
  const entriesKey = entryIds.join(',')

  // Leitner: initialise entries and build sequence
  useEffect(() => {
    if (activeEntries.length === 0) return
    initEntries(activeEntries)
    setBoxCounts(getBoxCounts(entryIds))
    const seq = buildSequence(entryIds)
    // Map sequence back to entry objects
    const entryMap = new Map(activeEntries.map(e => [e.id, e]))
    const deck = seq.map(s => ({ entry: entryMap.get(s.id), box: s.box })).filter(s => s.entry)
    setDeck(deck)
    setDeckIndex(0)
    setFlip(false, false)
    setDetailOpen(false)
  }, [entriesKey])

  const currentItem  = deck[deckIndex] ?? null
  const currentEntry = currentItem?.entry ?? null
  const currentBox   = currentItem?.box ?? 1

  const [autoPlay,   setAutoPlay]   = useState(() => localStorage.getItem('fc-autoplay') === 'true')

  // Auto-play audio when card changes
  useEffect(() => {
    if (autoPlay && currentEntry) {
      const text = direction === 'entry->translation' ? currentEntry.entry : currentEntry.translation?.[0]
      if (text) {
        import('../engine/speech').then(({ speak }) => speak(text, language))
      }
    }
  }, [currentEntry?.id, autoPlay])

  function toggleAutoPlay() {
    const next = !autoPlay
    setAutoPlay(next)
    localStorage.setItem('fc-autoplay', String(next))
  }
  useEffect(() => {
    if (currentEntry) {
      setMnemonicText(getMnemonic(currentEntry.id))
      setEditingMnemonic(false)
    }
  }, [currentEntry?.id])

  // Focus mnemonic input when edit mode opens
  useEffect(() => {
    if (editingMnemonic) mnemonicInputRef.current?.focus()
  }, [editingMnemonic])

  function getPrompt(entry) {
    if (!entry) return { main: '', sub: null }
    if (direction === 'entry->translation') {
      return { main: displayEntry(entry, language), sub: showReading && entry.reading ? entry.reading : null }
    } else {
      return { main: entry.translation[0], sub: null }
    }
  }

  function getAnswer(entry) {
    if (!entry) return ''
    return direction === 'entry->translation' ? entry.translation[0] : displayEntry(entry, language)
  }

  function advance(action) {
    if (animating || !currentEntry) return
    setAnimating(true)

    if (action === 'known')   leitnerCorrect(currentEntry.id, entryIds)
    if (action === 'unknown') leitnerWrong(currentEntry.id)
    if (action === 'master')  leitnerMaster(currentEntry.id, entryIds)
    // Keep legacy SRS in sync for other games
    if (action === 'known')   scoreActions.correct(currentEntry.id, 'flashcard')
    if (action === 'unknown') scoreActions.wrong(currentEntry.id, 'flashcard')
    if (action === 'master')  scoreActions.master(currentEntry.id)
    setBoxCounts(getBoxCounts(entryIds))

    setSwipeDir(action === 'unknown' ? 'left' : action === 'known' ? 'right' : 'up')

    setTimeout(() => {
      const nextIndex = deckIndex + 1
      if (nextIndex >= deck.length) {
        setDeck(buildDeck())
        setDeckIndex(0)
      } else {
        setDeckIndex(nextIndex)
      }
      setFlip(false, false)   // instant, no animation — new card starts face-up
      setDetailOpen(false)
      setSwipeDir(null)
      setDragOffset({ x: 0, y: 0 })
      setAnimating(false)
      setFeedback(null)
    }, 350)
  }

  function saveMnemonic() {
    if (!currentEntry) return
    setMnemonic(currentEntry.id, mnemonicText)
    setEditingMnemonic(false)
  }

  // ── Touch handlers ────────────────────────────────────────────────────────
  function onPointerDown(e) {
    if (animating || detailOpen) return
    touchStart.current = { x: e.clientX, y: e.clientY }
    isDragging.current = true
    cardRef.current?.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e) {
    if (!isDragging.current || !touchStart.current) return
    const dx = e.clientX - touchStart.current.x
    const dy = e.clientY - touchStart.current.y
    setDragOffset({ x: dx, y: dy })
  }

  function onPointerUp(e) {
    if (!isDragging.current) return
    isDragging.current = false
    const dx = dragOffset.x
    const dy = dragOffset.y

    // Swipe up → master (no reveal required — fast pruning)
    if (dy < SWIPE_UP_THRESH && Math.abs(dx) < Math.abs(dy)) {
      advance('master')
    // Swipe down → open detail panel
    } else if (dy > SWIPE_DN_THRESH && Math.abs(dx) < Math.abs(dy)) {
      setDetailOpen(true)
      setDragOffset({ x: 0, y: 0 })
    // Swipe left/right → unknown/known (always allowed)
    } else if (Math.abs(dx) > SWIPE_THRESH) {
      advance(dx > 0 ? 'known' : 'unknown')
    } else {
      // Tap — toggle reveal
      setFlip(!revealedRef.current)
      setDragOffset({ x: 0, y: 0 })
    }
  }

  // ── Keyboard handler ──────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if (animating) return
      if (editingMnemonic) return
      if (e.key === 'Escape') { if (detailOpen) setDetailOpen(false); else goBack(); return }

      if (e.key === ' ' || e.key === 'Enter') {
        setFlip(!revealedRef.current); return
      }
      if (e.key === 'ArrowDown') { setDetailOpen(true); return }
      if (e.key === 'ArrowUp')    { advance('master'); return }
      if (e.key === 'ArrowRight') advance('known')
      if (e.key === 'ArrowLeft')  advance('unknown')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [animating, currentEntry, deckIndex, deck, detailOpen, editingMnemonic])

  if (!currentEntry) return <div className="fc-empty">{vocabLoading ? 'Loading…' : 'No words loaded.'}</div>

  const prompt  = getPrompt(currentEntry)
  const answer  = getAnswer(currentEntry)
  const score   = scores[currentEntry?.id]?.flashcard?.score ?? 0

  // Card translate — pure horizontal or vertical only (no diagonal)
  let cardStyle = {}
  if (swipeDir === 'left')       cardStyle = { transform: 'translateX(-120vw)', transition: 'transform 0.3s ease' }
  else if (swipeDir === 'right') cardStyle = { transform: 'translateX(120vw)',  transition: 'transform 0.3s ease' }
  else if (swipeDir === 'up')    cardStyle = { transform: 'translateY(-120vh)', transition: 'transform 0.3s ease' }
  else if (isDragging.current || dragOffset.x !== 0 || dragOffset.y !== 0) {
    // Lock to dominant axis only
    const ax = Math.abs(dragOffset.x), ay = Math.abs(dragOffset.y)
    if (ax > ay) cardStyle = { transform: `translateX(${dragOffset.x}px)` }
    else         cardStyle = { transform: `translateY(${dragOffset.y}px)` }
  }

  const knownOpacity   = Math.max(0, Math.min(1,  dragOffset.x / SWIPE_THRESH))
  const unknownOpacity = Math.max(0, Math.min(1, -dragOffset.x / SWIPE_THRESH))
  const masterOpacity  = Math.max(0, Math.min(1, -dragOffset.y / Math.abs(SWIPE_UP_THRESH)))
  const detailOpacity  = Math.max(0, Math.min(1,  dragOffset.y / SWIPE_DN_THRESH))

  const savedMnemonic  = getMnemonic(currentEntry.id)
  const mnemonicRecord = getAllMnemonics()[currentEntry.id]
  const isSeeded       = mnemonicRecord?.seeded ?? false
  const allTranslations = currentEntry.translation ?? []

  return (
    <div className="fc-screen">
      <div className="fc-header">
        <button className="fc-back" onClick={goBack}>← Back</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button className="fc-gear" onClick={() => setScreen('settings')} title="Settings">⚙️</button>
          <span className="fc-progress">{deckIndex + 1} / {deck.length} · B{currentBox}</span>
        </div>
      </div>

      {levelEmpty && (
        <div className="level-warning">
          ⚠ <strong>No entries at selected level</strong> — showing all levels instead. Change in Settings.
        </div>
      )}

      {/* Leitner box display */}
      <div className="fc-leitner-bar">
        {[0,1,2,3,4,5].map(b => (
          <div key={b} className={`fc-leitner-box ${currentBox === b ? 'active' : ''} ${b === 0 ? 'box-unseen' : b === 5 ? 'box-mastered' : ''}`}>
            <span className="fc-leitner-label">{b === 0 ? '○' : b === 5 ? '★' : `B${b}`}</span>
            <span className="fc-leitner-count">{boxCounts[b] ?? 0}</span>
          </div>
        ))}
      </div>

      {/* Card area */}
      <div className="fc-stage">
        {/* Swipe hints — outside 3D card, relative to stage */}
        <div className="fc-hint fc-hint-known"   style={{ opacity: knownOpacity }}>✓ Known</div>
        <div className="fc-hint fc-hint-unknown"  style={{ opacity: unknownOpacity }}>✗ Unknown</div>
        <div className="fc-hint fc-hint-master"   style={{ opacity: masterOpacity }}>⭐ Master</div>
        <div className="fc-hint fc-hint-detail"   style={{ opacity: detailOpacity }}>ℹ Detail</div>

        <div
          ref={cardRef}
          className="fc-card"
          style={cardStyle}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {/* Flip container — transform driven by flipRef directly, not React state */}
          <div ref={flipRef} className="fc-card-flip" style={{ transform: 'rotateY(0deg)', transformStyle: 'preserve-3d', width: '100%', height: '100%', position: 'relative' }}>
          <div className="fc-card-face fc-card-front">
            <div className="fc-card-inner">
              <div className="fc-prompt-side">
                <RubyText text={prompt.main} reading={prompt.sub} visible={!!prompt.sub} size="lg" />
              </div>
            </div>
            <div className="fc-score-dots">
              {[1,2,3,4,5].map(i => (
                <span key={i} className={`fc-dot ${i <= score ? 'filled' : ''}`} />
              ))}
            </div>
            {savedMnemonic && masterOpacity > 0.05 && (
              <div className="fc-mnemonic-peek" style={{ opacity: masterOpacity }}>💡 {savedMnemonic}</div>
            )}
          </div>

          {/* Back face — answer */}
          <div className="fc-card-face fc-card-back">
            <div className="fc-card-inner">
              <div className="fc-prompt-side">
                <RubyText text={prompt.main} reading={prompt.sub} visible={!!prompt.sub} size="md" />
              </div>
              <div className="fc-answer-side">
                <div className="fc-divider" />
                <RubyText
                  text={answer}
                  reading={direction === 'translation->entry' && showReading ? currentEntry.reading : null}
                  visible={showReading}
                  size="lg"
                />
              </div>
            </div>
            <div className="fc-score-dots">
              {[1,2,3,4,5].map(i => (
                <span key={i} className={`fc-dot ${i <= score ? 'filled' : ''}`} />
              ))}
            </div>
          </div>
          </div>  {/* end fc-card-flip */}
        </div>
      </div>

      {/* Action buttons — always visible */}
      {!animating && !detailOpen && (
        <>
          <div className="fc-speak-row">
            <SpeakButton
              text={currentEntry.entry}
              language={language}
              size="md"
            />
            <button
              className={`fc-autoplay-btn ${autoPlay ? 'active' : ''}`}
              onClick={toggleAutoPlay}
              title="Auto-play audio"
            >
              {autoPlay ? '🔊 Auto' : '🔇 Auto'}
            </button>
          </div>
          <div className="fc-actions">
            <button className="fc-btn fc-btn-unknown" onClick={() => advance('unknown')}>✗<span>Unknown</span></button>
            <button className="fc-btn fc-btn-master"  onClick={() => advance('master')}>⭐<span>Master</span></button>
            <button className="fc-btn fc-btn-known"   onClick={() => advance('known')}>✓<span>Known</span></button>
          </div>
        </>
      )}

      {!detailOpen && (
        <div className="fc-keyboard-hint">
          <span className="fc-hint-tap">{isRevealed ? 'Tap · Space to hide' : 'Tap · Space to reveal'}</span>
          <span>← Unknown · → Known · ↑ Master · ↓ Detail</span>
        </div>
      )}

      {/* ── Detail panel ── */}
      {detailOpen && (
        <div className="fc-detail-overlay" onClick={e => { if (e.target === e.currentTarget) setDetailOpen(false) }}>
          <div className="fc-detail-panel">
            <div className="fc-detail-header">
              <RubyText
                text={currentEntry.entry}
                reading={currentEntry.reading}
                visible={showReading}
                size="md"
              />
              <button className="fc-detail-close" onClick={() => setDetailOpen(false)}>✕</button>
            </div>

            {/* All translations */}
            <div className="fc-detail-section">
              <span className="fc-detail-label">Translations</span>
              <div className="fc-detail-translations">
                {allTranslations.map((t, i) => (
                  <span key={i} className="fc-detail-trans-item">{t}</span>
                ))}
              </div>
            </div>

            {/* POS + level */}
            {(currentEntry.pos || currentEntry.level) && (
              <div className="fc-detail-section fc-detail-meta">
                {currentEntry.pos   && <span className="fc-detail-pos">{currentEntry.pos}</span>}
                {currentEntry.level && <span className="fc-detail-level">{currentEntry.level}</span>}
              </div>
            )}

            {/* Mnemonic */}
            <div className="fc-detail-section">
              <div className="fc-detail-mnemonic-header">
                <span className="fc-detail-label">
                  💡 Mnemonic
                  {isSeeded && <span className="fc-mnemonic-seeded-badge">starter</span>}
                </span>
                {!editingMnemonic && (
                  <button className="fc-detail-edit-btn" onClick={() => setEditingMnemonic(true)}>
                    {savedMnemonic ? (isSeeded ? 'Replace' : 'Edit') : '+ Add'}
                  </button>
                )}
              </div>

              {editingMnemonic ? (
                <div className="fc-mnemonic-edit">
                  <textarea
                    ref={mnemonicInputRef}
                    className="fc-mnemonic-input"
                    value={mnemonicText}
                    onChange={e => setMnemonicText(e.target.value)}
                    placeholder="Write a memory hook for this word…"
                    rows={3}
                  />
                  <div className="fc-mnemonic-actions">
                    <button className="fc-mnemonic-save" onClick={saveMnemonic}>Save</button>
                    <button className="fc-mnemonic-cancel" onClick={() => {
                      setMnemonicText(getMnemonic(currentEntry.id))
                      setEditingMnemonic(false)
                    }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="fc-mnemonic-text">
                  {savedMnemonic
                    ? <TextWithLookup text={savedMnemonic} language={language} lookup={lookup} scores={scores} showReading={showReading} noHighlight />
                    : <span className="fc-mnemonic-empty">No further details yet. Add a mnemonic to help remember this word.</span>
                  }
                </div>
              )}
            </div>

            {/* Action buttons inside detail */}
            {isRevealed && (
              <div className="fc-detail-actions">
                <button className="fc-btn fc-btn-unknown" onClick={() => { setDetailOpen(false); advance('unknown') }}>
                  ✗<span>Unknown</span>
                </button>
                <button className="fc-btn fc-btn-master" onClick={() => { setDetailOpen(false); advance('master') }}>
                  ⭐<span>Master</span>
                </button>
                <button className="fc-btn fc-btn-known" onClick={() => { setDetailOpen(false); advance('known') }}>
                  ✓<span>Known</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
