/**
 * Campaign JSON loader
 * Loads pre-converted chapter JSON files from public/campaign/
 */

export async function loadCampaignIndex() {
  try {
    const res = await fetch('./campaign/campaigns.json')
    if (!res.ok) return null
    const data = await res.json()
    // Handle both array and legacy single-object format
    return Array.isArray(data) ? data : [data]
  } catch { return null }
}

export async function loadChapterJSON(chapterNumber, language, campaignKey = 'A', levelNumber = 1) {
  try {
    const chNum  = String(chapterNumber).padStart(2, '0')
    const lvNum  = String(levelNumber).padStart(2, '0')
    const res    = await fetch(`./campaign/campaign_${campaignKey}${lvNum}${chNum}.json`)
    if (!res.ok) return null
    const data   = await res.json()
    return resolveChapter(data, language)
  } catch { return null }
}

/**
 * Resolve a chapter's multilingual content to a single language.
 * Returns { meta, sections } where all text fields are strings in the target language.
 */
function resolveChapter(data, language) {
  const lang = language ?? 'en'

  function t(obj) {
    if (!obj || typeof obj === 'string') return obj ?? ''
    return obj[lang] || obj.en || ''
  }

  const meta = {
    ...data.meta,
    chapterTitle:            t(data.meta.chapterTitle),
    level:                   data.meta.level,
    storyIntro:              t(data.meta.storyIntro),
    storyOutro:              t(data.meta.storyOutro),
    storyIntroTranslation:   data.meta.storyIntro?.en ?? '',
    storyOutroTranslation:   data.meta.storyOutro?.en ?? '',
  }

  const sections = (data.sections ?? []).map(s => ({
    ...s,
    title: t(s.title),
    vocab: s.vocab ?? [],
    grammar: s.grammar ?? [],
    surfaceForms: s.surfaceForms ?? {},   // {lang: {surface: lemma}}
    dialogues: (s.dialogues ?? []).map(dl => resolveDialogue(dl, lang, t(s.title))),
    passages: (s.passages ?? []).map(p => resolvePassage(p, lang)),
  }))

  return { meta, sections }
}

function resolveDialogue(dl, lang, sectionTitle) {
  function t(obj) { return (obj && typeof obj === 'object') ? (obj[lang] || obj.en || '') : (obj ?? '') }

  return {
    ...dl,
    title: sectionTitle || `Dialogue ${dl.dialogueNum ?? 1}`,
    turns: (dl.turns ?? []).map(turn => {
      if (turn.type === 'line') return {
        type: 'line',
        speaker: formatSpeaker(turn.speaker),
        text: t(turn.text),
        translation: turn.text?.en ?? ''
      }
      if (turn.type === 'question') return {
        type: 'question',
        prompt: t(turn.prompt),
        translation: turn.prompt?.en ?? '',
        options: (turn.options ?? []).map(o => ({
          text: t(o.text),
          translation: o.text?.en ?? '',
          correct: o.correct,
        }))
      }
      if (turn.type === 'choice') return {
        type: 'choice',
        prompt: '…', promptTranslation: '…',
        options: (turn.options ?? []).map(o => ({
          text: t(o.text),
          translation: o.text?.en ?? '',
          response: t(o.response),
          responseTranslation: o.response?.en ?? '',
          suffix: o.suffix,
        }))
      }
      return turn
    })
  }
}

function resolvePassage(p, lang) {
  function t(obj) { return (obj && typeof obj === 'object') ? (obj[lang] || obj.en || '') : (obj ?? '') }
  return {
    ...p,
    title: t(p.title),
    titleTranslation: p.title?.en ?? '',
    text: (p.lines ?? []).map(l => t(l)).join('　'),
    translation: (p.lines ?? []).map(l => l.en ?? '').join(' '),
  }
}

function formatSpeaker(s) {
  if (!s) return ''
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
