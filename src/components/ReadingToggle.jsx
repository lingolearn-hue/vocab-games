import { useApp } from '../context/AppContext'
import './ReadingToggle.css'

export default function ReadingToggle() {
  const { showReading, setShowReading } = useApp()
  return (
    <button
      className={`reading-toggle ${showReading ? 'active' : ''}`}
      onClick={() => setShowReading(r => !r)}
      title={showReading ? 'Hide reading' : 'Show reading'}
    >
      {showReading ? 'ふ' : '子'}
    </button>
  )
}
