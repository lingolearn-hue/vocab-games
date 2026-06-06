/**
 * TSV Dialogue Parser
 *
 * Parses dialogue TSV files into the internal dialogue format
 * used by the Dialogue and AdventureChapter components.
 *
 * TSV column order: id  speaker  cmd  en  zh  ja  de  es
 * (as declared by @columns header line)
 *
 * Returns an array of dialogue objects, one per contiguous id-prefix group
 * (e.g. adv010101-* = dialogue 1, adv010102-* = dialogue 2)
 */

const LANG_COL = { en: 0, zh: 1, ja: 2, de: 3, es: 4 }

/**
 * Parse a TSV file string into dialogue objects.
 * @param {string} tsv - raw TSV file contents
 * @param {string} language - active language code ('zh','ja','de','es','en')
 * @returns {object[]} array of dialogue objects
 */
export function parseTSV(tsv, language) {
  const lines = tsv.split('\n')
  let columns = null   // column name → index
  const rows  = []

  for (let raw of lines) {
    raw = raw.trim()
    if (!raw || raw.startsWith('#')) continue

    const cells = raw.split('\t')

    // @columns header
    if (cells[0] === '@columns') {
      columns = {}
      cells.slice(1).forEach((name, i) => { columns[name.trim()] = i })  // 0-indexed into data cells
      continue
    }

    if (!columns) continue

    const id      = cells[columns.id      ?? 0]?.trim()
    const speaker = cells[columns.speaker ?? 1]?.trim()
    const cmd     = cells[columns.cmd     ?? 2]?.trim() ?? ''

    if (!id || !speaker) continue

    // Language text: prefer active language, fall back to en
    const langIdx = columns[language]
    const enIdx   = columns.en ?? 3
    const text    = (langIdx !== undefined ? cells[langIdx]?.trim() : '') || cells[enIdx]?.trim() || ''
    const en      = cells[enIdx]?.trim() ?? ''

    rows.push({ id, speaker, cmd, text, en })
  }

  // Sort by id: numeric part then suffix a→z
  rows.sort((a, b) => {
    const [pfxA, numSufA] = splitId(a.id)
    const [pfxB, numSufB] = splitId(b.id)
    if (pfxA !== pfxB) return pfxA.localeCompare(pfxB)
    return numSufA.localeCompare(numSufB, undefined, { numeric: true })
  })

  // Group rows into dialogues by the dialogue-level prefix
  // adv010101-XX → dialogue prefix 'adv010101'
  // adv010102-XX → dialogue prefix 'adv010102'
  const dialogueMap = new Map()
  for (const row of rows) {
    const dlPrefix = getDialoguePrefix(row.id)
    if (!dialogueMap.has(dlPrefix)) dialogueMap.set(dlPrefix, [])
    dialogueMap.get(dlPrefix).push(row)
  }

  // Convert each group into a dialogue object
  const dialogues = []
  for (const [prefix, dlRows] of dialogueMap) {
    const dialogue = buildDialogue(prefix, dlRows, language)
    if (dialogue) dialogues.push(dialogue)
  }

  return dialogues
}

/**
 * Load and parse a TSV file from a URL.
 */
export async function loadTSVDialogue(path, language) {
  try {
    const res = await fetch(path)
    if (!res.ok) return null
    const text = await res.text()
    return parseTSV(text, language)
  } catch { return null }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Split 'adv010101-03a' into ['adv010101', '03a']
 */
function splitId(id) {
  const dash = id.lastIndexOf('-')
  if (dash < 0) return [id, '']
  return [id.slice(0, dash), id.slice(dash + 1)]
}

/**
 * Get the dialogue-level prefix from a line id.
 * adv010101-03a → 'adv010101'
 * adv010102-01  → 'adv010102'
 */
function getDialoguePrefix(id) {
  const dash = id.lastIndexOf('-')
  return dash < 0 ? id : id.slice(0, dash)
}

/**
 * Get the line number (numeric part) and branch suffix from a local id.
 * '03a' → { num: '03', suffix: 'a' }
 * '06q' → { num: '06', suffix: 'q' }  (q treated as non-branch label)
 * '03'  → { num: '03', suffix: '' }
 */
function parseLocal(local) {
  const m = local.match(/^(\d+)([a-z]*)$/)
  if (!m) return { num: local, suffix: '' }
  return { num: m[1], suffix: m[2] }
}

/**
 * Convert a flat array of TSV rows into a dialogue object.
 */
function buildDialogue(prefix, rows, language) {
  const turns = []

  // Group rows by line number
  const byNum = new Map()
  for (const row of rows) {
    const [, local] = splitId(row.id)
    const { num, suffix } = parseLocal(local)
    if (!byNum.has(num)) byNum.set(num, [])
    byNum.get(num).push({ ...row, suffix })
  }

  // Process each line number in order
  const nums = [...byNum.keys()].sort((a, b) => parseInt(a) - parseInt(b))

  for (const num of nums) {
    const group = byNum.get(num)

    // Question prompt (suffix 'q' or single row with speaker 'question')
    const qRow = group.find(r => r.suffix === 'q' || (r.speaker === 'question' && group.length === 1))
    if (qRow) {
      // Following line numbers are options
      const nextNum = nums[nums.indexOf(num) + 1]
      const optRows = nextNum ? byNum.get(nextNum)?.filter(r => r.speaker === 'option') : []
      if (optRows?.length) {
        turns.push({
          type: 'question',
          prompt: qRow.text,
          translation: qRow.en,
          options: optRows.map(r => ({
            text: r.text,
            translation: r.en,
            correct: r.cmd === 'correct',
            feedback: r.cmd === 'correct'
              ? `✓ ${r.text}`
              : `✗ ${optRows.find(o => o.cmd === 'correct')?.text ?? ''}`
          }))
        })
        // Skip the option rows — already consumed
        byNum.delete(nextNum)
        continue
      }
      continue
    }

    // Option rows (already consumed above if preceded by question, otherwise skip)
    if (group.every(r => r.speaker === 'option')) continue

    // Branching player lines (multiple rows same num, different suffixes)
    const playerRows = group.filter(r => r.speaker === 'player' && r.suffix)
    if (playerRows.length > 1) {
      // Player choice: find response rows that match suffixes
      turns.push({
        type: 'choice',
        prompt: '…',
        promptTranslation: '…',
        options: playerRows.map(r => {
          // Look ahead for NPC response with same suffix
          const respNum = nums[nums.indexOf(num) + 1]
          const respRows = respNum ? byNum.get(respNum) : null
          const resp = respRows?.find(rr => rr.suffix === r.suffix)
          return {
            text: r.text,
            translation: r.en,
            response: resp?.text ?? '',
            responseTranslation: resp?.en ?? ''
          }
        })
      })
      // Mark response rows as consumed
      const respNum = nums[nums.indexOf(num) + 1]
      if (respNum) {
        const respRows = byNum.get(respNum) ?? []
        const consumed = respRows.filter(r => playerRows.some(p => p.suffix === r.suffix))
        if (consumed.length === respRows.length) byNum.delete(respNum)
        else byNum.set(respNum, respRows.filter(r => !consumed.includes(r)))
      }
      continue
    }

    // Single unconditional line
    const row = group[0]
    if (!row) continue
    turns.push({
      type: 'line',
      speaker: formatSpeaker(row.speaker),
      text: row.text,
      translation: row.en
    })
  }

  if (!turns.length) return null

  // Infer title from prefix
  const num = prefix.replace(/\D/g, '').slice(-2)
  return {
    id: prefix,
    title: `Dialogue ${parseInt(num) || 1}`,
    titleTranslation: '',
    type: turns.some(t => t.type === 'choice') ? 'choice' : 'observe',
    speakers: [...new Set(turns.filter(t => t.type === 'line').map(t => t.speaker))],
    turns
  }
}

function formatSpeaker(s) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
