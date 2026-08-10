import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { getBox } from '../engine/leitner'
import { getExampleSentence } from '../engine/examples'
import { speakAndWait, stop as stopSpeech, isSupported as speechSupported } from '../engine/speech'
import { displayEntry } from '../engine/vocab'
import RubyText from '../components/RubyText'
import HelpButton from '../components/HelpButton'
import ChipRow from '../components/ChipRow'
import './Listening.css'

const GAP_SHORT = 350   // between sequence steps
const GAP_LONG  = 900   // after the last step, before moving to the next word
const BOX_MODES = ['all', 0, 1, 2, 3, 4]
const DEFAULT_SEQUENCE = ['word', 'translation', 'sentence']
const STEP_LABELS = { word: 'Word', translation: 'Translation', sentence: 'Sentence' }

function delay(ms, tokenRef, token) {
  return new Promise(resolve => {
    const id = setTimeout(resolve, ms)
    // if playback gets paused/cancelled mid-wait, don't bother waiting out the timer
    const check = setInterval(() => {
      if (tokenRef.current !== token) { clearTimeout(id); clearInterval(check); resolve() }
    }, 50)
    setTimeout(() => clearInterval(check), ms + 10)
  })
}

function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function Listening() {
  const { getEntriesForGame, activeLanguage, goBack, settings, updateSettings } = useApp()

  const [boxMode,   setBoxMode]   = useState('all')     // 'all' | 0 | 1 | 2 | 3 | 4
  const [reshuffle, setReshuffle] = useState(0)
  const [playing,   setPlaying]   = useState(false)
  const [index,     setIndex]     = useState(0)
  const [phase,     setPhase]     = useState('idle')    // 'idle' | 'word' | 'translation' | 'sentence' | 'gap'
  const [sentence,  setSentence]  = useState(null)

  const sequence = settings.listeningSequence ?? DEFAULT_SEQUENCE
  const sequenceRef = useRef(sequence)
  useEffect(() => { sequenceRef.current = sequence })

  const speechRate = settings.listeningSpeechRate ?? 0.9
  const speechRateRef = useRef(speechRate)
  useEffect(() => { speechRateRef.current = speechRate })

  function updateSequence(next) {
    stopAndReset()
    updateSettings(s => ({ ...s, listeningSequence: next }))
  }
  function addStep(step) { updateSequence([...sequence, step]) }
  function removeStep(i) { updateSequence(sequence.filter((_, idx) => idx !== i)) }
  function resetSequence() { updateSequence(DEFAULT_SEQUENCE) }
  function setSpeechRate(v) { updateSettings(s => ({ ...s, listeningSpeechRate: v })) }

  const { entries: poolEntries } = getEntriesForGame('listening')
  const poolKey = useMemo(() => poolEntries.map(e => e.id).join(','), [poolEntries])

  // Box 0-4 only — box 5 (mastered) is intentionally excluded, that's the
  // whole point of this game: hear the words you haven't fully learned yet.
  const queue = useMemo(() => {
    const withBox = poolEntries
      .map(e => ({ ...e, _box: getBox(e.id, 'flashcard') }))
      .filter(e => e._box < 5)

    if (boxMode === 'all') {
      return [0, 1, 2, 3, 4].flatMap(b => shuffle(withBox.filter(e => e._box === b)))
    }
    return shuffle(withBox.filter(e => e._box === boxMode))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poolKey (not poolEntries) is the real dependency: getEntriesForGame returns a fresh array identity every render, which would otherwise reshuffle on every unrelated re-render (e.g. every phase change during playback); reshuffle is a manual re-roll trigger, not a real dependency either
  }, [poolKey, boxMode, reshuffle])

  const queueRef = useRef(queue)
  useEffect(() => { queueRef.current = queue }, [queue])
  const tokenRef = useRef(0)

  function stopAndReset() {
    tokenRef.current++
    stopSpeech()
    setPlaying(false)
    setPhase('idle')
    setIndex(0)
    setSentence(null)
  }

  function selectBoxMode(mode) {
    stopAndReset()
    setBoxMode(mode)
  }

  function doReshuffle() {
    stopAndReset()
    setReshuffle(n => n + 1)
  }

  const playFrom = useCallback(async (startIndex, token) => {
    let idx = startIndex
    while (tokenRef.current === token) {
      const entry = queueRef.current[idx]
      if (!entry) break
      setIndex(idx)

      // Fetch (and show) the example sentence immediately, before speaking
      // anything, so word/translation/sentence are all visible together
      // from the start of this word's turn rather than the sentence
      // appearing partway through.
      const ex = await getExampleSentence(entry.listId, entry.entry, entry.pos)
      if (tokenRef.current !== token) break
      setSentence(ex)

      for (const step of sequenceRef.current) {
        if (tokenRef.current !== token) break
        if (step === 'sentence' && !ex) continue  // no sentence available for this word — skip silently, no gap
        if (step === 'word') {
          setPhase('word')
          await speakAndWait(entry.entry, activeLanguage, { rate: speechRateRef.current })
        } else if (step === 'translation') {
          setPhase('translation')
          await speakAndWait(entry.translation[0], 'en', { rate: speechRateRef.current })
        } else if (step === 'sentence') {
          setPhase('sentence')
          await speakAndWait(ex, activeLanguage, { rate: speechRateRef.current })
        }
        if (tokenRef.current !== token) break
        await delay(GAP_SHORT, tokenRef, token)
      }
      if (tokenRef.current !== token) break

      await delay(GAP_LONG, tokenRef, token)
      idx = (idx + 1) % queueRef.current.length
    }
  }, [activeLanguage])

  function handlePlay() {
    if (queue.length === 0 || sequence.length === 0) return
    const token = ++tokenRef.current
    setPlaying(true)
    playFrom(index, token)
  }

  function handlePause() {
    tokenRef.current++
    stopSpeech()
    setPlaying(false)
    setPhase('idle')
  }

  function handleSkip(dir) {
    tokenRef.current++
    stopSpeech()
    const next = (index + dir + queue.length) % queue.length
    setIndex(next)
    setSentence(null)
    if (playing) {
      const token = ++tokenRef.current
      playFrom(next, token)
    } else {
      setPhase('idle')
    }
  }

  useEffect(() => () => { tokenRef.current++; stopSpeech() }, [])

  // Screen Wake Lock: keep the display on while actively playing, so the
  // screen locking doesn't interrupt a hands-free listening session. Not
  // supported everywhere (notably older Safari) — degrades to normal
  // screen-timeout behavior where unavailable, not a hard requirement.
  const wakeLockRef = useRef(null)
  useEffect(() => {
    if (!('wakeLock' in navigator)) return

    let cancelled = false

    async function acquire() {
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) { lock.release(); return }
        wakeLockRef.current = lock
      } catch {
        // Wake lock requests can legitimately fail (e.g. low battery on some
        // platforms, or the document isn't visible at request time) — not
        // fatal, playback just proceeds without it.
      }
    }

    function release() {
      wakeLockRef.current?.release()
      wakeLockRef.current = null
    }

    if (playing) {
      acquire()
    } else {
      release()
    }

    // Wake locks are automatically released by the browser when a tab is
    // hidden — re-request on becoming visible again if we should still hold one.
    function onVisibilityChange() {
      if (playing && document.visibilityState === 'visible' && !wakeLockRef.current) acquire()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      release()
    }
  }, [playing])

  const currentEntry = queue[index] ?? null
  // displayEntry() returns a plain string (e.g. "der Hund"), not a
  // {main, sub} object — build that ourselves, same as Flashcard.jsx's
  // getPrompt() does. Missing this meant prompt.main/.sub were always
  // undefined and the target-language word silently never rendered.
  const prompt = currentEntry
    ? { main: displayEntry(currentEntry, activeLanguage), sub: currentEntry.reading || null }
    : null

  // Media Session: lock-screen / notification-shade playback controls. This
  // gives play/pause/skip controls without unlocking the phone, but note it
  // does NOT reliably keep speech playing once the screen locks or the tab
  // is backgrounded — that would need real audio files behind an <audio>
  // element, which is a much bigger undertaking (pre-generated TTS audio,
  // hosting, etc.) than this app's static-hosting architecture supports
  // today. This is a UX nicety on top of foreground playback, not a fix
  // for background playback.
  const handlersRef = useRef({})
  useEffect(() => { handlersRef.current = { handlePlay, handlePause, handleSkip } })

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.setActionHandler('play',         () => handlersRef.current.handlePlay())
    navigator.mediaSession.setActionHandler('pause',        () => handlersRef.current.handlePause())
    navigator.mediaSession.setActionHandler('previoustrack', () => handlersRef.current.handleSkip(-1))
    navigator.mediaSession.setActionHandler('nexttrack',      () => handlersRef.current.handleSkip(1))
    return () => {
      navigator.mediaSession.setActionHandler('play', null)
      navigator.mediaSession.setActionHandler('pause', null)
      navigator.mediaSession.setActionHandler('previoustrack', null)
      navigator.mediaSession.setActionHandler('nexttrack', null)
    }
  }, [])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    if (!currentEntry) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title:  currentEntry.entry,
      artist: currentEntry.translation?.[0] ?? '',
      album:  boxMode === 'all' ? `Listening · Box ${currentEntry._box}` : `Listening · Box ${boxMode}`,
    })
  }, [currentEntry, boxMode])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
  }, [playing])

  if (!speechSupported()) {
    return (
      <div className="ls-screen">
        <div className="ls-header">
          <button className="ls-back" onClick={goBack}>← Back</button>
          <h2>Listening</h2>
        </div>
        <div className="ls-unsupported">
          <p><strong>Audio isn't available on this device.</strong></p>
          <p>This game needs text-to-speech support, which your current browser doesn't have.</p>
          <ul>
            <li>Your browser doesn't support text-to-speech</li>
            <li>You're in an in-app browser (e.g. WeChat, Instagram) — try opening this site in Chrome or Safari directly</li>
            <li>No voices are installed for this language</li>
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div className="ls-screen">
      <div className="ls-header">
        <button className="ls-back" onClick={goBack}>← Back</button>
        <h2>🎧 Listening</h2>
        <HelpButton
          title="Listening"
          description="Hands-free audio review: hears each word in your custom order (word/translation/sentence, repeats and omissions both allowed) for every word in your current filter, skipping mastered words. No scoring — just passive listening reinforcement."
          buttons={[
            { icon: 'All boxes / Box N', label: 'Box filter', desc: 'Cycle through every unmastered box top-down, or loop just one box on repeat' },
            { icon: '🔀', label: 'Reshuffle', desc: 'Re-randomize the order within each box' },
            { icon: '+ Word / + Translation / + Sentence', label: 'Play order', desc: 'Tap to append to the sequence; tap a chip in the sequence to remove it' },
            { icon: 'Speed', label: 'Playback speed', desc: 'Slide from 0.5× to 1.5× — applies to every utterance in this session' },
          ]}
        />
      </div>

      <ChipRow className="ls-box-row">
        {BOX_MODES.map(b => (
          <button
            key={String(b)}
            className={`ls-box-chip ${boxMode === b ? 'active' : ''}`}
            onClick={() => selectBoxMode(b)}
          >
            {b === 'all' ? 'All' : b}
          </button>
        ))}
        <button className="ls-reshuffle" title="Reshuffle" onClick={doReshuffle}>🔀</button>
      </ChipRow>
      <p className="ls-box-caption">No progress tracking here — box just picks which words to play, playback only.</p>

      <div className="ls-sequence">
        <div className="ls-sequence-chips">
          {sequence.length === 0 ? (
            <span className="ls-sequence-empty">No items — add at least one below to enable playback</span>
          ) : (
            sequence.map((step, i) => (
              <button
                key={i}
                className={`ls-seq-chip ls-seq-chip--${step}`}
                onClick={() => removeStep(i)}
                title="Tap to remove"
              >
                {STEP_LABELS[step]} ✕
              </button>
            ))
          )}
        </div>
        <div className="ls-sequence-add">
          <button className="ls-seq-add-btn" onClick={() => addStep('word')}>+ Word</button>
          <button className="ls-seq-add-btn" onClick={() => addStep('translation')}>+ Translation</button>
          <button className="ls-seq-add-btn" onClick={() => addStep('sentence')}>+ Sentence</button>
          {(sequence.length !== DEFAULT_SEQUENCE.length || sequence.some((s, i) => s !== DEFAULT_SEQUENCE[i])) && (
            <button className="ls-seq-reset-btn" onClick={resetSequence}>Reset</button>
          )}
        </div>
      </div>

      <div className="ls-speed">
        <span className="ls-speed-label">Speed</span>
        <input
          type="range"
          min="0.5"
          max="1.5"
          step="0.1"
          value={speechRate}
          onChange={e => setSpeechRate(parseFloat(e.target.value))}
          className="ls-speed-slider"
        />
        <span className="ls-speed-value">{speechRate.toFixed(1)}×</span>
      </div>

      {queue.length === 0 ? (
        <p className="ls-empty">
          {boxMode === 'all'
            ? 'No unmastered words in the current filter — nothing left to review here.'
            : `No words in box ${boxMode} for the current filter.`}
        </p>
      ) : (
        <>
          <div className="ls-progress">Word {index + 1} of {queue.length}{boxMode === 'all' ? ` · box ${currentEntry?._box}` : ''}</div>

          <div className="ls-card">
            <div className={`ls-line ls-word ${phase === 'word' ? 'active' : ''}`}>
              <RubyText text={prompt?.main} reading={prompt?.sub} visible={!!prompt?.sub} size="lg" />
            </div>
            <div className={`ls-line ls-translation ${phase === 'translation' ? 'active' : ''}`}>
              {currentEntry?.translation[0]}
            </div>
            {sentence && (
              <div className={`ls-line ls-sentence ${phase === 'sentence' ? 'active' : ''}`}>
                {sentence}
              </div>
            )}
          </div>

          <div className="ls-controls">
            <button className="ls-ctrl-btn" onClick={() => handleSkip(-1)} aria-label="Previous">⏮</button>
            {sequence.length === 0 ? (
              <span className="ls-ctrl-disabled-note">Add an item above to play</span>
            ) : playing ? (
              <button className="ls-ctrl-btn ls-play-btn" onClick={handlePause} aria-label="Pause">⏸</button>
            ) : (
              <button className="ls-ctrl-btn ls-play-btn" onClick={handlePlay} aria-label="Play">▶</button>
            )}
            <button className="ls-ctrl-btn" onClick={() => handleSkip(1)} aria-label="Next">⏭</button>
          </div>
        </>
      )}
    </div>
  )
}
