import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { srsPickDistinct } from '../engine/srs'
import { getMnemonic, setMnemonic, getAllMnemonics } from '../engine/mnemonics'
import { buildLookup } from '../engine/reader'
import { TextWithLookup } from '../components/TextWithLookup'
import RubyText from '../components/RubyText'
import ReadingToggle from '../components/ReadingToggle'
import './Flashcard.css'

const SWIPE_THRESHOLD    =  60
const SWIPE_UP_THRESHOLD = -80
const SWIPE_DOWN_THRESHOLD = 80

export default function Flashcard() {
  const { activeEntries: allEntries, direction, showReading, scoreActions, scores, settings, setScreen, activeLanguage, loadedLists, selectedIds, getEntriesForGame, vocabLoading } = useApp()
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
  const [revealed,   setRevealed]   = useState(false)
  const [noAnim,     setNoAnim]     = useState(true)
  const [detailOpen, setDetailOpen] = useState(false)
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

  const buildDeck = useCallback(() =>
    srsPickDistinct(activeEntries, activeEntries.length, 'flashcard')
  , [activeEntries])

  // Stable key — only rebuild deck when entry IDs actually change
  const entriesKey = activeEntries.map(e => e.id).join(',')

  useEffect(() => {
    if (activeEntries.length > 0) {
      setDeck(buildDeck())
      setDeckIndex(0)
      setRevealed(false)
      setDetailOpen(false)
      setNoAnim(true)
      requestAnimationFrame(() => setNoAnim(false))
    }
  }, [entriesKey])

  const currentEntry = deck[deckIndex] ?? null

  // Sync mnemonic text when entry changes
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
      return { main: entry.entry, sub: showReading && entry.reading ? entry.reading : null }
    } else {
      return { main: entry.translation[0], sub: null }
    }
  }

  function getAnswer(entry) {
    if (!entry) return ''
    return direction === 'entry->translation' ? entry.translation[0] : entry.entry
  }

  function advance(action) {
    if (animating || !currentEntry) return
    setAnimating(true)

    if (action === 'known')   scoreActions.correct(currentEntry.id, 'flashcard')
    if (action === 'unknown') scoreActions.wrong(currentEntry.id, 'flashcard')
    if (action === 'master')  scoreActions.master(currentEntry.id)

    setSwipeDir(action === 'unknown' ? 'left' : action === 'known' ? 'right' : 'up')

    setTimeout(() => {
      const nextIndex = deckIndex + 1
      if (nextIndex >= deck.length) {
        setDeck(buildDeck())
        setDeckIndex(0)
      } else {
        setDeckIndex(nextIndex)
      }
      setRevealed(false)
      setDetailOpen(false)
      setSwipeDir(null)
      setDragOffset({ x: 0, y: 0 })
      setAnimating(false)
      setFeedback(null)
      setNoAnim(true)
      // Re-enable flip animation after one frame so the new card never plays unflip
      requestAnimationFrame(() => setNoAnim(false))
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
      setRevealed(r => !r)
      setDragOffset({ x: 0, y: 0 })
    }
  }

  // ── Keyboard handler ──────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if (animating) return
      if (editingMnemonic) return
      if (e.key === 'Escape') { if (detailOpen) setDetailOpen(false); else setScreen('setup'); return }

      if (e.key === ' ' || e.key === 'Enter') {
        setRevealed(r => !r); return
      }
      if (e.key === 'ArrowDown') { setDetailOpen(true); return }
      if (e.key === 'ArrowUp')    { advance('master'); return }
      if (e.key === 'ArrowRight') advance('known')
      if (e.key === 'ArrowLeft')  advance('unknown')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [revealed, animating, currentEntry, deckIndex, deck, detailOpen, editingMnemonic])

  if (!currentEntry) return <div className="fc-empty">{vocabLoading ? 'Loading…' : 'No words loaded.'}</div>

  const prompt  = getPrompt(currentEntry)
  const answer  = getAnswer(currentEntry)
  const score   = scores[currentEntry.id]?.flashcard?.score ?? 0

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
        <button className="fc-back" onClick={() => setScreen('setup')}>← Back</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button className="fc-gear" onClick={() => setScreen('settings')} title="Settings">⚙️</button>
          <span className="fc-progress">{deckIndex + 1} / {deck.length}</span>
        </div>
      </div>

      {levelEmpty && (
        <div className="level-warning">
          ⚠ <strong>No entries at selected level</strong> — showing all levels instead. Change in Settings.
        </div>
      )}

      {/* Card area */}
      <div className="fc-stage">
        {/* Swipe hints — outside 3D card, relative to stage */}
        <div className="fc-hint fc-hint-known"   style={{ opacity: knownOpacity }}>✓ Known</div>
        <div className="fc-hint fc-hint-unknown"  style={{ opacity: unknownOpacity }}>✗ Unknown</div>
        <div className="fc-hint fc-hint-master"   style={{ opacity: masterOpacity }}>⭐ Master</div>
        <div className="fc-hint fc-hint-detail"   style={{ opacity: detailOpacity }}>ℹ Detail</div>

        <div
          ref={cardRef}
          className={`fc-card ${revealed ? 'revealed' : ''} ${noAnim ? 'no-anim' : ''}`}
          style={cardStyle}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {/* Front face — prompt */}
          <div className="fc-card-flip">
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
        <div className="fc-actions">
          <button className="fc-btn fc-btn-unknown" onClick={() => advance('unknown')}>✗<span>Unknown</span></button>
          <button className="fc-btn fc-btn-master"  onClick={() => advance('master')}>⭐<span>Master</span></button>
          <button className="fc-btn fc-btn-known"   onClick={() => advance('known')}>✓<span>Known</span></button>
        </div>
      )}

      {!detailOpen && (
        <div className="fc-keyboard-hint">
          <span className="fc-hint-tap">Tap · Space to {revealed ? 'hide' : 'reveal'}</span>
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
                    ? <TextWithLookup text={savedMnemonic} language={language} lookup={lookup} scores={scores} showReading={showReading} />
                    : <span className="fc-mnemonic-empty">No mnemonic yet. Add one to help remember this word.</span>
                  }
                </div>
              )}
            </div>

            {/* Action buttons inside detail */}
            {revealed && (
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
