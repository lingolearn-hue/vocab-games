import { useApp } from '../context/AppContext'
import CategoryChooser from './CategoryChooser'

// Thin wrapper: drives the shared CategoryChooser from the global
// settings.categories.global filter, scoped to the currently visible
// (level-filtered, vulgar-filtered) entries — mirrors LevelChips.
export default function CategoryChips({ entries }) {
  const { settings, updateSettings, activeLanguage } = useApp()

  const activeCategories = settings.categories?.global ?? null

  function handleChange(next) {
    updateSettings(s => ({ ...s, categories: { ...s.categories, global: next } }))
  }

  return <CategoryChooser entries={entries} value={activeCategories} onChange={handleChange} lang={activeLanguage} />
}
