/**
 * TSV Dialogue Parser — full chapter format
 *
 * Handles directives:
 *   @columns     id  speaker  cmd  en  zh  ja  de  es
 *   @chapter     num  titleEN  titleZH  titleJA  titleDE  titleES  level
 *   @artifact    icon  name  grammar
 *   @story_intro en  zh  ja  de  es
 *   @story_outro en  zh  ja  de  es
 *   @section     num  titleEN  titleZH  titleJA  titleDE  titleES
 *   @vocab       word1  word2  ...
 *   @grammar     patternId1  patternId2  ...
 *   @passage     num  titleEN  titleZH  titleJA  titleDE  titleES
 *   @passage_line  en  zh  ja  de  es
 *
 * Dialogue rows: adv010101-01  speaker  cmd  en  zh  ja  de  es
 */

export function parseTSV(tsv, language) {
  const lines = tsv.split('\n')
  let columns = null

  // Output structures
  const meta     = {}      // chapter, artifact, storyIntro, storyOutro
  const sections = []      // { num, title, vocab, grammar, dialogues, passages }

  let currentSection  = null
  let currentPassage  = null
  let currentDialogue = null   // { prefix, rows[] }

  const langOrder = ['en', 'zh', 'ja', 'de', 'es']

  function getLang(cells, startIdx) {
    // Returns { en, zh, ja, de, es } from cells starting at startIdx
    const result = {}
    langOrder.forEach((l, i) => { result[l] = cells[startIdx + i]?.trim() ?? '' })
    return result
  }

  function getTarget(langs) {
    return langs[language] || langs.en || ''
  }

  function ensureSection() {
    if (!currentSection) {
      currentSection = { num: '01', title: {}, vocab: [], grammar: [], dialogues: [], passages: [] }
      sections.push(currentSection)
    }
  }

  function flushDialogue() {
    if (currentDialogue && currentDialogue.rows.length) {
      ensureSection()
      const dl = buildDialogue(currentDialogue.prefix, currentDialogue.rows)
      if (dl) currentSection.dialogues.push(dl)
    }
    currentDialogue = null
  }

  function flushPassage() {
    if (currentPassage && currentPassage.lines.length) {
      const text = currentPassage.lines.map(l => getTarget(l)).join('　')
      const en   = currentPassage.lines.map(l => l.en).join(' ')
      ensureSection()
      currentSection.passages.push({
        num:              currentPassage.num,
        title:            getTarget(currentPassage.title),
        titleTranslation: currentPassage.title.en,
        text,
        translation:      en,
      })
    }
    currentPassage = null
  }

  for (let raw of lines) {
    raw = raw.trimEnd()
    if (!raw || raw.startsWith('#')) continue
    const cells = raw.split('\t')
    const tag   = cells[0].trim()

    // ── @columns ────────────────────────────────────────────────────────────
    if (tag === '@columns') {
      columns = {}
      cells.slice(1).forEach((name, i) => { columns[name.trim()] = i })
      continue
    }

    // ── @chapter ────────────────────────────────────────────────────────────
    if (tag === '@chapter') {
      // @chapter  num  en  zh  ja  de  es  level
      meta.chapterNum   = cells[1]?.trim()
      meta.chapterTitle = getLang(cells, 2)
      meta.level        = cells[7]?.trim() ?? ''
      continue
    }

    // ── @artifact ───────────────────────────────────────────────────────────
    if (tag === '@artifact') {
      meta.artifact = {
        icon:    cells[1]?.trim() ?? '',
        name:    cells[2]?.trim() ?? '',
        grammar: cells[3]?.trim() ?? '',
      }
      continue
    }

    // ── @story_intro / @story_outro ─────────────────────────────────────────
    if (tag === '@story_intro') {
      meta.storyIntro = getLang(cells, 1)
      continue
    }
    if (tag === '@story_outro') {
      meta.storyOutro = getLang(cells, 1)
      continue
    }

    // ── @section ────────────────────────────────────────────────────────────
    if (tag === '@section') {
      flushDialogue()
      flushPassage()
      currentSection = {
        num:       cells[1]?.trim(),
        title:     getLang(cells, 2),
        vocab:     [],
        grammar:   [],
        dialogues: [],
        passages:  [],
      }
      sections.push(currentSection)
      continue
    }

    // ── @vocab ──────────────────────────────────────────────────────────────
    if (tag === '@vocab') {
      ensureSection()
      currentSection.vocab = cells.slice(1).map(s => s.trim()).filter(Boolean)
      continue
    }

    // ── @grammar ─────────────────────────────────────────────────────────────
    if (tag === '@grammar') {
      ensureSection()
      currentSection.grammar = cells.slice(1).map(s => s.trim()).filter(Boolean)
      continue
    }

    // ── @passage ─────────────────────────────────────────────────────────────
    if (tag === '@passage') {
      flushDialogue()
      flushPassage()
      currentPassage = {
        num:   cells[1]?.trim(),
        title: getLang(cells, 2),
        lines: [],
      }
      continue
    }

    // ── @passage_line ────────────────────────────────────────────────────────
    if (tag === '@passage_line') {
      if (currentPassage) currentPassage.lines.push(getLang(cells, 1))
      continue
    }

    // ── Dialogue row ─────────────────────────────────────────────────────────
    if (!columns) continue
    const id      = cells[columns.id      ?? 0]?.trim()
    const speaker = cells[columns.speaker ?? 1]?.trim()
    const cmd     = cells[columns.cmd     ?? 2]?.trim() ?? ''
    if (!id || !speaker) continue

    const langIdx = columns[language]
    const enIdx   = columns.en ?? 3
    const text    = (langIdx !== undefined && cells[langIdx]?.trim()) || cells[enIdx]?.trim() || ''
    const en      = cells[enIdx]?.trim() ?? ''

    const prefix = getDialoguePrefix(id)
    if (!currentDialogue || currentDialogue.prefix !== prefix) {
      flushDialogue()
      flushPassage()
      currentDialogue = { prefix, rows: [] }
    }
    currentDialogue.rows.push({ id, speaker, cmd, text, en })
  }

  flushDialogue()
  flushPassage()

  return { meta, sections }
}

export async function loadTSVChapter(path, language) {
  try {
    const res = await fetch(path)
    if (!res.ok) return null
    const text = await res.text()
    return parseTSV(text, language)
  } catch { return null }
}

// Keep old name as alias for compatibility
export const loadTSVDialogue = loadTSVChapter

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDialoguePrefix(id) {
  const dash = id.lastIndexOf('-')
  return dash < 0 ? id : id.slice(0, dash)
}

function splitId(id) {
  const dash = id.lastIndexOf('-')
  if (dash < 0) return [id, '0', '']
  const local = id.slice(dash + 1)
  const m = local.match(/^(\d+)([a-z]*)$/)
  return [id.slice(0, dash), m ? m[1] : local, m ? m[2] : '']
}

function buildDialogue(prefix, rows) {
  rows.sort((a, b) => {
    const [, nA, sA] = splitId(a.id)
    const [, nB, sB] = splitId(b.id)
    if (nA !== nB) return parseInt(nA) - parseInt(nB)
    return sA.localeCompare(sB)
  })

  const byNum = new Map()
  for (const row of rows) {
    const [, num, suffix] = splitId(row.id)
    if (!byNum.has(num)) byNum.set(num, [])
    byNum.get(num).push({ ...row, suffix })
  }

  const nums  = [...byNum.keys()].sort((a, b) => parseInt(a) - parseInt(b))
  const turns = []
  const skip  = new Set()

  for (let ni = 0; ni < nums.length; ni++) {
    const num   = nums[ni]
    if (skip.has(num)) continue
    const group = byNum.get(num) ?? []
    if (!group.length) continue

    // Question
    const qRow = group.find(r => r.speaker === 'question' || r.suffix === 'q')
    if (qRow) {
      const nextNum = nums[ni + 1]
      const optRows = nextNum ? (byNum.get(nextNum) ?? []).filter(r => r.speaker === 'option') : []
      const correct = optRows.find(r => r.cmd === 'correct')
      turns.push({
        type:        'question',
        prompt:      qRow.text,
        translation: qRow.en,
        options:     optRows.map(r => ({
          text:        r.text,
          translation: r.en,
          correct:     r.cmd === 'correct',
          feedback:    r.cmd === 'correct' ? `✓ ${r.text}` : `✗ ${correct?.text ?? ''}`,
        }))
      })
      if (nextNum) skip.add(nextNum)
      continue
    }

    // Already-consumed options
    if (group.every(r => r.speaker === 'option')) continue

    // Player choice
    const playerRows = group.filter(r => r.speaker === 'player' && r.suffix)
    if (playerRows.length > 1) {
      const nextNum  = nums[ni + 1]
      const respRows = nextNum ? (byNum.get(nextNum) ?? []) : []
      turns.push({
        type:              'choice',
        prompt:            '…',
        promptTranslation: '…',
        options:           playerRows.map(r => {
          const resp = respRows.find(rr => rr.suffix === r.suffix)
          return { text: r.text, translation: r.en, response: resp?.text ?? '', responseTranslation: resp?.en ?? '' }
        })
      })
      if (nextNum && respRows.some(r => playerRows.some(p => p.suffix === r.suffix))) skip.add(nextNum)
      continue
    }

    // Single line
    const row = group[0]
    if (row) turns.push({ type: 'line', speaker: formatSpeaker(row.speaker), text: row.text, translation: row.en })
  }

  if (!turns.length) return null

  const dlNum = prefix.replace(/\D/g, '').slice(-2)
  return {
    id:               prefix,
    title:            `Dialogue ${parseInt(dlNum) || 1}`,
    titleTranslation: '',
    type:             turns.some(t => t.type === 'choice') ? 'choice' : 'observe',
    speakers:         [...new Set(turns.filter(t => t.type === 'line').map(t => t.speaker))],
    turns,
  }
}

function formatSpeaker(s) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
