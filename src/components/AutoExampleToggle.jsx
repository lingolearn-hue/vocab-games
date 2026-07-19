import { useApp } from '../context/AppContext'
import './ReadingToggle.css'

/**
 * When enabled, marking a card Unknown automatically opens the example
 * sentence (in the detail panel) before advancing to the next card, instead
 * of advancing immediately.
 */
export default function AutoExampleToggle() {
  const { autoExampleOnUnknown, setAutoExampleOnUnknown } = useApp()
  return (
    <button
      className={`reading-toggle ${autoExampleOnUnknown ? 'active' : ''}`}
      onClick={() => setAutoExampleOnUnknown(v => !v)}
      title={autoExampleOnUnknown ? 'Stop auto-showing example on Unknown' : 'Auto-show example sentence on Unknown'}
    >
      📝
    </button>
  )
}
