/**
 * Settings engine — persists to localStorage under 'vocabSettings'.
 *
 * Structure:
 * {
 *   darkMode: 'auto' | 'light' | 'dark',
 *
 *   // Global defaults (can be overridden per-game)
 *   direction: 'entry->translation' | 'translation->entry',
 *   showReading: boolean,
 *   readingOnly: boolean,  // Flashcard: show reading (kana/pinyin) instead of hanzi/kanji for zh/ja
 *   facetsByBox: boolean,  // Box 2/3/4/5 each drive their own display facet (see engine/facets.js) instead of the manual toggles
 *   autoExampleOnUnknown: boolean,  // Flashcard: auto-show example sentence when marking a card Unknown
 *
 *   // Answer fields per game (which field is the prompt / answer)
 *   // Values: 'entry' | 'translation' | 'reading'
 *   answerFields: {
 *     global:    { prompt: 'entry',  answer: 'translation' },
 *     flashcard: null,   // null = use global
 *     pairmatch: null,
 *     racecar:   null,
 *     gapfill:   null,
 *     typing:    null,
 *   },
 *
 *   // Per-game options
 *   racecar: {
 *     defaultSpeed: 1.0,   // 0.5–2.0
 *     boostEnabled: true,
 *   },
 *   flashcard: {
 *     swipeSensitivity: 1.0,  // 0.5–2.0 (multiplier on thresholds)
 *   },
 *   gapfill: {
 *     fixedRatio: 0.6,  // 0–1 (0 = all generic, 1 = all fixed)
 *   },
 *   pairmatch: {
 *     roundSize: 5,   // 3–8
 *   },
 *   typing: {
 *     requireCorrect: true,   // must type correctly before advancing
 *     skipEnabled: true,
 *   },
 * }
 */

const STORAGE_KEY = 'vocabSettings'

/**
 * Single source of truth for level ordering per language, used by every chooser
 * (Setup, Stats, Settings, GradedReader) and by the level-filter logic itself.
 * HSK7, HSK8, HSK9 are stored as a single combined value 'HSK7' in the vocab data
 * (the standard HSK 3.0 "advanced" band), shown as one chip labeled 'HSK7-9'.
 */
export const LEVEL_ORDER = {
  zh: ['HSK1','HSK2','HSK3','HSK4','HSK5','HSK6','HSK7'],
  ja: ['N5','N4','N3','N2','N1'],
  de: ['A1','A2','B1','B2','C1','C2'],
  es: ['A1','A2','B1','B2','C1','C2'],
  fr: ['A1','A2','B1','B2','C1','C2'],
  en: ['A1','A2','B1','B2','C1','C2'],
}

// Display label for a level chip — only HSK7 (the combined 7-9 band) differs from its raw value.
export function levelLabel(level) {
  return level === 'HSK7' ? 'HSK7-9' : level
}

export const DEFAULTS = {
  darkMode: 'auto',
  direction: 'entry->translation',
  showReading: true,
  readingOnly: false,
  facetsByBox: false,
  autoExampleOnUnknown: false,
  answerFields: {
    global:    { prompt: 'entry', answer: 'translation' },
    flashcard: null,
    pairmatch: null,
    racecar:   null,
    gapfill:   null,
    typing:    null,
  },
  // Level filter per game. null = all levels. Array of level strings = filter.
  levels: {
    global:    null,
    flashcard: null,
    pairmatch: null,
    racecar:   null,
    gapfill:   null,
    typing:    null,
  },
  racecar: {
    defaultSpeed: 1.0,
    boostEnabled: true,
  },
  flashcard: {
    swipeSensitivity: 1.0,
  },
  gapfill: {
    fixedRatio: 0.6,
  },
  pairmatch: {
    roundSize: 5,
  },
  typing: {
    requireCorrect: true,
    skipEnabled: true,
  },
}

function deepMerge(defaults, saved) {
  const result = { ...defaults }
  for (const key in saved) {
    if (
      saved[key] !== null &&
      typeof saved[key] === 'object' &&
      !Array.isArray(saved[key]) &&
      typeof defaults[key] === 'object' &&
      defaults[key] !== null
    ) {
      result[key] = deepMerge(defaults[key], saved[key])
    } else {
      result[key] = saved[key]
    }
  }
  return result
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    return deepMerge(DEFAULTS, JSON.parse(raw))
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

/**
 * Get resolved answer fields for a specific game.
 * Falls back to global if game-specific is null.
 */
export function getAnswerFields(settings, game) {
  return settings.answerFields[game] ?? settings.answerFields.global
}

/**
 * Get resolved level filter for a specific game.
 * Returns null (all levels) or an array of level strings.
 */
export function getGameLevels(settings, game) {
  return settings.levels[game] ?? settings.levels.global ?? null
}

/**
 * Filter entries by resolved level setting for a game.
 * Returns all entries if levels is null.
 */
export function filterByLevel(entries, levels) {
  if (!levels || levels.length === 0) return entries
  return entries.filter(e => levels.includes(e.level))
}

/**
 * Filter entries by selected topic-category leaves. Returns all entries if
 * categories is null/empty. A word matches if it carries ANY of the
 * selected leaf tags (not all) — e.g. selecting "food"+"animals" shows
 * words tagged either one.
 */
export function filterByCategory(entries, categories) {
  if (!categories || categories.length === 0) return entries
  return entries.filter(e => categories.some(c => e.categories?.includes(c)))
}
/**
 * Always sets an explicit data-theme="light"|"dark" attribute — this
 * resolves 'auto' mode itself, so [data-theme] CSS selectors are always
 * authoritative. IMPORTANT: because of this, CSS must never use
 * `@media (prefers-color-scheme: dark)` — those blocks fire purely off OS
 * preference regardless of what's set here, and previously caused a real
 * bug where explicit light-mode selections got silently overridden by a
 * dark OS setting (fixed by removing ~33 such blocks across the codebase;
 * see chat history "text color is also an issue" for the full writeup).
 * Use [data-theme="dark"] exclusively for dark-theme CSS.
 */
export function applyDarkMode(mode) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = mode === 'dark' || (mode === 'auto' && prefersDark)
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
}
