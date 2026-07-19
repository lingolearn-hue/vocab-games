import { useApp } from '../context/AppContext'
import './ReadingToggle.css'

/**
 * Replaces the character word (hanzi/kanji) with its reading only
 * (pinyin/kana) — a stronger mode than ReadingToggle's furigana-style
 * annotation, which keeps the characters and adds reading above them.
 * Only meaningful for zh/ja, so callers should only render this when
 * language is one of those. Icon is static (antiparallel arrows); active
 * state is shown via the 'active' class, same pattern as DirectionToggle.
 */
export default function ReadingOnlyToggle() {
  const { readingOnly, setReadingOnly } = useApp()
  return (
    <button
      className={`reading-toggle ${readingOnly ? 'active' : ''}`}
      onClick={() => setReadingOnly(v => !v)}
      title={readingOnly ? 'Show characters' : 'Show reading only (no characters)'}
    >
      ⇵
    </button>
  )
}
