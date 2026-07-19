import RubyText from '../components/RubyText'
import DirectionToggle from '../components/DirectionToggle'
import ReadingToggle from '../components/ReadingToggle'
import ReadingOnlyToggle from '../components/ReadingOnlyToggle'
import FacetsByBoxToggle from '../components/FacetsByBoxToggle'
import HelpButton from '../components/HelpButton'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { srsPick, srsPickDistinct, getScore } from '../engine/srs'
import { resolveFacet } from '../engine/facets'
import './RaceCar.css'

function truncate(text) {
  if (!text) return text
  const idx = text.indexOf(';')
  return idx > 0 ? text.slice(0, idx).trim() : text
}

const LANE_COUNT = 3
const TILE_HEIGHT = 90
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
  const { direction, showReading, readingOnly, facetsByBox, scoreActions, settings, updateSettings, setScreen, goBack, getEntriesForGame, activeLanguage } = useApp()
  const { entries: activeEntries, isEmpty: levelEmpty } = getEntriesForGame('racecar')
  const { defaultSpeed, boostEnabled } = settings.racecar
  const speedRef = useRef(defaultSpeed)
  useEffect(() => { speedRef.current = defaultSpeed }, [defaultSpeed])

  // Game state
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
  const carLaneRef    = useRef(1)  // lane 0-2; no React state needed
  const boostRef      = useRef(boosting)
  const crashRef      = useRef(false)
  const streakRef     = useRef(streak)
  const scoreRef      = useRef(score)
  const lastTimeRef   = useRef(null)
  const rafRef        = useRef(null)
  const gameLoopRef   = useRef(null)
  const screenHeight  = useRef(window.innerHeight)
  const activeRef     = useRef(activeEntries)
  const lanesRef      = useRef(null)

  // Car position — use a ref + direct DOM update for smooth 60fps movement
  // carPosRef holds { x, y } in pixels; carRef points to the car DOM element
  const carRef    = useRef(null)
  const carPosRef = useRef({ x: null, y: null })  // null = default position
  useEffect(() => { tilesRef.current = tiles }, [tiles])
  useEffect(() => { promptRef.current = prompt }, [prompt])
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
    // Read car position directly from ref (bypasses React state for smooth movement)
    const { x: carX, y: carY } = carPosRef.current
    let carTop, carBottom
    if (carY !== null) {
      carTop    = carY
      carBottom = carY + 72
    } else {
      carBottom = sh * 0.97
      carTop    = carBottom - 72
    }

    tilesRef.current.forEach(tile => {
      if (tile.y + TILE_HEIGHT < carTop || tile.y > carBottom) return
      if (!lanesRef.current) {
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
  }, [nextPrompt, scoreActions, highScore])

  // Game loop
  const gameLoop = useCallback((timestamp) => {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp
    const dt = (timestamp - lastTimeRef.current) / 1000
    lastTimeRef.current = timestamp

    if (!crashRef.current) {
      const speed = BASE_SPEED * speedRef.current * (boostRef.current ? BOOST_MULTIPLIER : 1)
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

    rafRef.current = requestAnimationFrame(t => gameLoopRef.current?.(t))
  }, [checkCollisions, spawnTiles])

  // Keep the ref pointed at the latest gameLoop so the RAF recursion below
  // (and the one in the start-game effect) never calls a stale closure.
  useEffect(() => { gameLoopRef.current = gameLoop }, [gameLoop])

  // Start game
  useEffect(() => {
    if (activeEntries.length < 3) return
    nextPrompt()
    rafRef.current = requestAnimationFrame(t => gameLoopRef.current?.(t))
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])  // eslint-disable-line

  // Keyboard controls
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape')     { setScreen('setup'); return }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const delta = e.key === 'ArrowLeft' ? -1 : 1
        const n = Math.max(0, Math.min(2, carLaneRef.current + delta))
        carLaneRef.current = n
        // Update car DOM directly
        if (carRef.current && lanesRef.current) {
          const lw = 100 / 3
          carRef.current.style.left   = `calc(${n * lw + lw/2}% - 24px)`
          carRef.current.style.bottom = '3%'
          carRef.current.style.top    = 'auto'
        }
      }
      if (e.key === 'ArrowUp' && boostEnabled) {
        setBoosting(true)
        boostRef.current = true
      }
    }
    function onKeyUp(e) {
      if (e.key === 'ArrowUp') {
        setBoosting(false)
        boostRef.current = false
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup',   onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup',   onKeyUp)
    }
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
    // Snap back to default bottom position
    carPosRef.current = { x: null, y: null }
    if (carRef.current) {
      carRef.current.style.top    = 'auto'
      carRef.current.style.bottom = '3%'
    }
  }

  function updateCarFromPointer(clientX, clientY) {
    const el = lanesRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()

    // X — smooth, clamped, update DOM directly
    const CAR_HALF = 24
    const relX = Math.max(CAR_HALF, Math.min(rect.width - CAR_HALF, clientX - rect.left))
    carPosRef.current.x = relX
    if (carRef.current) {
      carRef.current.style.left   = `${relX - CAR_HALF}px`
      carRef.current.style.bottom = 'auto'
    }

    // Lane for collision — still needs state update (but less frequent is fine)
    const lane = Math.min(2, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * 3)))
    carLaneRef.current = lane

    // Y — snap to two fixed positions: normal zone or boost zone
    const CAR_HEIGHT = 72
    const relYRatio  = (clientY - rect.top) / rect.height
    const inBoost    = relYRatio >= 0.60 && relYRatio < 0.78
    const inNormal   = relYRatio >= 0.78

    if (inBoost || inNormal) {
      const snapY = inBoost
        ? rect.height * 0.65 - CAR_HEIGHT / 2   // boost line
        : rect.height * 0.78 - CAR_HEIGHT / 2   // normal line
      if (carPosRef.current.y !== snapY) {
        carPosRef.current.y = snapY
        if (carRef.current) {
          carRef.current.style.bottom = 'auto'
          carRef.current.style.top    = `${snapY}px`
        }
      }
    }

    // Boost toggle — only fires when crossing zone boundary
    if (!boostEnabled) { setBoosting(false); boostRef.current = false; return }
    const isBoost = inBoost
    if (isBoost !== boostRef.current) {
      setBoosting(isBoost)
      boostRef.current = isBoost
    }
  }

  const laneWidth = 100 / LANE_COUNT
  const isCJKLang = activeLanguage === 'zh' || activeLanguage === 'ja'

  // When facetsByBox is on, this word's own score (0-5, same scale as the
  // Leitner boxes) drives its display facet instead of the manual toggles.
  const promptBox      = prompt ? getScore(prompt.id, 'racecar') : 0
  const facet           = facetsByBox ? resolveFacet(promptBox, activeLanguage) : null
  const effDirection    = facet ? facet.direction    : direction
  const effShowReading  = facet ? facet.showReading  : showReading
  const effReadingOnly  = facet ? facet.readingOnly  : readingOnly

  const promptText = prompt
    ? (effDirection === 'entry->translation'
        ? prompt.translation[0]
        : (effReadingOnly && isCJKLang && prompt.reading ? prompt.reading : prompt.entry))
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
          <button className="rc-back" onClick={goBack}>← Back</button>
          <div className="rc-stats-inline">
            <span className="rc-score-big">Score {score}</span>
            <span className="rc-seen">{seenPct}% seen · {posPct}% correct</span>
          </div>
        </div>
        <div className="rc-header-center">
          <span className="rc-streak">{streak > 1 ? `🔥 ${streak}` : `High ${highScore}`}</span>
        </div>
        <div className="rc-header-right">
          {(activeLanguage === 'zh' || activeLanguage === 'ja') && <ReadingOnlyToggle />}
          <DirectionToggle />
          <ReadingToggle />
          <FacetsByBoxToggle />
          <HelpButton
            title="Race Car"
            description="Steer into the lane with the correct answer before it reaches you. Faster, correct answers build your streak; wrong lanes or running out of time end it."
            buttons={[
              { icon: '⇵', label: 'Reading only', desc: '(zh/ja) Show reading instead of hanzi/kanji' },
              { icon: '⇄', label: 'Direction',    desc: 'Swap which side is the prompt — word or translation' },
              { icon: 'ふ/子', label: 'Reading',  desc: 'Show or hide the furigana/pinyin annotation' },
              { icon: '🧩', label: 'Train all facets', desc: "Each word's own score drives its display (translation flip, no reading, reading-only) so it's trained on every facet over time" },
            ]}
          />
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
        {effShowReading && prompt?.reading && effDirection === 'translation->entry' && !(effReadingOnly && isCJKLang) && (
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
          <span className="rc-slider-label">
            x{defaultSpeed.toFixed(1)}
            <span className="rc-slider-boost" style={{ visibility: boosting ? 'visible' : 'hidden' }}>⚡</span>
          </span>
        </div>

        {/* Tiles */}
        {tiles.map(tile => {
          const rawLabel  = effDirection === 'entry->translation'
            ? (effReadingOnly && isCJKLang && tile.entry.reading ? tile.entry.reading : tile.entry.entry)
            : tile.entry.translation[0]
          const tileLabel = truncate(rawLabel)
          const tileSub   = effShowReading && tile.entry.reading && effDirection === 'entry->translation' && !(effReadingOnly && isCJKLang) ? tile.entry.reading : null
          // Pick size: CJK glyphs are compact; long Latin words need smaller font
          const isCJK = /[\u4e00-\u9fff\u3040-\u30ff]/.test(tileLabel)
          const tileSize = isCJK ? 'md' : tileLabel.length > 10 ? 'sm' : 'md'
          return (
            <div
              key={tile.id}
              className="rc-tile"
              data-has-ruby={!!tileSub}
              style={{
                left: `calc(${tile.lane * laneWidth}% + 4px)`,
                width: `calc(${laneWidth}% - 8px)`,
                top: tile.y,
              }}
            >
              <RubyText text={tileLabel} reading={tileSub} visible={!!tileSub} size={tileSize} className="ruby-dark" />
            </div>
          )
        })}

        {/* Car — position updated directly via carRef for smooth 60fps movement.
            The ref read below only sets the initial mount position; every
            subsequent move writes to carRef.current.style.left directly,
            bypassing React re-renders on purpose (keyboard/drag handlers
            above). Converting this to state would reintroduce per-frame
            re-renders and defeat that optimization. */}
        <div
          ref={carRef}
          className={`rc-car ${crash ? 'rc-car-crash' : ''}`}
          style={{
            position: 'absolute',
            bottom: '3%',
            // eslint-disable-next-line react-hooks/refs -- intentional, see comment above
            left: `calc(${carLaneRef.current * laneWidth + laneWidth/2}% - 24px)`,
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
