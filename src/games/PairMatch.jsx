import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { srsPickDistinct } from '../engine/srs'
import RubyText from '../components/RubyText'
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
  const { activeEntries: allEntries, direction, showReading, scoreActions, settings, setScreen, goBack, getEntriesForGame, vocabLoading, activeLanguage } = useApp()
  const { entries: activeEntries, isEmpty: levelEmpty } = getEntriesForGame('pairmatch')
  const ROUND_SIZE = settings.pairmatch.roundSize
  const isCJK = activeLanguage === 'zh' || activeLanguage === 'ja'

  const [leftItems,  setLeftItems]  = useState([])
  const [rightItems, setRightItems] = useState([])
  const [selectedLeft,  setSelectedLeft]  = useState(null)
  const [selectedRight, setSelectedRight] = useState(null)
  const [matched,   setMatched]   = useState(new Set())
  const [wrongPair, setWrongPair] = useState(null)
  const [roundsCompleted, setRoundsCompleted] = useState(0)
  const [totalCorrect,    setTotalCorrect]    = useState(0)
  const [roundSize, setRoundSize] = useState(0)

  const buildRound = useCallback(() => {
    const n = Math.min(ROUND_SIZE, activeEntries.length)
    const entries = srsPickDistinct(activeEntries, n, 'pairmatch')
    setRoundSize(n)

    const lefts = entries.map(e => ({
      id: e.id,
      label: truncate(direction === 'entry->translation' ? e.entry : e.translation[0]),
      sub: direction === 'entry->translation' && showReading && e.reading ? e.reading : null,
    }))
    const rights = entries.map(e => ({
      id: e.id,
      label: truncate(direction === 'entry->translation' ? e.translation[0] : e.entry),
      sub: direction === 'translation->entry' && showReading && e.reading ? e.reading : null,
    }))

    setLeftItems(shuffle(lefts))
    setRightItems(shuffle(rights))
    setMatched(new Set())
    setSelectedLeft(null)
    setSelectedRight(null)
    setWrongPair(null)
  }, [activeEntries, direction, showReading])

  const entriesKey = activeEntries.map(e => e.id).join(',')

  useEffect(() => {
    if (activeEntries.length >= 2) buildRound()
  }, [entriesKey])

  // Evaluate pair when both sides selected
  useEffect(() => {
    if (!selectedLeft || !selectedRight) return
    if (selectedLeft.id === selectedRight.id) {
      scoreActions.correct(selectedLeft.id, 'pairmatch')
      setTotalCorrect(c => c + 1)
      setMatched(prev => new Set([...prev, selectedLeft.id]))
      setSelectedLeft(null)
      setSelectedRight(null)
    } else {
      scoreActions.wrong(selectedLeft.id, 'pairmatch')
      scoreActions.wrong(selectedRight.id, 'pairmatch')
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button className="pm-gear" onClick={() => setScreen('settings')} title="Settings">⚙️</button>
          <span className="pm-stats">Round {roundsCompleted + 1} · {totalCorrect} matched</span>
        </div>
      </div>

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
              <RubyText text={item.label} reading={item.sub} visible={!!item.sub} size="sm" />
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
              <RubyText text={item.label} reading={item.sub} visible={!!item.sub} size="sm" />
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
