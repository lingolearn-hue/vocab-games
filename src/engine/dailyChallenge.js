/**
 * Daily Challenge engine ("Thiede function") — real-world, phone-free
 * micro-exercises. No correctness checking, no time pressure: purely
 * user-attested. See /mnt/user-data/outputs/daily-challenge-function-design.md
 * for the full design discussion this implements.
 *
 * Structure: each weekday (0=Sun..6=Sat) has one fixed "core idea" (a
 * CHALLENGE_TYPE), each of which has several "flavor" variants. "Today's
 * task" = today's weekday's core idea + a chosen/rotating flavor.
 *
 * Flavors carry a stable string `id`, not an array index. This matters:
 * favorites/counts/open-challenges are persisted keyed on typeId+flavorId,
 * so reordering, inserting, or removing flavors in FLAVORS never silently
 * repoints a user's saved data at the wrong sentence. dailyChallengeExamples.js
 * mirrors these same ids.
 *
 * State persisted to localStorage under STORAGE_KEY, keyed per language so
 * favorites/history/counts don't bleed across languages.
 */

const STORAGE_KEY = 'dailyChallengeState'

// Core idea per weekday. JS Date#getDay(): 0=Sun, 1=Mon, ... 6=Sat.
export const WEEKDAY_TYPE = {
  0: 'describe-day',
  1: 'naming',
  2: 'constraint',
  3: 'narrating',
  4: 'recap',
  5: 'signs',
  6: 'postit',
}

export const CHALLENGE_TYPES = [
  { id: 'naming',      label: 'Naming things you see',      weekday: 'Monday' },
  { id: 'constraint',  label: 'Colour / category constraint', weekday: 'Tuesday' },
  { id: 'narrating',   label: 'Narrating your actions',      weekday: 'Wednesday' },
  { id: 'recap',       label: '"Previously, in my workday"', weekday: 'Thursday' },
  { id: 'signs',       label: 'Signs and notices',           weekday: 'Friday' },
  { id: 'postit',      label: 'Post-it labeling',            weekday: 'Saturday' },
  { id: 'describe-day',label: 'Describe your day to a friend', weekday: 'Sunday' },
]

// Flavors per core idea. Ragged on purpose — not every core idea needs the
// same number of variants. `id` is stable and must match the corresponding
// entry in dailyChallengeExamples.js. `text` is in English; it's an
// instruction for what to do, not target-language content, so it isn't
// translated per language.
export const FLAVORS = {
  naming: [
    { id: 'naming-desk',    text: 'Name everything you see that\'s on your desk or table.' },
    { id: 'naming-vehicle', text: 'Name every vehicle you see today.' },
    { id: 'naming-food',    text: 'Name the food and drink you have today, as you have it.' },
    { id: 'naming-room',    text: 'Name everything you see in one room of your home.' },
  ],
  constraint: [
    { id: 'constraint-red',     text: 'Today, only name red things.' },
    { id: 'constraint-kitchen', text: 'Today, only name kitchen things.' },
    { id: 'constraint-metal',   text: 'Today, only name things made of metal.' },
    { id: 'constraint-onehand', text: 'Today, only name things you can hold in one hand.' },
    { id: 'constraint-clothing',text: 'Today, only name clothing you or others are wearing.' },
  ],
  narrating: [
    { id: 'narrating-morning', text: 'Narrate your morning routine as you do it.' },
    { id: 'narrating-meal',    text: 'Narrate making a drink or a meal as you do it.' },
    { id: 'narrating-commute', text: 'Narrate a short walk or commute as you take it.' },
    { id: 'narrating-chore',   text: 'Narrate tidying up or a chore as you do it.' },
  ],
  recap: [
    { id: 'recap-break',    text: 'At your first break, give a 30-second "previously on my workday" recap.' },
    { id: 'recap-lunch',    text: 'At lunch, recap the morning as if introducing an episode.' },
    { id: 'recap-tomorrow', text: 'At the end of the day, do a "next time on…" teaser for tomorrow.' },
  ],
  signs: [
    { id: 'signs-street',     text: 'Translate every street sign you pass today.' },
    { id: 'signs-elevator',   text: 'Translate every elevator or lift notice you see today.' },
    { id: 'signs-safety',     text: 'Translate every safety sign or notice you see today.' },
    { id: 'signs-shop',       text: 'Translate every shop or restaurant sign you pass today.' },
    { id: 'signs-menu',       text: 'Translate every menu item you come across today.' },
  ],
  postit: [
    { id: 'postit-household', text: 'Label ten household objects with sticky notes.' },
    { id: 'postit-room',      text: 'Label everything in one room (kitchen, bathroom, etc).' },
    { id: 'postit-fridge',    text: 'Label the contents of your fridge or pantry.' },
    { id: 'postit-desk',      text: 'Label items on your desk or workspace.' },
  ],
  'describe-day': [
    { id: 'describe-day-whole',    text: 'Describe your whole day out loud, as if telling a friend.' },
    { id: 'describe-day-voicemsg', text: 'Describe your day as a voice message you\'d actually send.' },
    { id: 'describe-day-bestworst',text: 'Describe the best and worst part of your day.' },
    { id: 'describe-day-tomorrow', text: 'Describe your day and your plan for tomorrow.' },
  ],
}

export function typeLabel(typeId) {
  return CHALLENGE_TYPES.find(t => t.id === typeId)?.label ?? typeId
}

export function flavorText(typeId, flavorId) {
  return FLAVORS[typeId]?.find(f => f.id === flavorId)?.text ?? ''
}

export function todaysType(date = new Date()) {
  return WEEKDAY_TYPE[date.getDay()]
}

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10) // YYYY-MM-DD
}

function emptyLangState() {
  return {
    // date-scoped "today" pick, so it stays stable across re-renders/re-opens
    // within the same day but is naturally fresh on a new day
    todayDate: null,
    todayType: null,
    todayFlavorId: null,
    // challenges the user has explicitly accepted but not yet marked done
    // { key: 'typeId::flavorId', typeId, flavorId, acceptedAt }
    open: {},
    // cumulative completion counts, keyed 'typeId::flavorId'
    counts: {},
    // favorited keys, keyed 'typeId::flavorId' -> true
    favorites: {},
  }
}

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveAll(all) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    // storage full or unavailable — silently drop, non-critical feature
  }
}

export function challengeKey(typeId, flavorId) {
  return `${typeId}::${flavorId}`
}

function randomFlavorId(typeId, excludeId = null) {
  const flavors = FLAVORS[typeId] || []
  if (flavors.length === 0) return null
  if (flavors.length === 1) return flavors[0].id
  let flavor
  do {
    flavor = flavors[Math.floor(Math.random() * flavors.length)]
  } while (flavor.id === excludeId)
  return flavor.id
}

/** Load (and lazily initialize) today's state for a language. */
export function getState(lang) {
  const all = loadAll()
  const state = all[lang] || emptyLangState()
  const key = todayKey()

  if (state.todayDate !== key) {
    // new day (or first ever load): pick fresh core idea + random flavor
    state.todayDate = key
    state.todayType = todaysType()
    state.todayFlavorId = randomFlavorId(state.todayType)
    all[lang] = state
    saveAll(all)
  }
  return state
}

function updateState(lang, mutate) {
  const all = loadAll()
  const state = all[lang] || emptyLangState()
  mutate(state)
  all[lang] = state
  saveAll(all)
  return state
}

/** Swap today's task to a different core idea (random, excluding current), keep a random flavor. */
export function changeTask(lang) {
  return updateState(lang, state => {
    const otherTypes = CHALLENGE_TYPES.map(t => t.id).filter(id => id !== state.todayType)
    state.todayType = otherTypes[Math.floor(Math.random() * otherTypes.length)]
    state.todayFlavorId = randomFlavorId(state.todayType)
  })
}

/** Swap today's flavor within the same core idea. */
export function changeFlavor(lang) {
  return updateState(lang, state => {
    state.todayFlavorId = randomFlavorId(state.todayType, state.todayFlavorId)
  })
}

/** Manually pick a specific type+flavor as today's task (from the grid browser). */
export function pickTask(lang, typeId, flavorId) {
  return updateState(lang, state => {
    state.todayType = typeId
    state.todayFlavorId = flavorId
  })
}

/** Accept today's task into the open-challenges list. */
export function acceptChallenge(lang, typeId, flavorId) {
  return updateState(lang, state => {
    const key = challengeKey(typeId, flavorId)
    state.open[key] = { typeId, flavorId, acceptedAt: Date.now() }
  })
}

/** Cancel an open challenge without counting it as completed. */
export function cancelChallenge(lang, key) {
  return updateState(lang, state => {
    delete state.open[key]
  })
}

/** Mark an open challenge finished: removes from open, increments its completion count. */
export function finishChallenge(lang, key) {
  return updateState(lang, state => {
    delete state.open[key]
    state.counts[key] = (state.counts[key] || 0) + 1
  })
}

/** Mark today's task done directly (without going through the open list). */
export function markTodayDone(lang) {
  return updateState(lang, state => {
    const key = challengeKey(state.todayType, state.todayFlavorId)
    delete state.open[key]
    state.counts[key] = (state.counts[key] || 0) + 1
  })
}

export function toggleFavorite(lang, key) {
  return updateState(lang, state => {
    if (state.favorites[key]) delete state.favorites[key]
    else state.favorites[key] = true
  })
}
