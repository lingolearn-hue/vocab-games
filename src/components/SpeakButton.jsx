import { useState } from 'react'
import { speak, isSupported } from '../engine/speech'
import './SpeakButton.css'

/**
 * Small 🔊 button that speaks the given text.
 * size: 'sm' | 'md' | 'lg'
 *
 * If the Web Speech API isn't available (some in-app browsers like WeChat's,
 * older Android WebViews, privacy-hardened browsers strip it out), the
 * button still renders — greyed out — rather than silently disappearing.
 * A vanished button with no explanation reads as a bug report ("the left
 * button doesn't show up on my phone"); a visibly-disabled one with a tap
 * explanation reads as an understood platform limitation instead.
 */
export default function SpeakButton({ text, language, size = 'md', className = '' }) {
  const [speaking, setSpeaking] = useState(false)
  const [showHint, setShowHint] = useState(false)

  if (!text || !language) return null

  const supported = isSupported()

  function handleClick(e) {
    e.stopPropagation()
    if (!supported) {
      setShowHint(v => !v)
      return
    }
    setSpeaking(true)
    speak(text, language)
    // Visual feedback for ~1.5s
    setTimeout(() => setSpeaking(false), 1500)
  }

  return (
    <span className="speak-btn-wrap">
      <button
        className={`speak-btn speak-btn--${size} ${speaking ? 'speaking' : ''} ${!supported ? 'unsupported' : ''} ${className}`}
        onClick={handleClick}
        title={supported ? `Listen: ${text}` : 'Audio not available on this device'}
        aria-label={supported ? 'Speak' : 'Audio unavailable — tap for details'}
      >
        🔊
      </button>
      {showHint && (
        <span className="speak-btn-hint" onClick={e => e.stopPropagation()}>
          <strong>Audio isn't available on this device.</strong>
          <span>Possible reasons:</span>
          <ul>
            <li>Your browser doesn't support text-to-speech</li>
            <li>You're in an in-app browser (e.g. WeChat, Instagram) — try opening this site in Chrome or Safari directly</li>
            <li>No voices are installed for this language</li>
          </ul>
          <button className="speak-btn-hint-close" onClick={() => setShowHint(false)}>Got it</button>
        </span>
      )}
    </span>
  )
}
