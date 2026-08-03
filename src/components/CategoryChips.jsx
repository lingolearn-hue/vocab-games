import { useApp } from '../context/AppContext'
import CategoryChooser from './CategoryChooser'

// Thin wrapper: drives the shared CategoryChooser from
// settings.categories[activeLanguage], scoped to the currently visible
// (level-filtered, vulgar-filtered) entries — mirrors LevelChips. Keyed per
// language (not a single shared slot) so switching languages doesn't carry
// one language's topic filter over onto another — each language remembers
// its own filter independently, resetting to "no filter" the first time you
// visit a language rather than showing whatever the previous language had.
export default function CategoryChips({ entries }) {
  const { settings, updateSettings, activeLanguage } = useApp()

  const activeCategories = settings.categories?.[activeLanguage] ?? null

  function handleChange(next) {
    updateSettings(s => ({ ...s, categories: { ...s.categories, [activeLanguage]: next } }))
  }

  return <CategoryChooser entries={entries} value={activeCategories} onChange={handleChange} lang={activeLanguage} />
}
