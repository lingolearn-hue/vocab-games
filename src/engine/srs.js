/**
 * SRS engine — per-game scores + global status.
 *
 * localStorage record per entry:
 * {
 *   global: 'unseen' | 'learning' | 'mastered',
 *   racecar:   { score: 0-5, dueIn: 0+ },
 *   pairmatch: { score: 0-5, dueIn: 0+ },
 *   flashcard: { score: 0-5, dueIn: 0+ },
 *   gapfill:   { score: 0-5, dueIn: 0+ },
 * }
 */

const STORAGE_KEY = 'vocabScores'
const MAX_SCORE   = 5
const GAMES = ['racecar', 'pairmatch', 'flashcard', 'gapfill', 'typing']

// Spacing: how many picks to wait before re-showing, by score
const SPACING = [0, 3, 6, 9, 12, 15]

// Game display config (used by vocab browser)
export const GAME_META = {
  racecar:   { label: 'Race',  color: '#4f7ef8' },
  pairmatch: { label: 'Match', color: '#22a06b' },
  flashcard: { label: 'Flash', color: '#bf8700' },
  gapfill:   { label: 'Gap',   color: '#8b5cf6' },
  typing:    { label: 'Type',  color: '#e05cb0' },
}

// ── Persistence ───────────────────────────────────────────────────────────────

function readStore() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }
  catch { return {} }
}

function writeStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

function getRecord(entryId) {
  const store = readStore()
  return store[entryId] ?? {
    global:    'unseen',
    racecar:   { score: 0, dueIn: 0 },
    pairmatch: { score: 0, dueIn: 0 },
    flashcard: { score: 0, dueIn: 0 },
    gapfill:   { score: 0, dueIn: 0 },
    typing:    { score: 0, dueIn: 0 },
  }
}

function saveRecord(entryId, record) {
  const store = readStore()
  store[entryId] = record
  writeStore(store)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function markLearning(record) {
  if (record.global === 'unseen') record.global = 'learning'
}

function checkAutoMaster(record) {
  // Auto-promote if all 4 game scores are at max
  if (record.global === 'mastered') return
  const allMax = GAMES.every(g => record[g].score >= MAX_SCORE)
  if (allMax) record.global = 'mastered'
}

function tickAll(exceptId) {
  const store = readStore()
  for (const id in store) {
    if (id === exceptId) continue
    const rec = store[id]
    for (const g of GAMES) {
      if (rec[g]) rec[g].dueIn = Math.max(0, (rec[g].dueIn ?? 0) - 1)
    }
  }
  writeStore(store)
}

// ── Public API ────────────────────────────────────────────────────────────────

export function getRecord_public(entryId) {
  return getRecord(entryId)
}

/** Get score for a specific game */
export function getScore(entryId, game) {
  return getRecord(entryId)[game]?.score ?? 0
}

/** Get global status */
export function getGlobalStatus(entryId) {
  return getRecord(entryId).global
}

/** Record a correct answer for a specific game */
export function recordCorrect(entryId, game) {
  const rec = getRecord(entryId)
  markLearning(rec)
  const newScore = Math.min(MAX_SCORE, rec[game].score + 1)
  rec[game] = { score: newScore, dueIn: SPACING[newScore] }
  checkAutoMaster(rec)
  saveRecord(entryId, rec)
  tickAll(entryId)
}

/** Record a wrong answer for a specific game */
export function recordWrong(entryId, game) {
  const rec = getRecord(entryId)
  markLearning(rec)
  const newScore = Math.max(0, rec[game].score - 1)
  rec[game] = { score: newScore, dueIn: 1 }
  saveRecord(entryId, rec)
  tickAll(entryId)
}

/** Flashcard swipe-up: set global to mastered */
export function recordMaster(entryId) {
  const rec = getRecord(entryId)
  rec.global = 'mastered'
  rec.flashcard = { score: MAX_SCORE, dueIn: SPACING[MAX_SCORE] }
  saveRecord(entryId, rec)
  tickAll(entryId)
}

/** Manually reset a word to learning in vocab browser */
export function resetToLearning(entryId) {
  const rec = getRecord(entryId)
  rec.global = 'learning'
  saveRecord(entryId, rec)
}

/** Legacy: set score directly (used by AppContext.set) */
export function setScore(entryId, val) {
  const rec = getRecord(entryId)
  markLearning(rec)
  rec.flashcard.score = Math.max(0, Math.min(MAX_SCORE, val))
  saveRecord(entryId, rec)
}

/** Get all records (for vocab browser + score refresh) */
export function getAllScores() {
  return readStore()
}

// ── SRS-aware selectors ───────────────────────────────────────────────────────

/**
 * Pick n distinct entries for a specific game.
 * Excludes mastered words. Prefers eligible (dueIn=0), fills from least-due.
 */
export function srsPickDistinct(pool, n, game) {
  if (!game) game = 'flashcard' // fallback
  if (pool.length === 0) return []
  n = Math.min(n, pool.length)

  const store = readStore()

  const withMeta = pool
    .filter(e => (store[e.id]?.global ?? 'unseen') !== 'mastered')
    .map(e => ({
      entry: e,
      score: store[e.id]?.[game]?.score ?? 0,
      dueIn: store[e.id]?.[game]?.dueIn ?? 0,
    }))

  // If filtering mastered empties the pool, fall back to full pool
  const candidates = withMeta.length >= n ? withMeta : pool.map(e => ({
    entry: e,
    score: store[e.id]?.[game]?.score ?? 0,
    dueIn: store[e.id]?.[game]?.dueIn ?? 0,
  }))

  const eligible   = candidates.filter(m => m.dueIn === 0)
  const ineligible = candidates.filter(m => m.dueIn > 0).sort((a, b) => a.dueIn - b.dueIn)
  const drawFrom   = eligible.length >= n ? eligible : [...eligible, ...ineligible.slice(0, n - eligible.length)]

  const result    = []
  const remaining = [...drawFrom]

  for (let i = 0; i < n; i++) {
    if (remaining.length === 0) break
    const total  = remaining.reduce((s, m) => s + (MAX_SCORE + 1 - m.score), 0)
    let r        = Math.random() * total
    let chosen   = remaining[remaining.length - 1]
    for (const m of remaining) {
      r -= (MAX_SCORE + 1 - m.score)
      if (r <= 0) { chosen = m; break }
    }
    result.push(chosen.entry)
    remaining.splice(remaining.indexOf(chosen), 1)
  }

  return result
}

export function srsPick(pool, game) {
  return srsPickDistinct(pool, 1, game)
}
