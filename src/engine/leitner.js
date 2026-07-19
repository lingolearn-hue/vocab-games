/**
 * Leitner SRS engine — score-seeded box system, day-based box selection.
 *
 * Score: persistent (0–5). 0=unseen, 1–4=active, 5=mastered.
 *   correct → score+1 (max 5)
 *   wrong   → score-1 (min 0)
 *   master  → score=5
 *
 * Box membership is derived directly from score — no separate box bookkeeping,
 * no per-box size caps, no overflow stack. Boxes 0-4 map 1:1 to score 0-4
 * (box 0 = unseen, treated as a normal box, not folded into box 1). Score 5
 * = mastered, excluded from all boxes.
 *
 * Box selection ("day system"):
 *   The highest non-empty box (4 → 3 → 2 → 1 → 0) auto-opens the first time
 *   the game is entered on a given calendar day (local date) — box 0 opens
 *   last, once every other box is empty. Within that same day, re-entering
 *   the game does NOT re-pick — whatever box is currently active stays
 *   active. Answering a card immediately moves it to its new box (removed
 *   from the current pass right away); when the pass empties, the next
 *   non-empty box below it opens (same day). Boxes can be opened manually at
 *   any time via openBox(), regardless of the day lock.
 *
 * Storage:
 *   'leitnerScores_<game>'  → { id: 0-5 }                  (persistent)
 *   'leitnerSession_<game>' → { entryIds, day, currentPass,  (rebuilt as needed)
 *                               passQueue, passDone, passTotal }
 */

const SCORES_KEY  = (game='flashcard') => `leitnerScores_${game}`
const SESSION_KEY = (game='flashcard') => `leitnerSession_${game}`
const MAX_SCORE   = 5

// Games sharing this box/pass engine. 'stroke' (StrokeOrder) is excluded from
// recordMasterAll: writing strokes is a distinct skill from recognizing a
// word, so mastering recognition shouldn't silently mark stroke practice done.
export const LEITNER_GAMES = ['flashcard', 'pairmatch', 'stroke']
const RECOGNITION_GAMES = LEITNER_GAMES.filter(g => g !== 'stroke')

// Single source of truth for every localStorage key this engine writes.
// Backup/export/import/reset logic MUST use this instead of a hardcoded
// list — new games added to LEITNER_GAMES are picked up automatically.
export function leitnerStorageKeys() {
  return LEITNER_GAMES.flatMap(g => [SCORES_KEY(g), SESSION_KEY(g)])
}

// ── Persistence ───────────────────────────────────────────────────────────────

function readScores(game='flashcard') {
  try { return JSON.parse(localStorage.getItem(SCORES_KEY(game)) || '{}') } catch { return {} }
}
function writeScores(s, game='flashcard') { localStorage.setItem(SCORES_KEY(game), JSON.stringify(s)) }

function readSession(game='flashcard') {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY(game)) || 'null')
    if (s?.entryIds && Array.isArray(s.entryIds)) return s
  } catch { /* corrupt/missing session data — fall through to null */ }
  return null
}
function writeSession(s, game='flashcard') { localStorage.setItem(SESSION_KEY(game), JSON.stringify(s)) }

// ── Score accessors ───────────────────────────────────────────────────────────

export function getScore(entryId, game='flashcard')    { return readScores(game)[entryId] ?? 0 }
export function getAllScores(game='flashcard')            { return readScores(game) }

export function getScoreCounts(entryIds, game='flashcard') {
  const scores = readScores(game)
  const counts = [0,0,0,0,0,0]
  for (const id of entryIds) counts[Math.min(scores[id]??0,5)]++
  return counts
}

// ── Box helpers (derived from score) ──────────────────────────────────────────

function _boxOf(score) {
  if (score >= 5) return 5
  if (score <= 0) return 0
  return score
}

function _boxCounts(entryIds, scores) {
  const counts = {0:0, 1:0, 2:0, 3:0, 4:0, 5:0}
  for (const id of entryIds) {
    const b = _boxOf(scores[id] ?? 0)
    counts[b]++
  }
  return counts
}

/** Highest non-empty box (4→3→2→1→0), or null if all boxes 0-4 are empty. */
function _pickHighestBox(entryIds, scores) {
  const counts = _boxCounts(entryIds, scores)
  for (const b of [4,3,2,1,0]) if (counts[b] > 0) return b
  return null
}

/** Picks the next box to open when the current one empties: searches
 *  downward (current-1 → 0) first, matching the documented "next box
 *  below opens" design, so a card just promoted upward isn't immediately
 *  re-served. Falls back upward only if nothing remains below. */
function _pickNextBoxBelow(entryIds, scores, current) {
  const counts = _boxCounts(entryIds, scores)
  for (let b = current - 1; b >= 0; b--) if (counts[b] > 0) return b
  for (let b = current + 1; b <= 4; b++) if (counts[b] > 0) return b
  return null
}

/** Local calendar-date string (YYYY-MM-DD) used for the day lock. */
function _today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// ── Session init ──────────────────────────────────────────────────────────────

export function initSession(entries, game='flashcard') {
  // Migrate old scores from pre-game-key era (leitnerScores → leitnerScores_flashcard)
  const OLD_KEY = 'leitnerScores'
  if (game === 'flashcard' && localStorage.getItem(OLD_KEY) && !localStorage.getItem('leitnerScores_flashcard')) {
    try {
      const old = localStorage.getItem(OLD_KEY)
      localStorage.setItem('leitnerScores_flashcard', old)
      localStorage.removeItem(OLD_KEY)
    } catch { /* migration best-effort — ignore failures, old key stays untouched */ }
  }

  const scores = readScores(game)

  // Seed missing entries at score 0. Never delete scores for other entries —
  // they may belong to other languages.
  let changed = false
  for (const e of entries) {
    if (!(e.id in scores)) { scores[e.id] = 0; changed = true }
  }
  if (changed) writeScores(scores, game)

  const entryIds = entries.map(e => e.id)
  const session = {
    entryIds,
    day: _today(),
    currentPass: _pickHighestBox(entryIds, scores) ?? 0,
    passQueue: [],
    passDone: 0,
    passTotal: 0,
  }
  _openPass(session, scores)
  writeSession(session, game)
  return session
}

export function getSession(entries, game='flashcard') {
  const existing = readSession(game)
  if (!existing) return initSession(entries, game)

  // Keep entryIds fresh if the entry set changed (e.g. filters/level changed)
  const entryIds = entries.map(e => e.id)
  const idsChanged = entryIds.length !== existing.entryIds.length
    || entryIds.some((id, i) => id !== existing.entryIds[i])
  if (idsChanged) existing.entryIds = entryIds

  // Day lock: only re-pick the auto-opened box on first entry of a new
  // calendar day. Same-day re-entries keep whatever box is currently active.
  const today = _today()
  const isNewDay = existing.day !== today
  if (isNewDay) {
    const scores = readScores(game)
    existing.day = today
    existing.currentPass = _pickHighestBox(entryIds, scores) ?? existing.currentPass ?? 0
    _openPass(existing, scores)
  }

  if (isNewDay || idsChanged) writeSession(existing, game)
  return existing
}

// ── Box/pass accessors ────────────────────────────────────────────────────────

export function getBox(entryId, game='flashcard') {
  return _boxOf(readScores(game)[entryId] ?? 0)
}

export function getBoxCounts(entryIds, game='flashcard') {
  const scores = readScores(game)
  const counts = [0,0,0,0,0,0]
  for (const id of entryIds) counts[Math.min(scores[id]??0,5)]++
  return counts
}

/**
 * Returns pass progress for the status bar display.
 * {
 *   currentPass,   // which box is active (0-4)
 *   passDone,      // cards done in current pass
 *   passTotal,     // total cards in current pass
 *   barFills: { 0: 0, 1: 0.6, 2: 0, 3: 0, 4: 0 }  // within-pass fill for active box only
 * }
 */
export function getPassState(game='flashcard') {
  const s = readSession(game)
  if (!s) return { currentPass:0, passDone:0, passTotal:0, barFills:{0:0,1:0,2:0,3:0,4:0,5:0}, passQueue:[], game }

  const { currentPass, passDone, passTotal } = s
  const withinFill = passTotal > 0 ? passDone / passTotal : 0
  const barFills = {0:0, 1:0, 2:0, 3:0, 4:0, 5:0}
  barFills[currentPass] = withinFill

  return { currentPass, passDone, passTotal, barFills, passQueue: s.passQueue ?? [] }
}

// ── Card answering ────────────────────────────────────────────────────────────

/**
 * Get the next card to show from the current pass queue.
 * Returns { id, box } or null if pass is done.
 */
export function nextCard(entryMap) {
  const s = readSession()
  if (!s || s.passQueue.length === 0) return null
  const id = s.passQueue[0]
  return { id, entry: entryMap?.get(id), box: s.currentPass }
}

/**
 * Record correct answer. Advances score. Removes from pass queue.
 * Returns true if pass is now complete.
 */
export function recordCorrect(entryId, allEntryIds, game='flashcard') {
  const scores  = readScores(game)
  const session = readSession(game)
  if (!session) return false

  session.passQueue = session.passQueue.filter(id => id !== entryId)
  session.passDone++

  const oldScore = scores[entryId] ?? 0
  scores[entryId] = Math.min(oldScore + 1, MAX_SCORE)
  writeScores(scores, game)

  const passComplete = session.passQueue.length === 0
  if (passComplete) _advancePass(session, scores, allEntryIds)
  writeSession(session, game)
  return passComplete
}

/**
 * Record wrong answer. Score-1 (min 0). Removes from pass queue.
 * Returns true if pass is now complete.
 */
export function recordWrong(entryId, allEntryIds, game='flashcard') {
  const scores  = readScores(game)
  const session = readSession(game)
  if (!session) return false

  session.passQueue = session.passQueue.filter(id => id !== entryId)
  session.passDone++

  const oldScore = scores[entryId] ?? 0
  scores[entryId] = Math.max(oldScore - 1, 0)
  writeScores(scores, game)

  const passComplete = session.passQueue.length === 0
  if (passComplete) _advancePass(session, scores, allEntryIds)
  writeSession(session, game)
  return passComplete
}

/**
 * Master a card immediately. Removes from pass queue.
 */
export function recordMaster(entryId, allEntryIds, game='flashcard') {
  const scores  = readScores(game)
  const session = readSession(game)
  if (!session) return false

  session.passQueue = session.passQueue.filter(id => id !== entryId)
  session.passDone++

  scores[entryId] = MAX_SCORE
  writeScores(scores, game)

  const passComplete = session.passQueue.length === 0
  if (passComplete) _advancePass(session, scores, allEntryIds)
  writeSession(session, game)
  return passComplete
}

/**
 * Master a card across every recognition game (flashcard, pairmatch — not
 * stroke), as a deliberate "I know this word, stop showing it to me in
 * recognition games" action. Initializes a session for any recognition game
 * that hasn't been opened yet, so mastery still applies even if the person
 * has never played that game.
 */
export function recordMasterAll(entryId, allEntries) {
  const allEntryIds = allEntries.map(e => e.id)
  for (const game of RECOGNITION_GAMES) {
    if (!readSession(game)) initSession(allEntries, game)
    recordMaster(entryId, allEntryIds, game)
  }
}

export function resetAll(game='flashcard') {
  localStorage.removeItem(SCORES_KEY(game))
  localStorage.removeItem(SESSION_KEY(game))
}

/**
 * Manually open a specific box (0-5) on demand, e.g. when the person taps it
 * in the LeitnerBar UI, overriding the engine's automatic pick. All boxes
 * behave the same way once opened — including box 5 (mastered): it can be
 * reviewed manually like any other, a correct answer keeps it at 5, a wrong
 * answer drops it to 4. The only thing special about box 5 is that
 * _pickHighestBox() never selects it automatically. Returns the updated
 * pass state, or null if there's no active session or the requested box has
 * no cards.
 */
export function openBox(box, game='flashcard') {
  if (box < 0 || box > 5) return null
  const session = readSession(game)
  if (!session) return null

  const scores = readScores(game)
  const count = _boxCounts(session.entryIds, scores)[box]
  if (count === 0) return null  // nothing to open

  session.currentPass = box
  _openPass(session, scores)
  writeSession(session, game)
  return getPassState(game)
}

// ── Internal ──────────────────────────────────────────────────────────────────

function _openPass(session, scores) {
  const box = session.currentPass
  const cards = session.entryIds.filter(id => _boxOf(scores[id] ?? 0) === box)
  shuffle(cards)
  session.passQueue = cards
  session.passDone  = 0
  session.passTotal = cards.length
}

function _advancePass(session, scores, allEntryIds) {
  const ids = allEntryIds ?? session.entryIds
  const next = _pickNextBoxBelow(ids, scores, session.currentPass)
  session.currentPass = next ?? session.currentPass
  _openPass(session, scores)
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
