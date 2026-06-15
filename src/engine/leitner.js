/**
 * Leitner SRS engine — 5-box system for flashcards.
 *
 * Box 0: unseen pool (waiting room)
 * Box 1: active, reviewed every pass     (max 20 cards)
 * Box 2: reviewed every 2nd pass
 * Box 3: reviewed every 4th pass
 * Box 4: reviewed every 8th pass
 * Box 5: mastered / retired
 *
 * Sequence: B1 B1 B2 B1 B1 B2 B3 B1 B1 B2 B1 B1 B2 B3 B4 ...
 * (binary counting — each position reviews the box = trailing 1s + 1)
 *
 * Rules:
 * - Correct → advance one box
 * - Wrong   → back to box 1
 * - When a word graduates from box 1 and box 1 has room (≤ BOX1_MAX),
 *   pull a new word from box 0 into box 1
 *
 * Storage: localStorage 'leitnerState' → { boxes: { entryId: 0-5 }, passCount: N }
 */

const STORAGE_KEY = 'leitnerState'
const BOX1_MAX    = 20
const MAX_BOX     = 5

// ── Persistence ───────────────────────────────────────────────────────────────

function readState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (s && typeof s === 'object') return s
  } catch {}
  return { boxes: {}, passCount: 0 }
}

function writeState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

// ── Box helpers ───────────────────────────────────────────────────────────────

export function getBox(entryId) {
  return readState().boxes[entryId] ?? 0
}

export function getAllBoxes() {
  return readState().boxes
}

/**
 * Initialise a set of entries into the Leitner system.
 * New entries go into box 0. Existing entries keep their box.
 * Called when vocab list changes.
 */
export function initEntries(entries) {
  const state = readState()
  let changed = false
  for (const e of entries) {
    if (!(e.id in state.boxes)) {
      state.boxes[e.id] = 0
      changed = true
    }
  }
  // Remove entries no longer in the active list
  const ids = new Set(entries.map(e => e.id))
  for (const id of Object.keys(state.boxes)) {
    if (!ids.has(id)) {
      delete state.boxes[id]
      changed = true
    }
  }
  if (changed) writeState(state)
}

/**
 * Count entries in each box for a given set of entry IDs.
 * Returns [b0count, b1count, b2count, b3count, b4count, b5count]
 */
export function getBoxCounts(entryIds) {
  const state = readState()
  const counts = [0, 0, 0, 0, 0, 0]
  for (const id of entryIds) {
    const box = state.boxes[id] ?? 0
    counts[Math.min(box, 5)]++
  }
  return counts
}

// ── Pass sequence ─────────────────────────────────────────────────────────────

/**
 * Given the current pass count (0-based), which box is due?
 * Binary counting: pass 0→B1, 1→B1, 2→B2, 3→B1, 4→B1, 5→B2, 6→B3...
 * Box = index of lowest set bit in (passCount + 1), capped at 4.
 */
export function boxDueForPass(passCount) {
  const n = passCount + 1
  // Number of trailing zeros in n = position of lowest set bit
  // Box 1 is the minimum, so: trailing zeros = 0 → box 1, etc.
  let trailing = 0
  let x = n
  while ((x & 1) === 0) { trailing++; x >>= 1 }
  return Math.min(trailing + 1, 4)  // cap at box 4 (box 5 = mastered)
}

/**
 * Build the ordered card sequence for the current session.
 * Returns array of entryIds in the order they should be shown.
 *
 * A "pass" is one full run through box 1 (or the due box).
 * We pre-compute enough passes to cover all active cards.
 */
export function buildSequence(entryIds) {
  const state  = readState()
  const boxes  = state.boxes

  // Group entry IDs by box
  const byBox  = { 1: [], 2: [], 3: [], 4: [] }
  for (const id of entryIds) {
    const b = boxes[id] ?? 0
    if (b >= 1 && b <= 4) byBox[b].push(id)
  }

  // Shuffle within each box
  for (const b of [1, 2, 3, 4]) shuffle(byBox[b])

  // Build sequence using the binary pass pattern
  // Each "pass" reviews B1, and conditionally B2/B3/B4
  const sequence = []
  const b1 = [...byBox[1]]
  const b2 = [...byBox[2]]
  const b3 = [...byBox[3]]
  const b4 = [...byBox[4]]

  let passCount = state.passCount
  let b1idx = 0, b2idx = 0, b3idx = 0, b4idx = 0

  // Continue until all active boxes are exhausted
  const totalActive = b1.length + b2.length + b3.length + b4.length
  if (totalActive === 0) return []

  let safety = 0
  while ((b1idx < b1.length || b2idx < b2.length || b3idx < b3.length || b4idx < b4.length) && safety++ < 1000) {
    const dueBox = boxDueForPass(passCount)

    // Always add one B1 card per pass
    if (b1idx < b1.length) sequence.push({ id: b1[b1idx++], box: 1 })

    // Add due higher-box card
    if (dueBox === 2 && b2idx < b2.length) sequence.push({ id: b2[b2idx++], box: 2 })
    if (dueBox === 3 && b3idx < b3.length) { sequence.push({ id: b3[b3idx++], box: 3 }) }
    if (dueBox === 4 && b4idx < b4.length) { sequence.push({ id: b4[b4idx++], box: 4 }) }

    passCount++
  }

  return sequence
}

// ── Scoring ───────────────────────────────────────────────────────────────────

/**
 * Record a correct answer. Advances word one box.
 * If graduating from box 1, pulls a new word from box 0 if space available.
 * Returns the new box number.
 */
export function recordCorrect(entryId, allEntryIds) {
  const state  = readState()
  const curBox = state.boxes[entryId] ?? 0
  const newBox = Math.min(curBox + 1, MAX_BOX)
  state.boxes[entryId] = newBox

  // If graduated from box 1, maybe pull from box 0
  if (curBox === 1) {
    _maybePromoteFromBox0(state, allEntryIds)
  }

  writeState(state)
  return newBox
}

/**
 * Record a wrong answer. Always sends word back to box 1.
 * Returns the new box number (always 1).
 */
export function recordWrong(entryId) {
  const state  = readState()
  const curBox = state.boxes[entryId] ?? 0
  state.boxes[entryId] = Math.max(1, curBox > 0 ? 1 : 0)
  // If word was in box 0 (unseen), promote to box 1
  if (curBox === 0) state.boxes[entryId] = 1
  writeState(state)
  return 1
}

/**
 * Manually master a word (swipe up).
 */
export function recordMaster(entryId, allEntryIds) {
  const state = readState()
  const curBox = state.boxes[entryId] ?? 0
  state.boxes[entryId] = MAX_BOX
  if (curBox === 1) _maybePromoteFromBox0(state, allEntryIds)
  writeState(state)
  return MAX_BOX
}

/**
 * Increment pass counter (call when a full B1 pass completes).
 */
export function incrementPassCount() {
  const state = readState()
  state.passCount = (state.passCount ?? 0) + 1
  writeState(state)
  return state.passCount
}

/**
 * Reset a word to box 1 (from vocab browser).
 */
export function resetToBox1(entryId) {
  const state = readState()
  state.boxes[entryId] = 1
  writeState(state)
}

/**
 * Reset everything for a fresh start.
 */
export function resetAll() {
  localStorage.removeItem(STORAGE_KEY)
}

// ── Internal ──────────────────────────────────────────────────────────────────

function _maybePromoteFromBox0(state, allEntryIds) {
  // Count current box 1 size
  const b1count = allEntryIds.filter(id => (state.boxes[id] ?? 0) === 1).length
  if (b1count >= BOX1_MAX) return

  // Find first box 0 entry (preserve insertion order)
  const box0 = allEntryIds.filter(id => (state.boxes[id] ?? 0) === 0)
  if (box0.length === 0) return

  // Pick randomly from box 0
  const idx = Math.floor(Math.random() * box0.length)
  state.boxes[box0[idx]] = 1
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
