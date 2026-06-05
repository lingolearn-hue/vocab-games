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
  { id: 'en-en', path: './vocab/en-en.json', label: 'English Reading',   language: 'en', languageLabel: 'English 🇬🇧',    sentencePath: './sentences/en-en.json' },
]

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [loadedLists,     setLoadedLists]     = useState({})
  const [vocabLoading,    setVocabLoading]    = useState(false)
  const [loadedSentences, setLoadedSentences] = useState({})
  const [selectedIds,     setSelectedIds]     = useState([])
  const [activeEntries,   setActiveEntries]   = useState([])
  // Adventure mode: when set, games use these entries instead of activeEntries
  const [sessionEntries,  setSessionEntries]  = useState(null)
  const [screen,          setScreenRaw]       = useState('setup')
  const [screenHistory,   setScreenHistory]   = useState(['setup'])

  // setScreen with history tracking
  const setScreen = useCallback((next) => {
    setScreenRaw(next)
    setScreenHistory(h => {
      if (h[h.length - 1] === next) return h   // no duplicate
      return [...h, next]
    })
  }, [])

  // Go back to the previous screen in the history stack
  const goBack = useCallback(() => {
    setScreenHistory(h => {
      if (h.length <= 1) return h
      const prev = h[h.length - 2]
      setScreenRaw(prev)
      return h.slice(0, -1)
    })
  }, [])
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
    if (!lang) { setSelectedIds([]); setVocabLoading(false); return }
    const listsForLang = AVAILABLE_LISTS.filter(l => l.language === lang)
    setVocabLoading(true)
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
    setVocabLoading(false)
  }, [loadedLists])

  // On mount: if a language was previously selected, load it
  useEffect(() => {
    const saved = localStorage.getItem('activeLanguage')
    if (saved) setActiveLanguage(saved)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Derive direction from answerFields — this is what Settings actually writes to
  const direction = useMemo(() => {
    const { prompt, answer } = settings.answerFields?.global ?? { prompt: 'entry', answer: 'translation' }
    if (prompt === 'translation' || answer === 'entry') return 'translation->entry'
    return 'entry->translation'
  }, [settings.answerFields])
  const showReading  = settings.showReading
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
  // When sessionEntries is set (adventure mode), use those instead
  const getEntriesForGame = useCallback((game) => {
    const base = sessionEntries ?? activeEntries
    const levels = sessionEntries ? null : getGameLevels(settings, game)
    const filtered = filterByLevel(base, levels)
    return { entries: filtered.length > 0 ? filtered : base, isEmpty: filtered.length === 0 && levels !== null }
  }, [activeEntries, sessionEntries, settings])

  // Sorted unique levels present in the active entries — canonical order per language
  const availableLevels = useMemo(() => {
    const LEVEL_ORDER = {
      zh: ['HSK1','HSK2','HSK3','HSK4','HSK5','HSK6'],
      ja: ['N5','N4','N3','N2','N1'],
      de: ['A1','A2','B1','B2','C1','C2'],
      es: ['A1','A2','B1','B2','C1','C2'],
      en: ['A1','A2','B1','B2','C1','C2'],
    }
    const set = new Set(activeEntries.map(e => e.level).filter(Boolean))
    const order = LEVEL_ORDER[activeLanguage] ?? []
    const ordered = order.filter(l => set.has(l))
    // Add any levels not in the canonical list (future-proof)
    const extra = [...set].filter(l => !order.includes(l)).sort()
    return [...ordered, ...extra]
  }, [activeEntries, activeLanguage])

  const refreshScores = useCallback(() => setScores(getAllScores()), [])

  const activeSentences = selectedIds.reduce((acc, id) => {
    const s = loadedSentences[id]
    if (!s) return acc
    // Support new flat `sentences` array and legacy `fixed` array
    const sentences = s.sentences ?? s.fixed ?? []
    return [...acc, ...sentences]
  }, [])

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
      activeEntries, sessionEntries, setSessionEntries, vocabLoading,
      activeSentences,
      direction,
      showReading, setShowReading,
      screen, setScreen, goBack,
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
