import { levelLabel } from '../engine/settings'
import ChoiceChips from './ChoiceChips'

// HSK labels ("HSK1", "HSK7-9") get a line break between "HSK" and the
// number — keeps the chip narrow instead of stretching to fit "HSK7-9" on
// one line.
function formatLevelLabel(level) {
  const raw = levelLabel(level)
  const match = /^(HSK)(.+)$/.exec(raw)
  if (!match) return raw
  return <>{match[1]}<br />{match[2]}</>
}

/**
 * Level-specific specialization of the shared ChoiceChips chooser, used
 * everywhere the app lets someone filter by level (Setup, Stats, Settings,
 * Graded Reader, Grammar Trainer, Grammar Dictionary). See ChoiceChips for
 * the toggle behavior contract.
 */
export default function LevelChooser({ levels, value, onChange, className = 'level-filter' }) {
  return (
    <ChoiceChips
      options={levels}
      value={value}
      onChange={onChange}
      getLabel={formatLevelLabel}
      chipClassName="level-chip"
      className={className}
    />
  )
}
