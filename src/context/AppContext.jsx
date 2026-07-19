import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { loadList, mergeLists, loadSentences } from '../engine/vocab'
import { getAllScores, setScore, recordCorrect, recordWrong, recordMaster, resetToLearning } from '../engine/srs'
import { loadSettings, saveSettings, applyDarkMode, getGameLevels, filterByLevel, filterByCategory, LEVEL_ORDER } from '../engine/settings'
import { seedMnemonics } from '../engine/mnemonics'

const AVAILABLE_LISTS = [
  { id: 'zh-en', path: './vocab/zh-en.json', label: 'Chinese → English', language: 'zh', languageLabel: 'Chinese 🇨🇳',    sentencePath: './sentences/zh-en.json' },
  { id: 'es-en', path: './vocab/es-en.json', label: 'Spanish → English', language: 'es', languageLabel: 'Spanish 🇪🇸',    sentencePath: './sentences/es-en.json' },
  { id: 'de-en', path: './vocab/de-en.json', label: 'German → English',  language: 'de', languageLabel: 'German 🇩🇪',     sentencePath: './sentences/de-en.json' },
  { id: 'fr-en', path: './vocab/fr-en.json', label: 'French → English',  language: 'fr', languageLabel: 'French 🇫🇷',     sentencePath: './sentences/fr-en.json' },
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
  const [, setScreenHistory]   = useState(['setup'])

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore of persisted selection on mount
    if (saved) setActiveLanguage(saved)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Derive direction from answerFields — this is what Settings actually writes to
  const direction = useMemo(() => {
    const { prompt, answer } = settings.answerFields?.global ?? { prompt: 'entry', answer: 'translation' }
    if (prompt === 'translation' || answer === 'entry') return 'translation->entry'
    return 'entry->translation'
  }, [settings.answerFields])
  const showReading  = settings.showReading
  const setShowReading = (v) => updateSettings(s => ({
    ...s,
    showReading: typeof v === 'function' ? v(s.showReading) : v,
    facetsByBox: false,  // manual toggle takes over — box-driven facets would fight it
  }))

  const readingOnly  = settings.readingOnly ?? false
  const setReadingOnly = (v) => updateSettings(s => ({
    ...s,
    readingOnly: typeof v === 'function' ? v(s.readingOnly) : v,
    facetsByBox: false,
  }))

  const autoExampleOnUnknown = settings.autoExampleOnUnknown ?? false
  const setAutoExampleOnUnknown = (v) => updateSettings(s => ({ ...s, autoExampleOnUnknown: typeof v === 'function' ? v(s.autoExampleOnUnknown) : v }))

  // "Train all facets" mode: each box (2/3/4/5) drives its own display facet
  // for that card (see engine/facets.js) instead of the manual toggles.
  // Turning it on resets direction/reading/readingOnly to their defaults so
  // there's no leftover manual state fighting the box-driven facet; turning
  // any manual toggle back on (above) turns this back off.
  const facetsByBox = settings.facetsByBox ?? false
  const setFacetsByBox = (v) => updateSettings(s => {
    const next = typeof v === 'function' ? v(s.facetsByBox ?? false) : v
    if (!next) return { ...s, facetsByBox: false }
    return {
      ...s,
      facetsByBox: true,
      showReading: true,
      readingOnly: false,
      answerFields: { ...s.answerFields, global: { prompt: 'entry', answer: 'translation' } },
    }
  })

  // Quick swap of prompt/answer direction — writes straight to the same
  // answerFields.global settings the Settings screen uses, so it's a
  // persisted global toggle, not a per-session override.
  function toggleDirection() {
    updateSettings(s => {
      const cur = s.answerFields?.global ?? { prompt: 'entry', answer: 'translation' }
      const swapped = cur.prompt === 'translation' || cur.answer === 'entry'
        ? { prompt: 'entry', answer: 'translation' }
        : { prompt: 'translation', answer: 'entry' }
      return { ...s, answerFields: { ...s.answerFields, global: swapped }, facetsByBox: false }
    })
  }

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs derived entries when selection/lists change
    setActiveEntries(mergeLists(selected))
  }, [selectedIds, loadedLists])

  // Helper used by each game to get level-filtered entries
  // When sessionEntries is set (adventure mode), use those instead

  const showVulgar = settings.showVulgar ?? false
  const setShowVulgar = (v) => updateSettings(s => ({ ...s, showVulgar: typeof v === 'function' ? v(s.showVulgar ?? false) : v }))

  // activeEntries stays the raw merged list (used internally, e.g. so
  // recordMasterAll always sees the full word set regardless of the filter).
  // visibleEntries is what display/browsing screens (Setup stats, Vocab
  // Browser, Stats) should show — same vulgar-content filtering
  // getEntriesForGame applies for the games themselves.
  const vulgarFilteredEntries = useMemo(
    () => showVulgar ? activeEntries : activeEntries.filter(e => !e.categories?.includes('vulgar')),
    [activeEntries, showVulgar]
  )

  const visibleEntries = useMemo(
    () => filterByCategory(vulgarFilteredEntries, settings.categories?.global),
    [vulgarFilteredEntries, settings.categories]
  )

  // Filters out entries tagged 'vulgar' (profanity/sensitive-biological terms;
  // see TODO.md / chat history) unless the person has opted in via Settings.
  // Identity-based slurs were removed from the vocab data outright instead
  // of being tag-filterable — this toggle only ever gates profanity/mature
  // content, not slurs.
  const getEntriesForGame = useCallback((game) => {
    const base = sessionEntries ?? activeEntries
    const clean = showVulgar ? base : base.filter(e => !e.categories?.includes('vulgar'))
    const withCategory = filterByCategory(clean, settings.categories?.global)
    const levels = sessionEntries ? null : getGameLevels(settings, game)
    const filtered = filterByLevel(withCategory, levels)
    return { entries: filtered.length > 0 ? filtered : withCategory, isEmpty: filtered.length === 0 && levels !== null }
  }, [activeEntries, sessionEntries, settings, showVulgar])

  // Sorted unique levels present in the active entries — canonical order per language
  const availableLevels = useMemo(() => {
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
      visibleEntries,
      vulgarFilteredEntries,
      activeSentences,
      direction,
      showReading, setShowReading,
      readingOnly, setReadingOnly,
      facetsByBox, setFacetsByBox,
      autoExampleOnUnknown, setAutoExampleOnUnknown,
      toggleDirection,
      screen, setScreen, goBack,
      scores, scoreActions,
      settings, updateSettings,
      activeLanguage, setActiveLanguage,
      getEntriesForGame, availableLevels,
      showVulgar, setShowVulgar,
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
