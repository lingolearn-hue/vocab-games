import ChipRow from './ChipRow'
import './ChipRow.css'

/**
 * Generic multi-select chip chooser for any small, fixed set of values
 * (levels, parts of speech, etc). This is the one central place the
 * "toggle chip filter" behavior is implemented; specialized wrappers like
 * LevelChooser and CategoryChooser just supply the value list and a label function.
 *
 * Contract:
 *  - `value` is either `null` (meaning "everything active / no filter") or
 *    an array of the currently-selected values.
 *  - Clicking a chip while everything is active (`value` is `null`, *or*
 *    happens to already list every option) narrows the selection to just
 *    that one value — "all selected" and "no filter" are the same state
 *    from the user's point of view, so they behave the same on click.
 *  - Clicking an already-selected chip (with something else also active)
 *    removes it; if that empties the selection, it collapses back to
 *    `null` rather than an empty array, so the UI never shows "everything
 *    is off".
 *  - Selecting every available chip one-by-one also collapses back to
 *    `null`, for the same reason.
 *
 * Chips are auto-scaled (via ChipRow) to always fit on one row.
 *
 * `prefixChip`: optional extra node rendered before the mapped options,
 * inside the same ChipRow — so it scales together with the chips instead
 * of sitting outside the row's auto-fit measurement. Used by
 * CategoryChooser for its leaf-level "clear filter" button.
 */
export default function ChoiceChips({ options, value, onChange, getLabel = String, chipClassName = 'level-chip', className = 'level-filter', prefixChip = null }) {
  if (!options?.length) return null

  const allActive = !value || value.length === options.length

  function isActive(opt) {
    return allActive || value.includes(opt)
  }

  function toggle(opt) {
    if (allActive) {
      onChange([opt])
      return
    }
    let next
    if (value.includes(opt)) {
      const filtered = value.filter(o => o !== opt)
      next = filtered.length === 0 ? null : filtered
    } else {
      const merged = [...value, opt]
      next = merged.length === options.length ? null : merged
    }
    onChange(next)
  }

  return (
    <ChipRow className={className}>
      {prefixChip}
      {options.map(opt => (
        <button
          key={opt}
          className={`${chipClassName} ${isActive(opt) ? 'active' : ''}`}
          onClick={() => toggle(opt)}
        >
          {getLabel(opt)}
        </button>
      ))}
    </ChipRow>
  )
}
