import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { displayEntry } from '../engine/vocab'
import { resolveFacet } from '../engine/facets'
import {
  initSession, getBoxCounts, getPassState, openBox,
  recordCorrect as leitnerCorrect, recordWrong as leitnerWrong,
} from '../engine/leitner'
import RubyText from '../components/RubyText'
import ReadingToggle from '../components/ReadingToggle'
import DirectionToggle from '../components/DirectionToggle'
import ReadingOnlyToggle from '../components/ReadingOnlyToggle'
import FacetsByBoxToggle from '../components/FacetsByBoxToggle'
import HelpButton from '../components/HelpButton'
import LeitnerBar from '../components/LeitnerBar'
import './PairMatch.css'

// Truncate at first semicolon for display in tiles
function truncate(text) {
  if (!text) return text
  const idx = text.indexOf(';')
  return idx > 0 ? text.slice(0, idx).trim() : text
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

export default function PairMatch() {
  const { direction, showReading, readingOnly, facetsByBox, settings, goBack, getEntriesForGame, activeLanguage } = useApp()
  const { entries: activeEntries, isEmpty: levelEmpty } = getEntriesForGame('pairmatch')
  const ROUND_SIZE = settings.pairmatch.roundSize
  const isCJK = activeLanguage === 'zh' || activeLanguage === 'ja'

  const entryIds = useMemo(() => activeEntries.map(e => e.id), [activeEntries])
  const entryMap = useMemo(() => new Map(activeEntries.map(e => [e.id, e])), [activeEntries])

  const [leftItems,  setLeftItems]  = useState([])
  const [rightItems, setRightItems] = useState([])
  const [selectedLeft,  setSelectedLeft]  = useState(null)
  const [selectedRight, setSelectedRight] = useState(null)
  const [matched,   setMatched]   = useState(new Set())
  const [wrongPair, setWrongPair] = useState(null)
  const [roundsCompleted, setRoundsCompleted] = useState(0)
  const [totalCorrect,    setTotalCorrect]    = useState(0)
  const [roundSize, setRoundSize] = useState(0)
  const [samePosMode, setSamePosMode] = useState(false)  // when on, each round draws all cards from one POS type, filling remainder from other types if needed

  // Leitner box/pass state — same engine and per-game storage key ('pairmatch')
  // already used by Flashcard ('flashcard') and StrokeOrder ('stroke'), so scores
  // and box progress here are entirely separate from those games.
  const [boxCounts, setBoxCounts] = useState([0,0,0,0,0,0])
  const [passState, setPassState] = useState(() => ({ currentPass:0, passDone:0, passTotal:0, barFills:{0:0,1:0,2:0,3:0,4:0,5:0} }))

  function refreshLeitnerState() {
    setBoxCounts(getBoxCounts(entryIds, 'pairmatch'))
    setPassState(getPassState('pairmatch'))
  }

  function handleOpenBox(box) {
    const ps = openBox(box, 'pairmatch')
    if (!ps) return
    setPassState(ps)
    setBoxCounts(getBoxCounts(entryIds, 'pairmatch'))
    buildRound()
  }

  // Distinct POS tags present in the current (level-filtered) pool — used only to
  // decide whether "same type" mode is even offered/meaningful, not for manual selection.
  const availablePos = useMemo(
    () => [...new Set(activeEntries.map(e => e.pos).filter(Boolean))],
    [activeEntries]
  )

  function buildItemsFor(entries, box) {
    const n = entries.length
    setRoundSize(n)

    const facet = facetsByBox ? resolveFacet(box, activeLanguage) : null
    const effDirection   = facet ? facet.direction   : direction
    const effShowReading = facet ? facet.showReading : showReading
    const effReadingOnly = facet ? facet.readingOnly : readingOnly

    const entryLabel = (e) => (effReadingOnly && isCJK && e.reading) ? e.reading : displayEntry(e, activeLanguage)

    const lefts = entries.map(e => ({
      id: e.id,
      label: truncate(effDirection === 'entry->translation' ? entryLabel(e) : e.translation[0]),
      sub: effDirection === 'entry->translation' && effShowReading && !(effReadingOnly && isCJK && e.reading) ? e.reading : null,
    }))
    const rights = entries.map(e => ({
      id: e.id,
      label: truncate(effDirection === 'entry->translation' ? e.translation[0] : entryLabel(e)),
      sub: effDirection === 'translation->entry' && effShowReading && !(effReadingOnly && isCJK && e.reading) ? e.reading : null,
    }))

    setLeftItems(shuffle(lefts))
    setRightItems(shuffle(rights))
    setMatched(new Set())
    setSelectedLeft(null)
    setSelectedRight(null)
    setWrongPair(null)
  }

  // Build a round by drawing from the *current Leitner pass queue* — i.e. only
  // cards that are actually due right now, same box-driven order as Flashcard.
  const buildRound = useCallback(() => {
    const ps = getPassState('pairmatch')
    let queueEntries = (ps.passQueue ?? []).map(id => entryMap.get(id)).filter(Boolean)
    // In the rare case the queue is empty (e.g. a tiny pool with everything
    // mastered or already shown), fall back to the full pool so the game
    // never gets stuck on a frozen board.
    if (queueEntries.length === 0) queueEntries = activeEntries
    if (queueEntries.length === 0) return

    let entries
    if (samePosMode && availablePos.length > 1) {
      // Pick one POS type at random (from what's actually due) to feature this
      // round, draw as many as possible from it, then fill remaining slots
      // from the rest of the due queue so a round is never short of ROUND_SIZE.
      const duePosTags = [...new Set(queueEntries.map(e => e.pos).filter(Boolean))]
      const featuredPos = duePosTags.length > 0
        ? duePosTags[Math.floor(Math.random() * duePosTags.length)]
        : null
      const sameType  = featuredPos ? queueEntries.filter(e => e.pos === featuredPos) : []
      const otherType = featuredPos ? queueEntries.filter(e => e.pos !== featuredPos) : queueEntries

      const n = Math.min(ROUND_SIZE, queueEntries.length)
      const fromSame  = shuffle(sameType).slice(0, n)
      const fromOther = shuffle(otherType).slice(0, n - fromSame.length)
      entries = shuffle([...fromSame, ...fromOther])
    } else {
      const n = Math.min(ROUND_SIZE, queueEntries.length)
      entries = shuffle(queueEntries).slice(0, n)
    }

    buildItemsFor(entries, ps.currentPass)
  }, [entryMap, activeEntries, samePosMode, availablePos, direction, ROUND_SIZE, facetsByBox])

  const entriesKey = entryIds.join(',')

  // Leitner: init session whenever the entry pool changes, then build first round
  useEffect(() => {
    if (activeEntries.length === 0) return
    initSession(activeEntries, 'pairmatch')
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refreshes box/pass state whenever the entry pool changes
    refreshLeitnerState()
    buildRound()
  }, [entriesKey])

  // Rebuilding for a mode change (same-POS toggle) should not re-init the
  // session — just redraw a round from the existing pass queue. Skip on the
  // initial mount, since the entriesKey effect above already builds the
  // first round.
  const didMountPos = useRef(false)
  useEffect(() => {
    if (!didMountPos.current) { didMountPos.current = true; return }
    if (activeEntries.length >= 2) buildRound()
  }, [samePosMode])

  // Same for direction/readingOnly — these change the label text (and which
  // side reading applies to), so the current round's tiles need refreshing
  // immediately rather than waiting for the next round to pick it up.
  const didMountDisplay = useRef(false)
  useEffect(() => {
    if (!didMountDisplay.current) { didMountDisplay.current = true; return }
    if (activeEntries.length >= 2) buildRound()
  }, [direction, readingOnly])

  // Evaluate pair when both sides selected
  useEffect(() => {
    if (!selectedLeft || !selectedRight) return
    if (selectedLeft.id === selectedRight.id) {
      leitnerCorrect(selectedLeft.id, entryIds, 'pairmatch')
      // eslint-disable-next-line react-hooks/set-state-in-effect -- refreshes box/pass state in response to a completed pair selection
      refreshLeitnerState()
      setTotalCorrect(c => c + 1)
      setMatched(prev => new Set([...prev, selectedLeft.id]))
      setSelectedLeft(null)
      setSelectedRight(null)
    } else {
      leitnerWrong(selectedLeft.id, entryIds, 'pairmatch')
      leitnerWrong(selectedRight.id, entryIds, 'pairmatch')
      refreshLeitnerState()
      setWrongPair({ left: selectedLeft.id, right: selectedRight.id })
      setTimeout(() => {
        setWrongPair(null)
        setSelectedLeft(null)
        setSelectedRight(null)
      }, 600)
    }
  }, [selectedLeft, selectedRight])

  // Advance round when all matched
  useEffect(() => {
    if (roundSize > 0 && matched.size === roundSize) {
      setTimeout(() => {
        setRoundsCompleted(r => r + 1)
        buildRound()
      }, 500)
    }
  }, [matched, roundSize])
  function selectLeft(item) {
    if (matched.has(item.id) || wrongPair) return
    setSelectedLeft(prev => prev?.id === item.id ? null : item)
  }

  function selectRight(item) {
    if (matched.has(item.id) || wrongPair) return
    setSelectedRight(prev => prev?.id === item.id ? null : item)
  }

  function itemState(id, side) {
    if (matched.has(id)) return 'matched'
    if (wrongPair && (side === 'left' ? wrongPair.left : wrongPair.right) === id) return 'wrong'
    if (side === 'left'  && selectedLeft?.id  === id) return 'selected'
    if (side === 'right' && selectedRight?.id === id) return 'selected'
    return 'idle'
  }

  if (activeEntries.length < 2) {
    return <div className="pm-empty">Need at least 2 words to play.</div>
  }

  return (
    <div className="pm-screen">
      <div className="pm-header">
        <button className="pm-back" onClick={goBack}>← Back</button>
        <div className="pm-header-center">
          <span className="pm-stats">Round {roundsCompleted + 1} · {totalCorrect} matched</span>
        </div>
        <div className="pm-header-right">
          {isCJK && <ReadingOnlyToggle />}
          <DirectionToggle />
          <ReadingToggle />
          <FacetsByBoxToggle />
          {availablePos.length > 1 && (
            <button
              className={`pm-pos-toggle ${samePosMode ? 'active' : ''}`}
              onClick={() => setSamePosMode(v => !v)}
              title={samePosMode ? 'Same word type: on' : 'Same word type: off'}
            >
              1×
            </button>
          )}
          <HelpButton
            title="Pair Match"
            description="Tap a word on the left, then its matching translation on the right, to connect pairs. Wrong pairs briefly flash before resetting."
            buttons={[
              { icon: '⇵', label: 'Reading only',  desc: '(zh/ja) Show reading instead of hanzi/kanji' },
              { icon: '⇄', label: 'Direction',     desc: 'Swap which side is the word — left or right' },
              { icon: 'ふ/子', label: 'Reading',   desc: 'Show or hide the furigana/pinyin annotation' },
              { icon: '🧩', label: 'Train all facets', desc: "Each box drives its own display (translation flip, no reading, reading-only) so one card trains every facet of a word" },
              { icon: '1×', label: 'Same word type', desc: 'Restrict pairs to the same part of speech' },
            ]}
            showBoxes
          />
        </div>
      </div>

      <LeitnerBar boxCounts={boxCounts} passState={passState} onOpenBox={handleOpenBox} facetsByBox={facetsByBox} language={activeLanguage} />

      {levelEmpty && (
        <div className="level-warning">
          ⚠ <strong>No entries at selected level</strong> — showing all levels instead. Change in Settings.
        </div>
      )}

      <div className="pm-board">
        <div className="pm-column">
          {leftItems.map(item => (
            <button
              key={item.id}
              className={`pm-item pm-item--${itemState(item.id, 'left')}${isCJK ? ' pm-item--cjk' : ''}`}
              onClick={() => selectLeft(item)}
            >
              <RubyText text={item.label} reading={item.sub} visible={showReading && !!item.sub} size="sm" />
            </button>
          ))}
        </div>

        <div className="pm-column">
          {rightItems.map(item => (
            <button
              key={item.id}
              className={`pm-item pm-item--${itemState(item.id, 'right')}${isCJK ? ' pm-item--cjk' : ''}`}
              onClick={() => selectRight(item)}
            >
              <RubyText text={item.label} reading={item.sub} visible={showReading && !!item.sub} size="sm" />
            </button>
          ))}
        </div>
      </div>

      <div className="pm-progress">
        {[...Array(roundSize)].map((_, i) => (
          <span key={i} className={`pm-pip ${i < matched.size ? 'done' : ''}`} />
        ))}
      </div>
    </div>
  )
}
