import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { LEVEL_ORDER } from '../engine/settings'
import LevelChooser from './LevelChooser'

// Thin wrapper: drives the shared LevelChooser from the global settings.levels.global
// filter, scoped to whichever levels are actually present in the active vocab list.
export default function LevelChips() {
  const { activeEntries, activeLanguage, settings, updateSettings } = useApp()

  const orderedLevels = useMemo(() => {
    const order   = LEVEL_ORDER[activeLanguage] ?? []
    const present = new Set(activeEntries.map(e => e.level).filter(Boolean))
    return order.filter(l => present.has(l))
  }, [activeLanguage, activeEntries])

  const activeLevels = settings.levels?.global ?? null

  function handleChange(next) {
    updateSettings(s => ({ ...s, levels: { ...s.levels, global: next } }))
  }

  return <LevelChooser levels={orderedLevels} value={activeLevels} onChange={handleChange} />
}
