/**
 * Grammar engine
 *
 * Handles:
 * - Loading grammar patterns from public/grammar/<lang>-en.json
 * - Parsing templates with {[option1|option2|...]} wildcards
 * - Generating distractors for fill-blank exercises
 * - Occurrence-based SRS scoring (localStorage: 'grammarScores')
 * - Pattern pool sorting by priority (low accuracy first)
 */

const STORAGE_KEY = 'grammarScores'

// ── Persistence ───────────────────────────────────────────────────────────────

function readScores() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }
  catch { return {} }
}

function writeScores(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function getGrammarScore(patternId) {
  return readScores()[patternId] ?? { attempts: 0, correct: 0, streak: 0 }
}

export function getAllGrammarScores() {
  return readScores()
}

export function recordGrammarCorrect(patternId) {
  const store = readScores()
  const rec = store[patternId] ?? { attempts: 0, correct: 0, streak: 0 }
  store[patternId] = { attempts: rec.attempts + 1, correct: rec.correct + 1, streak: rec.streak + 1 }
  writeScores(store)
}

export function recordGrammarWrong(patternId) {
  const store = readScores()
  const rec = store[patternId] ?? { attempts: 0, correct: 0, streak: 0 }
  store[patternId] = { attempts: rec.attempts + 1, correct: rec.correct, streak: 0 }
  writeScores(store)
}

export function resetGrammarScore(patternId) {
  const store = readScores()
  delete store[patternId]
  writeScores(store)
}

// ── Loading ───────────────────────────────────────────────────────────────────

export async function loadGrammarPatterns(languageId) {
  try {
    const res = await fetch(`./grammar/${languageId}-en.json`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// ── Pattern sorting by priority ───────────────────────────────────────────────

/**
 * Sort patterns: unseen first, then by low accuracy, then by low streak.
 * Never blocks — just orders.
 */
export function sortPatternsByPriority(patterns) {
  const scores = readScores()
  return [...patterns].sort((a, b) => {
    const sa = scores[a.id] ?? { attempts: 0, correct: 0, streak: 0 }
    const sb = scores[b.id] ?? { attempts: 0, correct: 0, streak: 0 }
    // Unseen first
    if (sa.attempts === 0 && sb.attempts > 0) return -1
    if (sb.attempts === 0 && sa.attempts > 0) return 1
    // Both unseen — preserve order
    if (sa.attempts === 0 && sb.attempts === 0) return 0
    // Sort by accuracy (lower accuracy = higher priority)
    const accA = sa.correct / sa.attempts
    const accB = sb.correct / sb.attempts
    if (Math.abs(accA - accB) > 0.1) return accA - accB
    // Tiebreak by streak (lower streak = higher priority)
    return sa.streak - sb.streak
  })
}

// ── Template parsing ──────────────────────────────────────────────────────────

/**
 * Parse a fill-blank template.
 * Finds the first {[...]} wildcard, picks a random option,
 * and returns { displayText, correctAnswer, blankPosition }.
 *
 * Wildcard formats:
 *   {[option1|option2|option3]}
 *     — picks one; the whole thing is displayed, blank is ___
 *   {[display:answer|display:answer]}
 *     — display shown in sentence, answer is what fills the blank
 *
 * Returns:
 *   {
 *     text: string with ___ for blank and chosen word shown,
 *     correctAnswer: string,
 *     chosenOption: string (what's shown in brackets),
 *   }
 */
export function instantiateTemplate(template) {
  const match = template.match(/\{(\[.*?\])\}/)
  if (!match) return { text: template, correctAnswer: '', chosenOption: '' }

  const optionsStr = match[1].slice(1, -1) // strip [ ]
  const options = optionsStr.split('|')
  const chosen = options[Math.floor(Math.random() * options.length)]

  let displayWord, correctAnswer
  if (chosen.includes(':')) {
    const [display, answer] = chosen.split(':')
    displayWord = display
    correctAnswer = answer
  } else {
    // The chosen option IS the answer — extract article or key word
    displayWord = chosen
    correctAnswer = chosen.split(' ')[0] // first word (usually the article/particle)
  }

  const text = template.replace(/\{(\[.*?\])\}/, `(${displayWord})`)
  return { text, correctAnswer, chosenOption: displayWord }
}

// ── Distractor generation ─────────────────────────────────────────────────────

const DISTRACTOR_SETS = {
  // German articles
  'auto:nominative-article':       ['der', 'die', 'das'],
  'auto:accusative-article':       ['den', 'die', 'das'],
  'auto:accusative-article-masc':  ['den', 'dem', 'der'],
  'auto:dative-article':           ['dem', 'der', 'den'],
  // German verb conjugations
  'auto:sein-present':   ['bin', 'bist', 'ist', 'sind', 'seid'],
  'auto:haben-present':  ['habe', 'hast', 'hat', 'haben', 'habt'],
  'auto:regular-ich':    ['esse', 'lerne', 'arbeite', 'trinke', 'mache', 'kaufe'],
  'auto:müssen-present': ['muss', 'musst', 'müssen', 'müsst'],
  // German other
  'auto:participle-confusion': ['gelesen', 'gelernt', 'gegessen', 'gehört', 'gefahren', 'gemacht'],
  'auto:adj-ending-nom':        ['alte', 'alten', 'alter', 'altem'],
  // Chinese particles
  'auto:aspect-le-guo':   ['了', '过', '着', '的'],
  'auto:de-di-de':        ['的', '地', '得'],
  // Spanish articles
  'auto:ser-present':   ['soy', 'eres', 'es', 'somos', 'sois', 'son'],
  'auto:estar-present': ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'],
  // Japanese particles
  'auto:jp-particles': ['は', 'が', 'を', 'に', 'で', 'も', 'の'],
  'auto:jp-te-forms':  ['て', 'で', 'って', 'んで'],
}

/**
 * Get distractors for a pattern, excluding the correct answer.
 * Returns an array of 3 distractors.
 */
export function getDistractors(pattern, correctAnswer) {
  const raw = pattern.distractors ?? []
  let pool = []

  for (const d of raw) {
    if (typeof d === 'string' && d.startsWith('auto:')) {
      pool.push(...(DISTRACTOR_SETS[d] ?? []))
    } else if (typeof d === 'string') {
      pool.push(d)
    }
  }

  // Remove correct answer and deduplicate
  const filtered = [...new Set(pool.filter(d => d !== correctAnswer))]

  // Shuffle and take 3
  const shuffled = filtered.sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 3)
}

/**
 * Build the full options list (correct + distractors, shuffled).
 * Returns [{ text, correct }]
 */
export function buildOptions(pattern, correctAnswer) {
  const distractors = getDistractors(pattern, correctAnswer)
  const options = [
    { text: correctAnswer, correct: true },
    ...distractors.map(d => ({ text: d, correct: false })),
  ]
  return options.sort(() => Math.random() - 0.5)
}

// ── Tile-order helpers ────────────────────────────────────────────────────────

/**
 * Check if a given tile order matches any accepted answer.
 * Returns { correct: bool, matchedAnswer: answer object | null }
 */
export function checkTileOrder(tiles, userOrder, answers) {
  for (const answer of answers) {
    const answerStr = answer.order.map(i => tiles[i]).join(' ')
    const userStr   = userOrder.map(i => tiles[i]).join(' ')
    if (userStr === answerStr) {
      return { correct: true, matchedAnswer: answer }
    }
  }
  return { correct: false, matchedAnswer: null }
}

/**
 * Get all alternative accepted answers (excluding the matched one).
 */
export function getAlternatives(tiles, answers, matchedAnswer) {
  return answers
    .filter(a => a !== matchedAnswer && a.note)
    .map(a => ({
      sentence: a.order.map(i => tiles[i]).join(' '),
      note: a.note,
    }))
}

// ── Pick-correct helpers ──────────────────────────────────────────────────────

/**
 * Shuffle sentences for a pick-correct exercise.
 * Always returns 3 sentences: 1 correct + 2 wrong (or all if <= 3).
 */
export function buildPickCorrectOptions(sentences) {
  const correct = sentences.filter(s => s.correct)
  const wrong   = sentences.filter(s => !s.correct)

  // Pick 1 correct + 2 wrong
  const chosenCorrect = correct.sort(() => Math.random() - 0.5).slice(0, 1)
  const chosenWrong   = wrong.sort(() => Math.random() - 0.5).slice(0, 2)

  return [...chosenCorrect, ...chosenWrong].sort(() => Math.random() - 0.5)
}

// ── Filter by level ───────────────────────────────────────────────────────────

const LEVEL_ORDER = ['HSK1','HSK2','HSK3','HSK4','HSK5','HSK6','HSK7','A1','A2','B1','B2','C1','C2']

export function filterPatternsByLevel(patterns, selectedLevels) {
  if (!selectedLevels || selectedLevels.length === 0) return patterns
  return patterns.filter(p => selectedLevels.includes(p.level))
}

export function getLevelsFromPatterns(patterns) {
  const set = new Set(patterns.map(p => p.level))
  return [...set].sort((a, b) => LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b))
}

export function getCategoriesFromPatterns(patterns) {
  return [...new Set(patterns.map(p => p.category))]
}
