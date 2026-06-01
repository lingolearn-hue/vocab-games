import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { loadList, mergeLists, loadSentences } from '../engine/vocab'
import { getAllScores, setScore, recordCorrect, recordWrong, recordMaster, resetToLearning } from '../engine/srs'
import { loadSettings, saveSettings, applyDarkMode, getGameLevels, filterByLevel } from '../engine/settings'
import { seedMnemonics } from '../engine/mnemonics'

const AVAILABLE_LISTS = [
  { id: 'zh-en', path: './vocab/zh-en.json', label: 'Chinese → English', language: 'zh', languageLabel: 'Chinese 🇨🇳',    sentencePath: './sentences/zh-en.json' },
  { id: 'es-en', path: './vocab/es-en.json', label: 'Spanish → English', language: 'es', languageLabel: 'Spanish 🇪🇸',    sentencePath: './sentences/es-en.json' },
  { id: 'de-en', path: './vocab/de-en.json', label: 'German → English',  language: 'de', languageLabel: 'German 🇩🇪',     sentencePath: './sentences/de-en.json' },
  { id: 'ja-en', path: './vocab/ja-en.json', label: 'Japanese → English',language: 'ja', languageLabel: 'Japanese 🇯🇵',   sentencePath: './sentences/ja-en.json' },
]

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [loadedLists,     setLoadedLists]     = useState({})
  const [loadedSentences, setLoadedSentences] = useState({})
  const [selectedIds,     setSelectedIds]     = useState([])
  const [activeEntries,   setActiveEntries]   = useState([])
  const [screen,          setScreen]          = useState('setup')
  const [scores,          setScores]          = useState(getAllScores)
  const [activeLanguage,  setActiveLanguageState] = useState(
    () => localStorage.getItem('activeLanguage') || null
  )
  const [settings,        setSettingsState]   = useState(() => {
    const s = loadSettings()
    applyDarkMode(s.darkMode)
    return s
  })

  // When language changes, auto-load and select all lists for that language
  const setActiveLanguage = useCallback(async (lang) => {
    setActiveLanguageState(lang)
    localStorage.setItem('activeLanguage', lang ?? '')
    if (!lang) { setSelectedIds([]); return }
    const listsForLang = AVAILABLE_LISTS.filter(l => l.language === lang)
    // Load all in parallel, then select
    await Promise.all(listsForLang.map(async def => {
      if (!loadedLists[def.id]) {
        const list = await loadList(def.path)
        setLoadedLists(prev => ({ ...prev, [def.id]: list }))
        seedMnemonics(def.id, list.entries)
        if (def.sentencePath) {
          loadSentences(def.sentencePath)
            .then(s => setLoadedSentences(prev => ({ ...prev, [def.id]: s })))
            .catch(() => {})
        }
      }
    }))
    setSelectedIds(listsForLang.map(l => l.id))
  }, [loadedLists])

  // On mount: if a language was previously selected, load it
  useEffect(() => {
    const saved = localStorage.getItem('activeLanguage')
    if (saved) setActiveLanguage(saved)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const direction    = settings.direction
  const showReading  = settings.showReading
  const setDirection   = (v) => updateSettings(s => ({ ...s, direction: v }))
  const setShowReading = (v) => updateSettings(s => ({ ...s, showReading: typeof v === 'function' ? v(s.showReading) : v }))

  function updateSettings(updater) {
    setSettingsState(prev => {
      const next = updater(prev)
      saveSettings(next)
      applyDarkMode(next.darkMode)
      return next
    })
  }

  const ensureLoaded = useCallback(async (listDef) => {
    if (loadedLists[listDef.id]) return loadedLists[listDef.id]
    const list = await loadList(listDef.path)
    setLoadedLists(prev => ({ ...prev, [listDef.id]: list }))
    seedMnemonics(listDef.id, list.entries)  // populate starter mnemonics (no-op if already done)
    if (listDef.sentencePath && !loadedSentences[listDef.id]) {
      loadSentences(listDef.sentencePath)
        .then(s => setLoadedSentences(prev => ({ ...prev, [listDef.id]: s })))
        .catch(() => {})
    }
    return list
  }, [loadedLists, loadedSentences])

  useEffect(() => {
    const selected = selectedIds.map(id => loadedLists[id]).filter(Boolean)
    setActiveEntries(mergeLists(selected))
  }, [selectedIds, loadedLists])

  // Helper used by each game to get level-filtered entries
  // Returns { entries, isEmpty } — isEmpty signals the warning state
  const getEntriesForGame = useCallback((game) => {
    const levels  = getGameLevels(settings, game)
    const filtered = filterByLevel(activeEntries, levels)
    return { entries: filtered.length > 0 ? filtered : activeEntries, isEmpty: filtered.length === 0 && levels !== null }
  }, [activeEntries, settings])

  // Sorted unique levels present in the active entries
  const availableLevels = useMemo(() => {
    const set = new Set(activeEntries.map(e => e.level).filter(Boolean))
    return [...set].sort()
  }, [activeEntries])

  const refreshScores = useCallback(() => setScores(getAllScores()), [])

  const activeSentences = selectedIds.reduce((acc, id) => {
    const s = loadedSentences[id]
    if (!s) return acc
    return {
      fixed:   [...(acc.fixed   || []), ...(s.fixed   || [])],
      generic: [...(acc.generic || []), ...(s.generic || [])],
    }
  }, { fixed: [], generic: [] })

  const scoreActions = {
    correct: (id, game) => { recordCorrect(id, game);  refreshScores() },
    wrong:   (id, game) => { recordWrong(id, game);    refreshScores() },
    master:  (id)       => { recordMaster(id);         refreshScores() },
    reset:   (id)       => { resetToLearning(id);      refreshScores() },
    set:     (id, val)  => { setScore(id, val);        refreshScores() },
    // legacy shim
    adjust:  (id, delta, game) => {
      delta > 0 ? recordCorrect(id, game || 'flashcard') : recordWrong(id, game || 'flashcard')
      refreshScores()
    },
  }

  return (
    <AppContext.Provider value={{
      availableLists: AVAILABLE_LISTS,
      loadedLists,
      selectedIds, setSelectedIds,
      ensureLoaded,
      activeEntries,
      activeSentences,
      direction, setDirection,
      showReading, setShowReading,
      screen, setScreen,
      scores, scoreActions,
      settings, updateSettings,
      activeLanguage, setActiveLanguage,
      getEntriesForGame, availableLevels,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
