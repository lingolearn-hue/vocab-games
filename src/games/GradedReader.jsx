import { useState, useEffect, useMemo, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { buildLookup, tokenise, loadReaderPassages, loadSurfaceForms, splitSentences } from '../engine/reader'
import { speakAndWait, stop as stopSpeech, isSupported as speechSupported } from '../engine/speech'
import { TextWithLookup } from '../components/TextWithLookup'
import LevelChooser from '../components/LevelChooser'
import HelpButton from '../components/HelpButton'
import './GradedReader.css'

// Tags that get a display label; others shown as-is
const TAG_LABELS = {
  'fiction':     'Fiction',
  'non-fiction': 'Non-fiction',
  'biography':   'Biography',
  'essay':       'Essay',
  'beginner':    'Beginner',
  'intermediate':'Intermediate',
  'advanced':    'Advanced',
}

// Library filter chips — kept to a short, fixed set rather than every tag
// in the data (which included a long, unpredictable tail of topic: tags
// and made the filter row overflow/scroll awkwardly). More granular
// filtering (the two-row type+topic approach used on the vocab front page)
// is a possible later addition, not this pass.
const READER_TAG_FILTERS = [
  { tag: 'fiction', label: 'Fiction' },
  { tag: 'non-fiction', label: 'Non-fiction' },
  { tag: 'genre:fairytale', label: 'Fairy tale' },
]

// Read-aloud pacing: a short breather between sentences so playback doesn't
// run sentences together with zero gap, which reads too rushed to actually
// follow along with the text on screen.
const SENTENCE_PAUSE_MS = 500

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Screen Wake Lock — keeps the screen from dimming/locking while a passage
// is being read aloud, since there's no touch input during hands-free
// playback to reset the OS's own idle timer. Best-effort: silently no-ops
// on unsupported browsers or if permission is denied, since losing the
// wake lock just means the screen can dim again, not a broken feature.
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) return await navigator.wakeLock.request('screen')
  } catch {
    // unsupported, denied, or page not visible — fine, just no wake lock
  }
  return null
}

function releaseWakeLock(lock) {
  try { lock?.release?.() } catch { /* already released */ }
}

function tagLabel(tag) {
  if (TAG_LABELS[tag]) return TAG_LABELS[tag]
  if (tag.startsWith('topic:'))  return tag.slice(6).replace(/-/g, ' ')
  if (tag.startsWith('series:')) return tag.slice(7)
  return tag
}

const CUSTOM_PASSAGE_KEY = 'vocabCustomPassage'
const FINISHED_KEY = 'vocabFinishedPassages'
const LAST_PASSAGE_KEY = 'vocabLastPassage'
const READER_PREFS_KEY = 'vocabReaderPrefs' // per-language: { level, tags, hideFinished }

function loadReaderPrefs(language) {
  try {
    const all = JSON.parse(localStorage.getItem(READER_PREFS_KEY) || '{}')
    return all[language] || null
  } catch {
    return null
  }
}

function saveReaderPrefs(language, prefs) {
  try {
    const all = JSON.parse(localStorage.getItem(READER_PREFS_KEY) || '{}')
    all[language] = prefs
    localStorage.setItem(READER_PREFS_KEY, JSON.stringify(all))
  } catch { /* storage unavailable — prefs just won't persist */ }
}

function loadLastPassage() {
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_PASSAGE_KEY) || 'null')
    return saved && typeof saved === 'object' && saved.id ? saved : null
  } catch {
    return null
  }
}

function loadFinishedPassages() {
  try {
    const saved = JSON.parse(localStorage.getItem(FINISHED_KEY) || '[]')
    return new Set(Array.isArray(saved) ? saved : [])
  } catch {
    return new Set()
  }
}

function loadSavedCustomPassage() {
  try {
    const saved = JSON.parse(localStorage.getItem(CUSTOM_PASSAGE_KEY) || 'null')
    return saved && typeof saved === 'object' ? saved : { title: '', text: '' }
  } catch {
    return { title: '', text: '' }
  }
}

export default function GradedReader() {
  const { activeEntries, loadedLists, selectedIds, showReading, scores, goBack, activeLanguage, setScreen, setSessionEntries, settings } = useApp()

  const [passages,        setPassages]        = useState([])
  const [surfaceForms,    setSurfaceForms]     = useState({})
  const [loading,         setLoading]         = useState(true)
  const [activePassage,   setActivePassage]   = useState(null)
  const [pastedText,      setPastedText]      = useState(() => loadSavedCustomPassage().text)
  const [pastedTitle,     setPastedTitle]     = useState(() => loadSavedCustomPassage().title)
  const [mode,            setMode]            = useState('library')
  const [customPassage,   setCustomPassage]   = useState(null)
  const [showTranslation, setShowTranslation] = useState(false)
  const [search,          setSearch]          = useState('')
  // Passage ids (already namespaced by language, e.g. "de-p1") the user has
  // marked as finished — persisted across sessions. Only library passages
  // get this treatment; custom pasted text has no stable id worth tracking.
  const [finishedPassages, setFinishedPassages] = useState(loadFinishedPassages)
  // "Continue reading" — last-opened library passage id + scroll position,
  // so reopening the Reader can offer to jump back in rather than always
  // dumping back to the library list. Custom pasted text isn't tracked
  // (no stable id worth persisting across sessions).
  const [lastPassage, setLastPassage] = useState(loadLastPassage)
  const readingBodyRef = useRef(null)
  // Reveal-as-you-go: passages open showing just the first paragraph, with
  // a "Continue reading ↓" tap to reveal the next one — keeps a long
  // passage from landing as one intimidating wall of text on open. Reading
  // aloud (which can land on any sentence) reveals everything immediately
  // rather than trying to stay in sync with manual reveals.
  const [revealedCount, setRevealedCount] = useState(1)
  const textAreaRef = useRef(null)

  useEffect(() => {
    localStorage.setItem(FINISHED_KEY, JSON.stringify([...finishedPassages]))
  }, [finishedPassages])

  function toggleFinished(id) {
    setFinishedPassages(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Persist the pasted/custom text as the user types, so it survives a
  // refresh or navigating away — this was previously pure in-memory state
  // and got silently lost. Debounced by a tick via the effect dependency
  // array rather than on every keystroke's own handler, but still cheap
  // since it's just localStorage.setItem with a small JSON blob.
  useEffect(() => {
    localStorage.setItem(CUSTOM_PASSAGE_KEY, JSON.stringify({ title: pastedTitle, text: pastedText }))
  }, [pastedTitle, pastedText])

  const language = useMemo(() => {
    if (activeLanguage) return activeLanguage
    const firstList = selectedIds.map(id => loadedLists[id]).find(Boolean)
    return firstList?.language ?? 'zh'
  }, [activeLanguage, selectedIds, loadedLists])

  const lookup = useMemo(() => buildLookup(activeEntries), [activeEntries])

  // Merge in surface-form (inflected → dictionary form) matches so reading
  // stats/the Vocab Quiz count and the highlighted text agree — both use
  // this augmented lookup rather than the raw one. buildLookup() returns a
  // Map with lowercased keys, so this has to match that convention (an
  // earlier version of this used plain-object access here, which silently
  // produced a broken lookup — caught via a real-browser crash, not code
  // review — since tokenise()/TextWithLookup expect a Map with .has/.get).
  const augmentedLookup = useMemo(() => {
    const langForms = surfaceForms[language] ?? {}
    if (!Object.keys(langForms).length) return lookup
    const merged = new Map(lookup)
    for (const [surface, lemma] of Object.entries(langForms)) {
      const surfaceKey = surface.toLowerCase()
      const lemmaKey = lemma.toLowerCase()
      if (!merged.has(surfaceKey) && lookup.has(lemmaKey)) {
        merged.set(surfaceKey, { ...lookup.get(lemmaKey), _surface: surface })
      }
    }
    return merged
  }, [lookup, surfaceForms, language])

  useEffect(() => {
    loadSurfaceForms().then(setSurfaceForms)
  }, [])

  useEffect(() => {
    if (!activeLanguage) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch on language change
    setLoading(true)
    loadReaderPassages(`${activeLanguage}-en`).then(data => {
      setPassages(data?.passages ?? [])
      setLoading(false)
    })
  }, [activeLanguage])

  // Derive available levels and tags from passages
  const availableLevels = useMemo(() => {
    const s = new Set(passages.map(p => p.level).filter(Boolean))
    // Sort: A1<A2<B1<B2<C1<C2, then N5<N4<N3<N2<N1, then HSK1..7(7-9)
    const order = ['A1','A2','B1','B2','C1','C2','N5','N4','N3','N2','N1','HSK1','HSK2','HSK3','HSK4','HSK5','HSK6','HSK7']
    return [...s].sort((a,b) => {
      const ai = order.indexOf(a), bi = order.indexOf(b)
      if (ai >= 0 && bi >= 0) return ai - bi
      return a.localeCompare(b)
    })
  }, [passages])

  const availableTags = useMemo(() => {
    const allTags = new Set(passages.flatMap(p => p.tags ?? []))
    return READER_TAG_FILTERS.filter(f => allTags.has(f.tag))
  }, [passages])

  // Active level (single-select, persistent per language — a learner
  // realistically stays at one level for a long stretch, so defaulting to
  // "all levels" every time they open the reader just adds noise) + active
  // story-type tag (single-select, persistent — "and" logic across
  // fiction/non-fiction/fairy-tale doesn't really make sense, and tapping
  // the active chip again clears it, unlike the level chooser) + hide-
  // finished toggle (persistent).
  const [activeLevel, setActiveLevelRaw] = useState(null)
  const [activeTag,   setActiveTagRaw]   = useState(null)
  const [hideFinished, setHideFinished]  = useState(false)
  const prefsLoadedForLanguage = useRef(null)

  // Tag/hide-finished prefs: load once per language (no "always valid"
  // invariant here — null tag and hideFinished=false are both perfectly
  // valid states, so a one-time load is enough).
  useEffect(() => {
    if (!language || prefsLoadedForLanguage.current === language) return
    prefsLoadedForLanguage.current = language
    const saved = loadReaderPrefs(language)
    setActiveTagRaw(saved?.tag ?? null)
    setHideFinished(!!saved?.hideFinished)
  }, [language])

  // Level: self-correcting rather than "load once per language" — the
  // once-only version could miss its correction window on a fast language
  // switch (old language's level lingering in state while availableLevels
  // hadn't repopulated for the new language yet), leaving no chip matching
  // at all. This instead checks "is the current level actually valid for
  // what's loaded right now" on every render, so it can't get stuck with
  // no level selected.
  useEffect(() => {
    if (!language || availableLevels.length === 0) return
    if (activeLevel && availableLevels.includes(activeLevel)) return
    const saved = loadReaderPrefs(language)?.level
    // Syncing from an external system (localStorage) and self-correcting
    // against freshly-computed `availableLevels`; see the same note in
    // GrammarDictionary.jsx for the identical pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveLevelRaw(availableLevels.includes(saved) ? saved : availableLevels[0])
  }, [language, availableLevels, activeLevel])

  function persistPrefs(patch) {
    saveReaderPrefs(language, {
      level: patch.level ?? activeLevel,
      tag: patch.tag !== undefined ? patch.tag : activeTag,
      hideFinished: patch.hideFinished ?? hideFinished,
    })
  }

  // Single-select: never allow clearing back to "no level selected" — the
  // level chooser always keeps exactly one level active.
  function setActiveLevel(levels) {
    const level = levels?.[0] ?? activeLevel
    if (!level) return
    setActiveLevelRaw(level)
    persistPrefs({ level })
  }

  const filteredPassages = useMemo(() => {
    const q = search.trim().toLowerCase()
    return passages.filter(p => {
      if (activeLevel && p.level !== activeLevel) return false
      if (hideFinished && finishedPassages.has(p.id)) return false
      if (activeTag && !(p.tags ?? []).includes(activeTag)) return false
      if (q) {
        const textMatch = p.title?.toLowerCase().includes(q) ||
                           p.text?.toLowerCase().includes(q) ||
                           p.titleTranslation?.toLowerCase().includes(q)
        // Auto-tag detection: typing a tag name (or part of one) — "beginner",
        // "biography", a topic like "food" — filters by tag too, so search
        // alone covers what used to need separate Type/Topic chip rows.
        const tagMatch = (p.tags ?? []).some(t => tagLabel(t).toLowerCase().includes(q))
        if (!textMatch && !tagMatch) return false
      }
      return true
    })
  }, [passages, activeLevel, activeTag, hideFinished, finishedPassages, search])

  function toggleTag(tag) {
    const next = activeTag === tag ? null : tag
    setActiveTagRaw(next)
    persistPrefs({ tag: next })
  }

  function toggleHideFinished() {
    setHideFinished(prev => {
      const next = !prev
      persistPrefs({ hideFinished: next })
      return next
    })
  }

  function openPassage(p, restoreScroll) {
    setActivePassage(p)
    setCustomPassage(null)
    setShowTranslation(false)
    const priorForThisPassage = restoreScroll ? loadLastPassage() : null
    setRevealedCount(priorForThisPassage?.id === p.id ? (priorForThisPassage.revealedCount || 1) : 1)
    const saved = { id: p.id, scrollTop: priorForThisPassage?.scrollTop ?? 0, revealedCount: priorForThisPassage?.revealedCount ?? 1 }
    setLastPassage(saved)
    localStorage.setItem(LAST_PASSAGE_KEY, JSON.stringify(saved))
  }

  // Save scroll position + reveal progress for "continue reading" as the
  // user scrolls/reveals, and restore both (if resuming the same passage)
  // once the DOM for the new passage has actually rendered.
  useEffect(() => {
    const el = readingBodyRef.current
    if (!el || !activePassage) return
    if (lastPassage?.id === activePassage.id && lastPassage.scrollTop > 0) {
      el.scrollTop = lastPassage.scrollTop
    }
    function onScroll() {
      const next = { id: activePassage.id, scrollTop: el.scrollTop, revealedCount }
      localStorage.setItem(LAST_PASSAGE_KEY, JSON.stringify(next))
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [activePassage, revealedCount])

  function openCustom() {
    if (!pastedText.trim()) return
    setCustomPassage({ id: 'custom', title: pastedTitle || 'Custom text', text: pastedText, translation: null })
    setActivePassage(null)
    setShowTranslation(false)
    setRevealedCount(1)
  }

  const currentPassage = activePassage ?? customPassage

  // Vocab actually appearing in this passage, resolved back to full entries —
  // feeds the "Vocab Quiz" flashcard-session button below.
  const passageEntries = useMemo(() => {
    if (!currentPassage) return []
    const spans = tokenise(currentPassage.text, augmentedLookup, language)
    const ids = new Set(spans.filter(s => s.entry).map(s => s.entry.id))
    return activeEntries.filter(e => ids.has(e.id))
  }, [currentPassage, augmentedLookup, language, activeEntries])

  function startVocabQuiz() {
    if (passageEntries.length === 0) return
    setSessionEntries(passageEntries)
    setScreen('flashcard')
  }

  function startVocabMatch() {
    if (passageEntries.length < 2) return
    setSessionEntries(passageEntries)
    setScreen('pairmatch')
  }

  // ── Read-aloud ─────────────────────────────────────────────────────────
  // Speaks the passage sentence-by-sentence (not as one long utterance) so
  // the UI can highlight reading progress and so play/pause has a clean
  // boundary to stop at rather than cutting off mid-sentence.
  const [readingIndex, setReadingIndex] = useState(-1)  // -1 = not playing
  const playingRef = useRef(false)
  const wakeLockRef = useRef(null)

  // Paragraph-aware sentence splitting — splitSentences() on the whole
  // passage text was flattening every paragraph into one continuous run,
  // silently dropping the \n\n paragraph breaks that exist in the source
  // data (confirmed on the fairy tale content: 6 real paragraphs collapsed
  // into a single wall of text). Split into paragraphs first, then
  // sentences within each; `sentences` stays a flat array (read-aloud/
  // scroll-to/translation-pairing all index into it by flat position),
  // `paragraphGroups` groups those same sentence objects for rendering
  // so paragraph spacing survives.
  const paragraphGroups = useMemo(() => {
    if (!currentPassage) return []
    let idx = 0
    return currentPassage.text
      .split(/\n\s*\n/)
      .map(para => splitSentences(para, language).map(text => ({ text, index: idx++ })))
      .filter(group => group.length > 0)
  }, [currentPassage, language])

  const sentences = useMemo(
    () => paragraphGroups.flat().map(s => s.text),
    [paragraphGroups]
  )
  const sentenceRefs = useRef([])
  const paragraphRefs = useRef([])
  // Whether the user is currently scrolled near the bottom of whatever's
  // been revealed so far. Drives the continue/reveal button's dual
  // behavior: reveal-and-scroll when they're already at the bottom asking
  // for more, vs. just scroll-back-down (no new reveal) when they've
  // scrolled up to reread something and tap it — otherwise tapping it
  // while rereading paragraph 2 would silently reveal paragraph 5 off-
  // screen instead of taking them back to where they actually left off.
  const [nearBottom, setNearBottom] = useState(true)
  const pendingScrollRef = useRef(false)

  useEffect(() => {
    const el = readingBodyRef.current
    if (!el || !currentPassage) return
    const THRESHOLD = 80
    function checkNearBottom() {
      setNearBottom(el.scrollHeight - el.scrollTop - el.clientHeight < THRESHOLD)
    }
    checkNearBottom()
    el.addEventListener('scroll', checkNearBottom, { passive: true })
    return () => el.removeEventListener('scroll', checkNearBottom)
  }, [currentPassage])

  // After revealing a new paragraph via the continue button, scroll to it
  // once it's actually rendered (can't scrollIntoView something that
  // doesn't exist in the DOM yet on the same tick as the state update).
  useEffect(() => {
    if (!pendingScrollRef.current) return
    pendingScrollRef.current = false
    paragraphRefs.current[revealedCount - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [revealedCount])

  function handleContinueOrBack() {
    if (revealedCount < paragraphGroups.length && nearBottom) {
      pendingScrollRef.current = true
      setRevealedCount(c => c + 1)
    } else {
      paragraphRefs.current[revealedCount - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Sentence-level tap-to-translate — naive index-pairing between the
  // source and English sentence splits (no per-sentence data exists; the
  // `translation` field is one flat string per passage). Only trusted when
  // both sides split into the same number of sentences: a real-passage
  // scan found this holds ~75-95% of the time depending on language (worst
  // case Japanese, 9/36 mismatched — translators don't always keep a 1:1
  // sentence count with the source). When counts don't match, pairing is
  // silently disabled for that passage rather than showing a wrong
  // translation next to the right sentence; the full-passage EN toggle
  // still works regardless since it doesn't depend on alignment.
  // Same paragraph-first splitting applied here too, so pairing stays
  // aligned by paragraph order, not just overall count.
  const englishSentences = useMemo(() => {
    if (!currentPassage?.translation) return []
    return currentPassage.translation
      .split(/\n\s*\n/)
      .flatMap(para => splitSentences(para, 'en'))
  }, [currentPassage])
  const sentenceTranslationsAligned = language !== 'en' &&
    englishSentences.length > 0 && englishSentences.length === sentences.length
  const [expandedSentence, setExpandedSentence] = useState(null)

  function toggleSentenceTranslation(i) {
    if (!sentenceTranslationsAligned) return
    setExpandedSentence(prev => (prev === i ? null : i))
  }

  // Keep the currently-spoken sentence in view during read-aloud — without
  // this, playback on a long passage would keep highlighting sentences the
  // user has already scrolled past, defeating the point of a hands-free
  // read-along.
  useEffect(() => {
    if (readingIndex < 0) return
    sentenceRefs.current[readingIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [readingIndex])

  async function playPassage() {
    if (playingRef.current || sentences.length === 0) return
    playingRef.current = true
    setRevealedCount(paragraphGroups.length) // read-aloud can land on any sentence, so reveal everything first
    wakeLockRef.current = await requestWakeLock()
    const rate = settings.listeningSpeechRate ?? 0.9
    if (currentPassage?.title) {
      await speakAndWait(currentPassage.title, language, { rate })
      if (playingRef.current) await sleep(SENTENCE_PAUSE_MS)
    }
    for (let i = 0; i < sentences.length; i++) {
      if (!playingRef.current) break
      setReadingIndex(i)
      await speakAndWait(sentences[i], language, { rate })
      // A brief pause between sentences — spoken back-to-back with zero gap
      // reads too rushed to actually follow along with the text.
      if (playingRef.current && i < sentences.length - 1) await sleep(SENTENCE_PAUSE_MS)
    }
    playingRef.current = false
    setReadingIndex(-1)
    releaseWakeLock(wakeLockRef.current)
    wakeLockRef.current = null
  }

  function stopPassage() {
    playingRef.current = false
    stopSpeech()
    setReadingIndex(-1)
    releaseWakeLock(wakeLockRef.current)
    wakeLockRef.current = null
  }

  // Stop any in-progress read-aloud when switching passages or leaving the screen
  useEffect(() => {
    setExpandedSentence(null)
    return () => {
      playingRef.current = false
      stopSpeech()
      releaseWakeLock(wakeLockRef.current)
      wakeLockRef.current = null
    }
  }, [currentPassage])

  // ── List view ──────────────────────────────────────────────────────────────
  if (!currentPassage) {
    return (
      <div className="gr-screen">
        <div className="gr-header">
          <button className="gr-back" onClick={goBack}>← Back</button>
          <span className="gr-title">Reader</span>
          <div className="gr-header-tabs">
            <button className={`gr-tab ${mode === 'library' ? 'active' : ''}`} onClick={() => setMode('library')}>Library</button>
            <button className={`gr-tab ${mode === 'paste'   ? 'active' : ''}`} onClick={() => setMode('paste')}>Paste</button>
          </div>
          {mode === 'library' && (
            <button
              className={`gr-hide-finished-btn ${hideFinished ? 'active' : ''}`}
              onClick={toggleHideFinished}
              title={hideFinished ? 'Show finished passages' : 'Hide finished passages'}
            >
              {hideFinished ? '🙈' : '👁'}
            </button>
          )}
          <HelpButton
            title="Graded Reader"
            description="Browse passages by level, search titles/text/topics, or paste your own text to read. Tap 📇 on a passage to quiz yourself on just its vocab, and tap ✓ Mark as Finished when you're done — your progress and last-read spot are saved automatically. Tap 👁 to hide passages you've already finished."
          />
        </div>

        {mode === 'library' ? (
          <div className="gr-body">
            {loading ? (
              <div className="gr-empty">Loading…</div>
            ) : passages.length === 0 ? (
              <div className="gr-empty">
                {activeLanguage ? 'No passages available for this language yet.' : 'Select a language on the home screen first.'}
              </div>
            ) : (
              <>
                {/* ── Top banners: finished-progress (left) + "Continue
                     reading" resume banner (right), same pill shape,
                     side by side rather than stacked full-width blocks ── */}
                <div className="gr-top-banners">
                  {passages.length > 0 && (
                    <div className="gr-progress-summary">
                      <span className="gr-progress-summary-icon">✓</span>
                      <span className="gr-progress-summary-text">
                        {passages.filter(p => finishedPassages.has(p.id)).length}/{passages.length}
                      </span>
                    </div>
                  )}
                  {(() => {
                    if (!lastPassage) return null
                    const resume = passages.find(p => p.id === lastPassage.id)
                    if (!resume) return null
                    return (
                      <button className="gr-continue-banner" onClick={() => openPassage(resume, true)}>
                        <span className="gr-continue-icon">📖</span>
                        <span className="gr-continue-text">
                          <span className="gr-continue-label">Continue reading</span>
                          <span className="gr-continue-title">{resume.title}</span>
                        </span>
                        <span className="gr-continue-arrow">→</span>
                      </button>
                    )
                  })()}
                </div>

                {/* ── Filters — level chips, search, and a short fixed tag row, all
                     sharing the same horizontal padding so they read as one
                     aligned block instead of separately-indented rows ── */}
                {(() => {
                  if (availableLevels.length === 0 && availableTags.length === 0) return null
                  return (
                    <div className="gr-filters">
                      {availableLevels.length > 0 && (
                        <LevelChooser levels={availableLevels} value={activeLevel ? [activeLevel] : null} onChange={setActiveLevel} className="gr-filter-levels" single />
                      )}
                      <div className="gr-search-row">
                        <input
                          className="gr-search"
                          type="text"
                          placeholder="Search titles, text, or topics…"
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                        />
                        {search && (
                          <button className="gr-search-clear" onClick={() => setSearch('')} aria-label="Clear search">✕</button>
                        )}
                      </div>
                      {(availableTags.length > 0 || activeTag || search) && (
                        <div className="gr-tag-row">
                          {(activeTag || search) && (
                            <button className="gr-tag-clear" onClick={() => { setActiveTagRaw(null); persistPrefs({ tag: null }); setSearch('') }} aria-label="Clear filters">✕</button>
                          )}
                          {availableTags.length > 0 && (
                            <div className="gr-tag-scroll">
                              {availableTags.map(({ tag, label }) => (
                                <button key={tag} className={`gr-tag-chip ${activeTag === tag ? 'active' : ''}`} onClick={() => toggleTag(tag)}>
                                  {label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })()}

                {filteredPassages.length === 0 ? (
                  <div className="gr-empty">No passages match the selected filters.</div>
                ) : (
                  <div className="gr-passage-list">
                    {(() => {
                      const seriesMap = {}
                      const standalones = []
                      filteredPassages.forEach(p => {
                        if (p.series) {
                          if (!seriesMap[p.series]) seriesMap[p.series] = []
                          seriesMap[p.series].push(p)
                        } else {
                          standalones.push(p)
                        }
                      })
                      // A "series" of one isn't a series — it's just a passage
                      // whose title happens to match its own series tag (e.g.
                      // fairy tales with a single level so far). Rendering it
                      // as a grouped section repeats that name right above
                      // itself for no reason, so fold true one-offs into the
                      // standalone list instead.
                      const realSeries = {}
                      Object.entries(seriesMap).forEach(([name, list]) => {
                        if (list.length > 1) realSeries[name] = list
                        else standalones.push(...list)
                      })

                      const renderCard = (p) => {
                        const passageSpans = tokenise(p.text, augmentedLookup, language)
                        const matchedIds = [...new Set(passageSpans.filter(s => s.entry).map(s => s.entry.id))]
                        const knownCount = matchedIds.filter(id => (scores[id]?.global ?? 'unseen') !== 'unseen').length
                        return (
                          <button key={p.id} className="gr-passage-card" onClick={() => openPassage(p)}>
                            <div className="gr-passage-card-top">
                              <span className="gr-passage-title">{p.title}</span>
                              <span className="gr-passage-card-badges">
                                {finishedPassages.has(p.id) && <span className="gr-finished-check" title="Finished">✓</span>}
                                {p.level && <span className="gr-passage-level">{p.level}</span>}
                              </span>
                            </div>
                            {p.titleTranslation && <span className="gr-passage-subtitle">{p.titleTranslation}</span>}
                            <div className="gr-passage-card-bottom">
                              <span className="gr-passage-stats">{matchedIds.length} vocab · {knownCount} known</span>
                              {p.tags && (
                                <div className="gr-passage-tags">
                                  {p.tags.filter(t => !t.startsWith('series:') && !['beginner','intermediate','advanced'].includes(t)).slice(0, 3).map(t => (
                                    <span key={t} className="gr-passage-tag">{tagLabel(t)}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </button>
                        )
                      }

                      return (
                        <>
                          {Object.entries(realSeries).map(([seriesName, seriesPassages]) => (
                            <div key={seriesName} className="gr-series">
                              <div className="gr-series-header">
                                <span className="gr-series-icon">📚</span>
                                <span className="gr-series-name">{seriesName}</span>
                                <span className="gr-series-count">{seriesPassages.length} level{seriesPassages.length !== 1 ? 's' : ''}</span>
                              </div>
                              <div className="gr-series-cards">
                                {seriesPassages.map(renderCard)}
                              </div>
                            </div>
                          ))}
                          {standalones.length > 0 && (
                            <div className="gr-series">
                              {Object.keys(realSeries).length > 0 && (
                                <div className="gr-series-header">
                                  <span className="gr-series-icon">📄</span>
                                  <span className="gr-series-name">Standalone</span>
                                  <span className="gr-series-count">{standalones.length}</span>
                                </div>
                              )}
                              <div className="gr-series-cards">
                                {standalones.map(renderCard)}
                              </div>
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="gr-body">
            <div className="gr-paste-area">
              <input className="gr-paste-title" placeholder="Title (optional)" value={pastedTitle} onChange={e => setPastedTitle(e.target.value)} />
              <textarea ref={textAreaRef} className="gr-paste-input" placeholder="Paste or type your text here…" value={pastedText} onChange={e => setPastedText(e.target.value)} rows={10} />
              <button className="gr-paste-btn" disabled={!pastedText.trim()} onClick={openCustom}>Read →</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Reading view ───────────────────────────────────────────────────────────
  return (
    <div className="gr-screen">
      <div className="gr-header">
        <button className="gr-back" onClick={() => { setActivePassage(null); setCustomPassage(null) }}>← Back</button>
        <span className="gr-title gr-reading-title">{currentPassage.title}</span>
        {speechSupported() && sentences.length > 0 && (
          <button
            className={`gr-play-btn ${readingIndex >= 0 ? 'is-playing' : ''}`}
            onClick={readingIndex >= 0 ? stopPassage : playPassage}
            title={readingIndex >= 0 ? 'Stop reading aloud' : 'Read passage aloud'}
          >
            {readingIndex >= 0 ? '⏸' : '🔊'}
          </button>
        )}
        {currentPassage.translation && (
          <button className={`gr-trans-toggle ${showTranslation ? 'active' : ''}`} onClick={() => setShowTranslation(t => !t)}>EN</button>
        )}
        {passageEntries.length > 0 && (
          <button className="gr-play-btn" onClick={startVocabQuiz} title="Practice this passage's vocab as flashcards">
            📇
          </button>
        )}
        {passageEntries.length >= 2 && (
          <button className="gr-play-btn" onClick={startVocabMatch} title="Practice this passage's vocab as a matching game">
            🔗
          </button>
        )}
        <HelpButton
          title="Graded Reader"
          description="Read short passages at your level. Tap any word for its translation, tap elsewhere in a sentence to translate that sentence (when available), toggle EN for a full translation, tap 🔊 to have the passage read aloud sentence by sentence, and use 📇/🔗 to practice this passage's vocab as flashcards or a matching game."
        />
      </div>

      <div className="gr-body gr-reading-body" ref={readingBodyRef}>
        <div className="gr-cover-placeholder" aria-hidden="true">🖼️</div>

        {paragraphGroups.length > 1 && (
          <div className="gr-progress">
            <div className="gr-progress-bar">
              <div className="gr-progress-fill" style={{ width: `${(Math.min(revealedCount, paragraphGroups.length) / paragraphGroups.length) * 100}%` }} />
            </div>
            <span className="gr-progress-label">Paragraph {Math.min(revealedCount, paragraphGroups.length)} of {paragraphGroups.length}</span>
          </div>
        )}

        <div className="gr-text">
          {paragraphGroups.slice(0, revealedCount).map((group, pi) => (
            <p key={pi} className="gr-paragraph" ref={el => { paragraphRefs.current[pi] = el }}>
              {group.map(({ text: sentence, index: i }) => (
                <span
                  key={i}
                  ref={el => { sentenceRefs.current[i] = el }}
                  className={`gr-sentence ${readingIndex === i ? 'gr-sentence-active' : ''} ${sentenceTranslationsAligned ? 'gr-sentence-tappable' : ''}`}
                  onClick={sentenceTranslationsAligned ? () => toggleSentenceTranslation(i) : undefined}
                >
                  <TextWithLookup text={sentence} language={language} lookup={augmentedLookup} scores={scores} showReading={showReading} />
                  {' '}
                  {expandedSentence === i && (
                    <span className="gr-sentence-translation" onClick={e => e.stopPropagation()}>
                      {englishSentences[i]}
                    </span>
                  )}
                </span>
              ))}
            </p>
          ))}
        </div>

        {(revealedCount < paragraphGroups.length || !nearBottom) && (
          <button className="gr-continue-reveal-btn" onClick={handleContinueOrBack}>
            {revealedCount < paragraphGroups.length && nearBottom ? 'Continue reading ↓' : '↓ Back to last paragraph'}
          </button>
        )}

        {showTranslation && currentPassage.translation && (
          <div className="gr-translation"><p>{currentPassage.translation}</p></div>
        )}

        <div className="gr-legend">
          <span className="gr-legend-item gr-legend--mastered">mastered</span>
          <span className="gr-legend-item gr-legend--learning">learning</span>
          <span className="gr-legend-item gr-legend--unseen">unseen</span>
          <span className="gr-legend-item gr-legend--unknown">not in list</span>
        </div>

        {activePassage && (
          <button
            className={`gr-finish-btn ${finishedPassages.has(activePassage.id) ? 'is-finished' : ''}`}
            onClick={() => toggleFinished(activePassage.id)}
          >
            {finishedPassages.has(activePassage.id) ? '✓ Finished' : 'Mark as Finished'}
          </button>
        )}
      </div>
    </div>
  )
}
