/**
 * Mnemonic engine — per-entry user-written memory hooks.
 * Stored in localStorage under 'vocabMnemonics'.
 *
 * Shape: { [entryId]: { mnemonic: string, updatedAt: number, seeded: boolean } }
 *
 * Seed files live at public/mnemonics/<listId>.json
 * Format: { "<entry text>": "<mnemonic string>", ... }
 * Seeds NEVER overwrite user-written mnemonics (seeded: false means user-written).
 */

const STORAGE_KEY = 'vocabMnemonics'
const SEEDED_KEY  = 'vocabMnemonicsSeeded' // tracks which lists have been seeded

function read() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }
  catch { return {} }
}

function write(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

function readSeeded() {
  try { return JSON.parse(localStorage.getItem(SEEDED_KEY) || '[]') }
  catch { return [] }
}

function markSeeded(listId) {
  const seeded = readSeeded()
  if (!seeded.includes(listId)) {
    localStorage.setItem(SEEDED_KEY, JSON.stringify([...seeded, listId]))
  }
}

export function getMnemonic(entryId) {
  return read()[entryId]?.mnemonic ?? ''
}

export function setMnemonic(entryId, text) {
  const store = read()
  if (text.trim() === '') {
    delete store[entryId]
  } else {
    store[entryId] = { mnemonic: text.trim(), updatedAt: Date.now(), seeded: false }
  }
  write(store)
}

export function getAllMnemonics() {
  return read()
}

/**
 * Load and apply seed mnemonics for a vocab list.
 * entries: array of { id, entry } objects from the loaded list.
 * listId:  e.g. 'zh-en' — used to fetch public/mnemonics/zh-en.json
 *
 * Only runs once per listId (tracked in localStorage).
 * Never overwrites user-written mnemonics (seeded: false).
 */
export async function seedMnemonics(listId, entries) {
  const alreadySeeded = readSeeded()
  if (alreadySeeded.includes(listId)) return

  let seeds
  try {
    const res = await fetch(`./mnemonics/${listId}.json`)
    if (!res.ok) return  // no seed file for this language — silently skip
    seeds = await res.json()
  } catch {
    return
  }

  // Build a lookup: entry text → entryId
  const textToId = {}
  for (const e of entries) {
    textToId[e.entry] = e.id
  }

  const store = read()
  let changed = false

  for (const [entryText, mnemonicText] of Object.entries(seeds)) {
    if (entryText.startsWith('_')) continue  // skip _note etc.
    const entryId = textToId[entryText]
    if (!entryId) continue  // entry not in this list
    if (store[entryId] && !store[entryId].seeded) continue  // user-written — don't touch

    store[entryId] = { mnemonic: mnemonicText, updatedAt: Date.now(), seeded: true }
    changed = true
  }

  if (changed) write(store)
  markSeeded(listId)
}
