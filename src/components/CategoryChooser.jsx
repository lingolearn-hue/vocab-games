import { useMemo } from 'react'
import { CATEGORY_TREE, LEAF_INFO, resolveLabel } from '../engine/categories'
import ChipRow from './ChipRow'
import ChoiceChips from './ChoiceChips'
import './ChipRow.css'

/**
 * Two-level topic filter: a parent row (Nature, People, Life, ...) plus an
 * on-demand leaf row that only appears once a parent is active, letting you
 * drill from "Nature" down to just "Animals".
 *
 * `value` is the flat array of selected LEAF ids (or null = no filter) —
 * the same shape filterByCategory/settings.categories.global expects.
 * `lang` selects which language the chip labels are shown in (the target
 * language being studied), falling back to English if untranslated.
 *
 * Parent row is single-select: tapping a parent selects its full leaf set,
 * replacing whatever was active before; tapping the already-active parent
 * again clears back to no filter. Only one parent can be drilled into at a
 * time, so there's no "clear filter" button needed at this level — the
 * toggle-off IS the clear action.
 *
 * Leaf row (shown once a parent is active) stays multi-select — narrowing
 * within a topic (e.g. Animals + Plants within Nature) is still useful —
 * and gets its own "✕" chip to jump straight back to no filter at all.
 */
export default function CategoryChooser({ entries, value, onChange, lang = 'en', className = 'category-filter' }) {
  const presentLeaves = useMemo(() => {
    const set = new Set()
    for (const e of entries) for (const c of (e.categories ?? [])) set.add(c)
    return set
  }, [entries])

  const parents = useMemo(
    () => CATEGORY_TREE
      .map(p => ({ ...p, leaves: p.leaves.filter(l => presentLeaves.has(l.id)) }))
      .filter(p => p.leaves.length > 0),
    [presentLeaves]
  )

  if (parents.length === 0) return null

  const activeParent = parents.find(p => p.leaves.some(l => value?.includes(l.id))) ?? null

  function toggleParent(parent) {
    if (parent === activeParent) {
      onChange(null)
      return
    }
    onChange(parent.leaves.map(l => l.id))
  }

  return (
    <div className={className}>
      <ChipRow className={`${className}-parents`}>
        {parents.map(p => (
          <button
            key={p.id}
            className={`level-chip ${p === activeParent ? 'active' : ''}`}
            onClick={() => toggleParent(p)}
          >
            {resolveLabel(p.labels, lang)}
          </button>
        ))}
      </ChipRow>

      {activeParent && (
        <ChoiceChips
          options={activeParent.leaves.map(l => l.id)}
          value={value}
          onChange={onChange}
          getLabel={id => resolveLabel(LEAF_INFO[id].leafLabels, lang)}
          chipClassName="level-chip category-leaf-chip"
          className={`${className}-leaves`}
          prefixChip={
            <button
              className="level-chip category-clear-chip"
              onClick={() => onChange(null)}
              aria-label="Clear topic filter"
            >
              ✕
            </button>
          }
        />
      )}
    </div>
  )
}
