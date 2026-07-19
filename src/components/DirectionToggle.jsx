import { useApp } from '../context/AppContext'
import './ReadingToggle.css'

/**
 * Swaps which side is the prompt vs. the answer (word <-> translation).
 * Persisted globally, same as ReadingToggle — writes to settings.answerFields.global.
 */
export default function DirectionToggle() {
  const { direction, toggleDirection } = useApp()
  const swapped = direction === 'translation->entry'
  return (
    <button
      className={`reading-toggle ${swapped ? 'active' : ''}`}
      onClick={toggleDirection}
      title={swapped ? 'Show word first' : 'Show translation first'}
    >
      ⇄
    </button>
  )
}
