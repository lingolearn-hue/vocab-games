import { useMemo } from 'react'
import { useApp } from '../context/AppContext'

const LEVEL_ORDER = {
  zh: ['HSK1','HSK2','HSK3','HSK4','HSK5','HSK6'],
  ja: ['N5','N4','N3','N2','N1'],
  de: ['A1','A2','B1','B2','C1','C2'],
  es: ['A1','A2','B1','B2','C1','C2'],
  fr: ['A1','A2','B1','B2','C1','C2'],
  en: ['A1','A2','B1','B2','C1','C2'],
}

export default function LevelChips() {
  const { activeEntries, activeLanguage, settings, updateSettings } = useApp()

  const orderedLevels = useMemo(() => {
    const order   = LEVEL_ORDER[activeLanguage] ?? []
    const present = new Set(activeEntries.map(e => e.level).filter(Boolean))
    return order.filter(l => present.has(l))
  }, [activeLanguage, activeEntries])

  const activeLevels = settings.levels?.global ?? null

  function isActive(level) {
    return !activeLevels || activeLevels.includes(level)
  }

  function toggle(level) {
    updateSettings(s => {
      const cur = s.levels?.global ?? null
      let next
      if (!cur) {
        next = [level]
      } else if (cur.includes(level)) {
        const filtered = cur.filter(l => l !== level)
        next = filtered.length === 0 ? null : filtered
      } else {
        const merged = [...cur, level]
        next = merged.length === orderedLevels.length ? null : merged
      }
      return { ...s, levels: { ...s.levels, global: next } }
    })
  }

  if (orderedLevels.length === 0) return null

  return (
    <div className="level-filter">
      {orderedLevels.map(level => (
        <button
          key={level}
          className={`level-chip ${isActive(level) ? 'active' : ''}`}
          onClick={() => toggle(level)}
        >
          {level}
        </button>
      ))}
    </div>
  )
}
