/**
 * Leitner SRS engine — pass-based, score-seeded box system.
 *
 * Score: persistent (0–5). 0=unseen, 1–4=active, 5=mastered.
 *   correct → score+1 (max 5)
 *   wrong   → score=1
 *
 * Session boxes (rebuilt from scores on open):
 *   box 1: up to 20 cards (filled from score-1, then score-0)
 *   box 2–4: up to 10 cards each (from score-N)
 *   stack: overflow + score-0 remainder
 *
 * Pass rhythm (1-2-4-8):
 *   pass 0: B1  pass 1: B1  pass 2: B2  pass 3: B1
 *   pass 4: B1  pass 5: B2  pass 6: B3  pass 7: B1 ...
 *
 *   Each pass = ALL cards in that box.
 *   Box 1 refills to 20 BEFORE each B1 pass opens.
 *   Wrong answers during a pass go to next B1 pass, not current.
 *
 * Storage:
 *   'leitnerScores'  → { id: 0-5 }            (persistent)
 *   'leitnerSession' → { boxes, stack,          (rebuilt each app open)
 *                        passIndex,             (which pass we're on)
 *                        currentPass,           (which box is active: 1-4)
 *                        passQueue: [id,...],   (cards remaining in current pass)
 *                        passDone: number,      (cards done in current pass)
 *                        passTotal: number }    (total cards when pass opened)
 */

const SCORES_KEY  = 'leitnerScores'
const SESSION_KEY = 'leitnerSession'
const BOX1_MAX    = 20
const BOXN_MAX    = 10
const MAX_SCORE   = 5

// ── Persistence ───────────────────────────────────────────────────────────────

function readScores() {
  try { return JSON.parse(localStorage.getItem(SCORES_KEY) || '{}') } catch { return {} }
}
function writeScores(s) { localStorage.setItem(SCORES_KEY, JSON.stringify(s)) }

function readSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
    if (s?.boxes && Array.isArray(s.stack)) return s
  } catch {}
  return null
}
function writeSession(s) { localStorage.setItem(SESSION_KEY, JSON.stringify(s)) }

// ── Score accessors ───────────────────────────────────────────────────────────

export function getScore(entryId)    { return readScores()[entryId] ?? 0 }
export function getAllScores()        { return readScores() }

export function getScoreCounts(entryIds) {
  const scores = readScores()
  const counts = [0,0,0,0,0,0]
  for (const id of entryIds) counts[Math.min(scores[id]??0,5)]++
  return counts
}

// ── Session init ──────────────────────────────────────────────────────────────

export function initSession(entries) {
  const scores = readScores()

  // Seed missing entries
  let changed = false
  for (const e of entries) {
    if (!(e.id in scores)) { scores[e.id] = 0; changed = true }
  }
  const ids = new Set(entries.map(e => e.id))
  for (const id of Object.keys(scores)) {
    if (!ids.has(id)) { delete scores[id]; changed = true }
  }
  if (changed) writeScores(scores)

  // Group by score
  const byScore = {0:[],1:[],2:[],3:[],4:[],5:[]}
  for (const e of entries) {
    const s = Math.min(scores[e.id]??0, 5)
    byScore[s].push(e.id)
  }
  for (const arr of Object.values(byScore)) shuffle(arr)

  // Seed boxes
  const boxes = {}
  const stack = [...byScore[0]]

  for (const s of [1,2,3,4]) {
    const limit = s === 1 ? BOX1_MAX : BOXN_MAX
    const words = byScore[s]
    for (const id of words.slice(0, limit))  boxes[id] = s
    stack.push(...words.slice(limit))
  }

  // Top up box 1 from score-0 stack
  _topUpBox1(boxes, stack, scores)

  // Open the first pass (B1)
  const session = {
    boxes, stack,
    b1PassCount:  0,
    passSchedule: [],
    currentPass:  1,
    passQueue:    [],
    passDone:     0,
    passTotal:    0,
    pendingWrong: [],
  }
  _openPass(session, scores)
  writeSession(session)
  return session
}

export function getSession(entries) {
  return readSession() ?? initSession(entries)
}

// ── Box/pass accessors ────────────────────────────────────────────────────────

export function getBox(entryId) {
  const s = readSession()
  if (!s) return 0
  return s.boxes[entryId] ?? 0
}

export function getBoxCounts(entryIds) {
  const session = readSession()
  const scores  = readScores()
  if (!session) return [0,0,0,0,0,0]
  const counts = [0,0,0,0,0,0]
  for (const id of entryIds) {
    const box = session.boxes[id]
    if (box >= 1 && box <= 4) { counts[box]++; continue }
    if ((scores[id]??0) === 5)  { counts[5]++; continue }
    counts[0]++
  }
  return counts
}

/**
 * Returns pass progress for the status bar display.
 * {
 *   passIndex,     // 0-based global pass count
 *   currentPass,   // which box is active (1-4)
 *   passDone,      // cards done in current pass
 *   passTotal,     // total cards in current pass
 *   barFills: {    // 0-1 fill for each box's status bar
 *     1: 0.6,      // within-pass progress for active box, inter-pass for others
 *     2: 0.5,
 *     3: 0.25,
 *     4: 0.125,
 *   }
 * }
 */
export function getPassState() {
  const s = readSession()
  if (!s) return { b1PassCount:0, currentPass:1, passDone:0, passTotal:0, barFills:{1:0,2:0,3:0,4:0}, passQueue:[] }

  const { b1PassCount = 0, currentPass, passDone, passTotal } = s
  const withinFill = passTotal > 0 ? passDone / passTotal : 0

  const barFills = {}
  for (const b of [1,2,3,4]) {
    if (b === currentPass) {
      barFills[b] = withinFill
    } else {
      // How far through the inter-pass interval for this box
      const period = Math.pow(2, b - 1)   // B2=2, B3=4, B4=8
      barFills[b] = (b1PassCount % period) / period
    }
  }

  return { b1PassCount, currentPass, passDone, passTotal, barFills, passQueue: s.passQueue ?? [] }
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
 * Record correct answer. Advances score and box. Removes from pass queue.
 * Returns true if pass is now complete.
 */
export function recordCorrect(entryId, allEntryIds) {
  const scores  = readScores()
  const session = readSession()
  if (!session) return false

  // Remove from pass queue
  session.passQueue = session.passQueue.filter(id => id !== entryId)
  session.passDone++

  // Score + box advance
  const oldScore = scores[entryId] ?? 0
  scores[entryId] = Math.min(oldScore + 1, MAX_SCORE)
  writeScores(scores)

  const oldBox = session.boxes[entryId] ?? 0
  const newBox = Math.min(oldBox + 1, MAX_SCORE)
  if (newBox === MAX_SCORE) delete session.boxes[entryId]
  else session.boxes[entryId] = newBox

  const passComplete = session.passQueue.length === 0
  if (passComplete) _advancePass(session, scores, allEntryIds)
  writeSession(session)
  return passComplete
}

/**
 * Record wrong answer. Score→1. Card deferred to next B1 pass.
 * Returns true if pass is now complete.
 */
export function recordWrong(entryId, allEntryIds) {
  const scores  = readScores()
  const session = readSession()
  if (!session) return false

  session.passQueue = session.passQueue.filter(id => id !== entryId)
  session.passDone++

  scores[entryId] = 1
  writeScores(scores)

  // Keep in box 1 (or move to box 1 if it was higher)
  session.boxes[entryId] = 1
  // Defer to next B1 pass
  if (!session.pendingWrong.includes(entryId)) {
    session.pendingWrong.push(entryId)
  }

  const passComplete = session.passQueue.length === 0
  if (passComplete) _advancePass(session, scores, allEntryIds)
  writeSession(session)
  return passComplete
}

/**
 * Master a card immediately. Removes from pass queue.
 */
export function recordMaster(entryId, allEntryIds) {
  const scores  = readScores()
  const session = readSession()
  if (!session) return false

  session.passQueue = session.passQueue.filter(id => id !== entryId)
  session.passDone++

  scores[entryId] = MAX_SCORE
  writeScores(scores)
  delete session.boxes[entryId]

  const passComplete = session.passQueue.length === 0
  if (passComplete) _advancePass(session, scores, allEntryIds)
  writeSession(session)
  return passComplete
}

export function resetAll() {
  localStorage.removeItem(SCORES_KEY)
  localStorage.removeItem(SESSION_KEY)
}

// ── Internal ──────────────────────────────────────────────────────────────────

/**
 * After completing b1PassCount B1 passes, which higher boxes are due?
 * B2 due every 2nd B1 pass, B3 every 4th, B4 every 8th.
 * Returns array of box numbers due (may be empty, or [2], or [2,3], etc.)
 */
function _higherBoxesDue(b1PassCount) {
  const due = []
  if (b1PassCount > 0 && b1PassCount % 2 === 0) due.push(2)
  if (b1PassCount > 0 && b1PassCount % 4 === 0) due.push(3)
  if (b1PassCount > 0 && b1PassCount % 8 === 0) due.push(4)
  return due
}

function _openPass(session, scores) {
  const box = session.currentPass
  let cards

  if (box === 1) {
    _topUpBox1(session.boxes, session.stack, scores)
    for (const id of session.pendingWrong) {
      if (!session.boxes[id]) session.boxes[id] = 1
    }
    session.pendingWrong = []
    cards = Object.entries(session.boxes)
      .filter(([,b]) => b === 1)
      .map(([id]) => id)
  } else {
    cards = Object.entries(session.boxes)
      .filter(([,b]) => b === box)
      .map(([id]) => id)
  }

  shuffle(cards)
  session.passQueue = cards
  session.passDone  = 0
  session.passTotal = cards.length
}

function _advancePass(session, scores, allEntryIds) {
  // Ensure passSchedule exists (handles old localStorage sessions)
  if (!Array.isArray(session.passSchedule)) session.passSchedule = []
  if (typeof session.b1PassCount !== 'number') session.b1PassCount = 0

  // If schedule is empty, we just finished a B1 pass — build next schedule
  if (session.passSchedule.length === 0) {
    session.b1PassCount++
    const due = _higherBoxesDue(session.b1PassCount)
    // Queue: any due higher boxes (non-empty), then B1
    for (const b of due) {
      const count = Object.values(session.boxes).filter(x => x === b).length
      if (count > 0) session.passSchedule.push(b)
    }
    session.passSchedule.push(1)
  }

  // Take next box from schedule
  let next = session.passSchedule.shift()

  // Skip empty boxes — find next non-empty one
  for (let safety = 0; safety < 8; safety++) {
    if (next === undefined) { next = 1; break }
    const count = next === 1
      ? Object.values(session.boxes).filter(b => b === 1).length + (session.pendingWrong?.length ?? 0)
      : Object.values(session.boxes).filter(b => b === next).length
    if (count > 0) break
    // Empty — try next in schedule, or default to B1
    next = session.passSchedule.length > 0 ? session.passSchedule.shift() : 1
  }

  session.currentPass = next ?? 1
  _openPass(session, scores)
}

function _topUpBox1(boxes, stack, scores) {
  const b1count = Object.values(boxes).filter(b => b === 1).length
  if (b1count >= BOX1_MAX) return
  const slots = BOX1_MAX - b1count

  // Prefer score-1 words, then score-0
  let candidates = stack.filter(id => (scores[id]??0) === 1)
  if (candidates.length < slots) {
    candidates = candidates.concat(
      stack.filter(id => (scores[id]??0) === 0)
    )
  }
  shuffle(candidates)

  let promoted = 0
  for (const id of candidates) {
    if (promoted >= slots) break
    boxes[id] = 1
    const idx = stack.indexOf(id)
    if (idx >= 0) stack.splice(idx, 1)
    promoted++
  }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
