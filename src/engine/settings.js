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

export const DEFAULTS = {
  darkMode: 'auto',
  direction: 'entry->translation',
  showReading: true,
  answerFields: {
    global:    { prompt: 'entry', answer: 'translation' },
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
 * Apply dark mode to <html> element.
 */
export function applyDarkMode(mode) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = mode === 'dark' || (mode === 'auto' && prefersDark)
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
}
