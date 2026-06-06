/**
 * TSV Dialogue Parser
 * Column order declared by @columns header: id  speaker  cmd  en  zh  ja  de  es
 */

export function parseTSV(tsv, language) {
  const lines = tsv.split('\n')
  let columns = null
  const rows  = []

  for (let raw of lines) {
    raw = raw.trim()
    if (!raw || raw.startsWith('#')) continue
    const cells = raw.split('\t')

    if (cells[0] === '@columns') {
      columns = {}
      cells.slice(1).forEach((name, i) => { columns[name.trim()] = i })
      continue
    }
    if (!columns) continue

    const id      = cells[columns.id      ?? 0]?.trim()
    const speaker = cells[columns.speaker ?? 1]?.trim()
    const cmd     = cells[columns.cmd     ?? 2]?.trim() ?? ''

    if (!id || !speaker) continue

    const langIdx = columns[language]
    const enIdx   = columns.en ?? 3
    const text    = (langIdx !== undefined && cells[langIdx]?.trim())
                    || cells[enIdx]?.trim() || ''
    const en      = cells[enIdx]?.trim() ?? ''

    rows.push({ id, speaker, cmd, text, en })
  }

  // Sort: by dialogue prefix, then line number, then suffix a→z
  rows.sort((a, b) => {
    const [pA, nA, sA] = splitId(a.id)
    const [pB, nB, sB] = splitId(b.id)
    if (pA !== pB) return pA.localeCompare(pB)
    if (nA !== nB) return parseInt(nA) - parseInt(nB)
    return sA.localeCompare(sB)
  })

  // Group by dialogue prefix (e.g. adv010201, adv010202)
  const dlMap = new Map()
  for (const row of rows) {
    const prefix = getDialoguePrefix(row.id)
    if (!dlMap.has(prefix)) dlMap.set(prefix, [])
    dlMap.get(prefix).push(row)
  }

  const dialogues = []
  for (const [prefix, dlRows] of dlMap) {
    const dl = buildDialogue(prefix, dlRows)
    if (dl) dialogues.push(dl)
  }
  return dialogues
}

export async function loadTSVDialogue(path, language) {
  try {
    const res = await fetch(path)
    if (!res.ok) return null
    const text = await res.text()
    return parseTSV(text, language)
  } catch { return null }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function splitId(id) {
  // 'adv010201-04a' → ['adv010201', '04', 'a']
  const dash = id.lastIndexOf('-')
  if (dash < 0) return [id, '0', '']
  const local = id.slice(dash + 1)
  const m = local.match(/^(\d+)([a-z]*)$/)
  return [id.slice(0, dash), m ? m[1] : local, m ? m[2] : '']
}

function getDialoguePrefix(id) {
  const dash = id.lastIndexOf('-')
  return dash < 0 ? id : id.slice(0, dash)
}

function buildDialogue(prefix, rows) {
  // Group by line number
  const byNum = new Map()
  for (const row of rows) {
    const [, num, suffix] = splitId(row.id)
    if (!byNum.has(num)) byNum.set(num, [])
    byNum.get(num).push({ ...row, suffix })
  }

  const nums    = [...byNum.keys()].sort((a, b) => parseInt(a) - parseInt(b))
  const turns   = []
  const skip    = new Set()  // line numbers already consumed

  for (let ni = 0; ni < nums.length; ni++) {
    const num   = nums[ni]
    if (skip.has(num)) continue
    const group = byNum.get(num) ?? []
    if (!group.length) continue

    // ── Question prompt ──────────────────────────────────────────────────────
    const qRow = group.find(r =>
      r.speaker === 'question' ||
      (r.suffix === 'q' && group.length === 1)
    )
    if (qRow) {
      // Options are the next line number
      const nextNum = nums[ni + 1]
      const optRows = nextNum
        ? (byNum.get(nextNum) ?? []).filter(r => r.speaker === 'option')
        : []
      const correctRow = optRows.find(r => r.cmd === 'correct')
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
            : `✗ ${correctRow?.text ?? ''}`
        }))
      })
      if (nextNum) skip.add(nextNum)
      continue
    }

    // ── Already-consumed option rows ─────────────────────────────────────────
    if (group.every(r => r.speaker === 'option')) continue

    // ── Player choice (multiple player rows with different suffixes) ──────────
    const playerRows = group.filter(r => r.speaker === 'player' && r.suffix)
    if (playerRows.length > 1) {
      // Response rows are next line number, matched by suffix
      const nextNum  = nums[ni + 1]
      const respRows = nextNum ? (byNum.get(nextNum) ?? []) : []
      turns.push({
        type: 'choice',
        prompt: '…',
        promptTranslation: '…',
        options: playerRows.map(r => {
          const resp = respRows.find(rr => rr.suffix === r.suffix)
          return {
            text:                r.text,
            translation:         r.en,
            response:            resp?.text ?? '',
            responseTranslation: resp?.en   ?? ''
          }
        })
      })
      if (nextNum && respRows.some(r => playerRows.some(p => p.suffix === r.suffix))) {
        skip.add(nextNum)
      }
      continue
    }

    // ── Single line ───────────────────────────────────────────────────────────
    const row = group[0]
    if (!row) continue
    turns.push({
      type:        'line',
      speaker:     formatSpeaker(row.speaker),
      text:        row.text,
      translation: row.en
    })
  }

  if (!turns.length) return null

  const dlNum = prefix.replace(/\D/g, '').slice(-2)
  return {
    id:               prefix,
    title:            `Dialogue ${parseInt(dlNum) || 1}`,
    titleTranslation: '',
    type:             turns.some(t => t.type === 'choice') ? 'choice' : 'observe',
    speakers:         [...new Set(turns.filter(t => t.type === 'line').map(t => t.speaker))],
    turns
  }
}

function formatSpeaker(s) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
