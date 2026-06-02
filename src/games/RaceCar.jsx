import RubyText from '../components/RubyText'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { srsPick, srsPickDistinct } from '../engine/srs'
import './RaceCar.css'

const LANE_COUNT = 3
const TILE_HEIGHT = 80
const BASE_SPEED = 120 // px per second at x1
const BOOST_MULTIPLIER = 1.5
const STREAK_THRESHOLDS = [1, 3, 6, 10] // streak levels
const STREAK_MULTIPLIERS = [1, 1.5, 2, 2.5, 3]

function getStreakMultiplier(streak) {
  let level = 0
  for (let i = 0; i < STREAK_THRESHOLDS.length; i++) {
    if (streak >= STREAK_THRESHOLDS[i]) level = i + 1
  }
  return STREAK_MULTIPLIERS[level]
}

let tileIdCounter = 0
function makeTile(entry, isCorrect, lane, y) {
  return { id: tileIdCounter++, entry, isCorrect, lane, y }
}

export default function RaceCar() {
  const { activeEntries: allEntries, direction, showReading, scoreActions, scores, settings, updateSettings, setScreen, getEntriesForGame, vocabLoading } = useApp()
  const { entries: activeEntries, isEmpty: levelEmpty } = getEntriesForGame('racecar')
  const { defaultSpeed, boostEnabled } = settings.racecar

  // Game state
  const [carLane, setCarLane]     = useState(1)
  const [tiles, setTiles]         = useState([])
  const [prompt, setPrompt]       = useState(null)
  const [score, setScore]         = useState(0)
  const [highScore, setHighScore] = useState(() => parseInt(localStorage.getItem('rc-high') || '0'))
  const [streak, setStreak]       = useState(0)
  const [boosting, setBoosting]   = useState(false)
  const [crash, setCrash]         = useState(false)
  const [flashCorrect, setFlashCorrect] = useState(false)
  const [seenCount, setSeenCount] = useState(0)
  const [positiveCount, setPositiveCount] = useState(0)

  // Refs for game loop
  const tilesRef      = useRef(tiles)
  const promptRef     = useRef(prompt)
  const carLaneRef    = useRef(carLane)
  const boostRef      = useRef(boosting)
  const crashRef      = useRef(false)
  const streakRef     = useRef(streak)
  const scoreRef      = useRef(score)
  const lastTimeRef   = useRef(null)
  const rafRef        = useRef(null)
  const screenHeight  = useRef(window.innerHeight)
  const activeRef     = useRef(activeEntries)
  const lanesRef      = useRef(null)

  // Touch-driven car position — declared here so checkCollisions can close over them
  const [carX, setCarX] = useState(null)
  const [carY, setCarY] = useState(null)

  useEffect(() => { tilesRef.current = tiles }, [tiles])
  useEffect(() => { promptRef.current = prompt }, [prompt])
  useEffect(() => { carLaneRef.current = carLane }, [carLane])
  useEffect(() => { boostRef.current = boosting }, [boosting])
  useEffect(() => { streakRef.current = streak }, [streak])
  useEffect(() => { scoreRef.current = score }, [score])
  useEffect(() => { activeRef.current = activeEntries }, [activeEntries])

  // Spawn a new set of 3 tiles (1 correct, 2 distractors) for the current prompt
  const spawnTiles = useCallback((currentPrompt) => {
    if (!currentPrompt || activeRef.current.length < 3) return

    const distractors = srsPickDistinct(activeRef.current.filter(e => e.id !== currentPrompt.id), 2, 'racecar')
    const entries = [currentPrompt, ...distractors]
    const lanes = [0, 1, 2].sort(() => Math.random() - 0.5)
    const stagger = [-60, 0, 60] // y offset stagger

    const newTiles = entries.map((entry, i) => makeTile(
      entry,
      entry.id === currentPrompt.id,
      lanes[i],
      -TILE_HEIGHT - 20 + stagger[i]
    ))
    setTiles(newTiles)
  }, [])

  // Pick a new prompt and spawn tiles
  const nextPrompt = useCallback(() => {
    const [entry] = srsPick(activeRef.current, 'racecar')
    if (!entry) return
    setPrompt(entry)
    promptRef.current = entry
    setSeenCount(c => c + 1)
    setTimeout(() => spawnTiles(entry), 50)
  }, [spawnTiles])

  const checkCollisions = useCallback(() => {
    if (crashRef.current) return
    const sh = screenHeight.current
    // Car vertical: carY is from top of lanes div; if not set, default bottom position
    let carTop, carBottom
    if (carY !== null && lanesRef.current) {
      const rect = lanesRef.current.getBoundingClientRect()
      carTop    = carY
      carBottom = carY + 72
    } else {
      // Default: sit in normal zone — bottom 15%, car top at 85% of screen
      carBottom = sh * 0.97
      carTop    = carBottom - 72
    }

    tilesRef.current.forEach(tile => {
      // Tile vertical overlap
      if (tile.y + TILE_HEIGHT < carTop || tile.y > carBottom) return
      // Tile horizontal overlap — use pixel positions
      if (!lanesRef.current) {
        // Fallback: lane-based check
        if (tile.lane !== carLaneRef.current) return
      } else {
        const rect = lanesRef.current.getBoundingClientRect()
        const laneW = rect.width / 3
        const tilePxLeft  = tile.lane * laneW + 4
        const tilePxRight = tilePxLeft + laneW - 8
        const carPxX = carX !== null ? carX : (carLaneRef.current * laneW + laneW / 2)
        const carLeft  = carPxX - 24
        const carRight = carPxX + 24
        if (carRight < tilePxLeft || carLeft > tilePxRight) return
      }
      // Collision!
      if (tile.isCorrect) {
        const mult = getStreakMultiplier(streakRef.current)
        const pts = Math.round(10 * mult)
        const newScore = scoreRef.current + pts
        setScore(newScore)
        scoreRef.current = newScore
        if (newScore > highScore) {
          setHighScore(newScore)
          localStorage.setItem('rc-high', newScore)
        }
        const newStreak = streakRef.current + 1
        setStreak(newStreak)
        streakRef.current = newStreak
        scoreActions.correct(tile.entry.id, 'racecar')
        setPositiveCount(c => c + 1)
        setFlashCorrect(true)
        setTimeout(() => setFlashCorrect(false), 300)
        setTiles([])
        tilesRef.current = []
        nextPrompt()
      } else {
        crashRef.current = true
        setCrash(true)
        scoreActions.wrong(tile.entry.id, 'racecar')
        setStreak(0)
        streakRef.current = 0
        setTiles([])
        tilesRef.current = []
        setTimeout(() => {
          crashRef.current = false
          setCrash(false)
          nextPrompt()
        }, 800)
      }
    })
  }, [nextPrompt, scoreActions, highScore, carY, carX])

  // Game loop
  const gameLoop = useCallback((timestamp) => {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp
    const dt = (timestamp - lastTimeRef.current) / 1000
    lastTimeRef.current = timestamp

    if (!crashRef.current) {
      const speed = BASE_SPEED * defaultSpeed * (boostRef.current ? BOOST_MULTIPLIER : 1) * getStreakMultiplier(streakRef.current)
      const dy = speed * dt

      setTiles(prev => {
        const next = prev
          .map(t => ({ ...t, y: t.y + dy }))
          .filter(t => t.y < screenHeight.current + 20)
        tilesRef.current = next
        return next
      })
      checkCollisions()
    }

    // Spawn new tiles if none visible
    if (tilesRef.current.length === 0 && !crashRef.current && promptRef.current) {
      spawnTiles(promptRef.current)
    }

    rafRef.current = requestAnimationFrame(gameLoop)
  }, [checkCollisions, spawnTiles])

  // Start game
  useEffect(() => {
    if (activeEntries.length < 3) return
    nextPrompt()
    rafRef.current = requestAnimationFrame(gameLoop)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])  // eslint-disable-line

  // Keyboard controls
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape')     { setScreen('setup'); return }
      if (e.key === 'ArrowLeft')  setCarLane(l => { const n = Math.max(0, l-1); carLaneRef.current = n; return n })
      if (e.key === 'ArrowRight') setCarLane(l => { const n = Math.min(2, l+1); carLaneRef.current = n; return n })
      if (e.key === 'ArrowUp') {
        if (!boostEnabled) return
        setBoosting(true)
        boostRef.current = true
        // release after 800ms
        setTimeout(() => { setBoosting(false); boostRef.current = false }, 800)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [boostEnabled])

  function onPointerDown(e) {
    lanesRef.current?.setPointerCapture(e.pointerId)
    updateCarFromPointer(e.clientX, e.clientY)
  }
  function onPointerMove(e) {
    if (!lanesRef.current) return
    updateCarFromPointer(e.clientX, e.clientY)
  }
  function onPointerUp(e) {
    lanesRef.current?.releasePointerCapture(e.pointerId)
    setCarY(null) // snap back to default position on release
  }

  function updateCarFromPointer(clientX, clientY) {
    const el = lanesRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()

    // X — smooth, clamped
    const CAR_HALF = 24
    const relX = Math.max(CAR_HALF, Math.min(rect.width - CAR_HALF, clientX - rect.left))
    setCarX(relX)
    const lane = Math.min(2, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * 3)))
    carLaneRef.current = lane
    setCarLane(lane)

    // Y — car follows finger, clamped to bottom 25% (normal + boost zones)
    const CAR_HEIGHT = 72
    const relY = clientY - rect.top
    const zoneTop = rect.height * 0.75  // can't go above 75% down = top of boost zone
    const clampedY = Math.max(zoneTop, Math.min(rect.height - CAR_HEIGHT - 4, relY - CAR_HEIGHT / 2))
    setCarY(clampedY)

    // Boost: upper half of interactive zone = boost zone (75–85% down = boost, 85–100% = normal)
    if (!boostEnabled) { setBoosting(false); boostRef.current = false; return }
    const relYRatio = (clientY - rect.top) / rect.height
    const isBoost = relYRatio < 0.85 && relYRatio >= 0.75
    setBoosting(isBoost)
    boostRef.current = isBoost
  }

  const laneWidth = 100 / LANE_COUNT
  const promptText = prompt
    ? (direction === 'entry->translation' ? prompt.translation[0] : prompt.entry)
    : '…'

  const seenPct = activeEntries.length > 0 ? Math.round((seenCount / activeEntries.length) * 100) : 0
  const posPct  = seenCount > 0 ? Math.round((positiveCount / seenCount) * 100) : 0

  // Speed lines scale with speed and boost
  const lineBase = Math.round(8 + defaultSpeed * 14)
  const lineMult = boosting ? 2 : 1
  const lineWidths = [lineBase * lineMult, Math.round(lineBase * 0.7) * lineMult, Math.round(lineBase * 0.5) * lineMult]

  return (
    <div className={`rc-screen ${crash ? 'rc-crash' : ''} ${flashCorrect ? 'rc-correct' : ''}`}>

      {/* Header */}
      <div className="rc-header">
        <div className="rc-header-left">
          <button className="rc-back" onClick={() => setScreen('setup')}>← Back</button>
          <div className="rc-stats-inline">
            <span className="rc-score-big">Score {score}</span>
            <span className="rc-seen">{seenPct}% seen · {posPct}% correct</span>
          </div>
        </div>
        <div className="rc-header-center">
          <span className="rc-streak">{streak > 1 ? `🔥 ${streak}` : `High ${highScore}`}</span>
        </div>
        <div className="rc-header-right">
          <button className="rc-gear" onClick={() => setScreen('settings')} title="Settings">⚙️</button>
        </div>
      </div>

      {levelEmpty && (
        <div className="level-warning">
          ⚠ <strong>No entries at selected level</strong> — showing all levels instead. Change in Settings.
        </div>
      )}
      {/* Prompt */}
      <div className="rc-prompt-area">
        <div className="rc-prompt">{promptText}</div>
        {showReading && prompt?.reading && direction === 'translation->entry' && (
          <div className="rc-prompt-reading">{prompt.reading}</div>
        )}
      </div>

      {/* Lane lines */}
      <div
        className="rc-lanes"
        ref={lanesRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ cursor: 'none' }}
      >
        {[0,1,2].map(i => (
          <div key={i} className="rc-lane-line" style={{ left: `${(i+1) * laneWidth}%` }} />
        ))}

        {/* Speed slider — base multiplier */}
        <div className="rc-slider-wrap">
          <input
            type="range" min="50" max="200" step="5"
            value={Math.round(defaultSpeed * 100)}
            onChange={e => {
              const v = e.target.value / 100
              updateSettings(s => ({ ...s, racecar: { ...s.racecar, defaultSpeed: v } }))
            }}
            className="rc-slider"
            orient="vertical"
          />
          <span className="rc-slider-label">x{defaultSpeed.toFixed(1)}{boosting ? '⚡' : ''}</span>
        </div>

        {/* Tiles */}
        {tiles.map(tile => {
          const tileLabel = direction === 'entry->translation' ? tile.entry.entry : tile.entry.translation[0]
          const tileSub   = showReading && tile.entry.reading && direction === 'entry->translation' ? tile.entry.reading : null
          return (
            <div
              key={tile.id}
              className="rc-tile"
              style={{
                left: `calc(${tile.lane * laneWidth}% + 4px)`,
                width: `calc(${laneWidth}% - 8px)`,
                top: tile.y,
              }}
            >
              <RubyText text={tileLabel} reading={tileSub} visible={!!tileSub} size="md" className="ruby-dark" />
            </div>
          )
        })}

        {/* Car — smooth X and Y positioning */}
        <div
          className={`rc-car ${crash ? 'rc-car-crash' : ''}`}
          style={{
            position: 'absolute',
            ...(carY !== null
              ? { top: `${carY}px`, bottom: 'auto' }
              : { bottom: '3%' }
            ),
            left: carX !== null
              ? `${carX - 24}px`
              : `calc(${carLane * laneWidth + laneWidth/2}% - 24px)`,
            transition: 'left 0.05s linear',
          }}
        >
          <div className="rc-car-body" />
          <div className="rc-speedlines">
            {lineWidths.map((w, i) => (
              <div key={i} className="rc-speedline" style={{ width: w }} />
            ))}
          </div>
        </div>

        {boosting && <span className="rc-boost-label">BOOST ↑</span>}

        {/* Zone dividers */}
        <div className="rc-zone-boost">
          <span className="rc-zone-boost-label">boost</span>
        </div>
        <div className="rc-zone-normal" />
      </div>
    </div>
  )
}
