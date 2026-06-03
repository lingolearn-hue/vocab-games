import { useState } from 'react'
import { speak, isSupported } from '../engine/speech'
import './SpeakButton.css'

/**
 * Small 🔊 button that speaks the given text.
 * size: 'sm' | 'md' | 'lg'
 */
export default function SpeakButton({ text, language, size = 'md', className = '' }) {
  const [speaking, setSpeaking] = useState(false)

  if (!isSupported() || !text || !language) return null

  function handleSpeak(e) {
    e.stopPropagation()
    setSpeaking(true)
    speak(text, language)
    // Visual feedback for ~1.5s
    setTimeout(() => setSpeaking(false), 1500)
  }

  return (
    <button
      className={`speak-btn speak-btn--${size} ${speaking ? 'speaking' : ''} ${className}`}
      onClick={handleSpeak}
      title={`Listen: ${text}`}
      aria-label="Speak"
    >
      🔊
    </button>
  )
}
