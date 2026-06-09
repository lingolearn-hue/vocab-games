import { useState, useEffect, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import AdventureChapter from './AdventureChapter'
import './Adventure.css'

async function loadCampaign() {
  try {
    const res = await fetch('./adventure/campaigns.json')
    if (res.ok) return res.json()
  } catch {}
  return null
}

async function loadChapterMeta(chapterNumber, language) {
  try {
    const chNum = String(chapterNumber).padStart(2, '0')
    const res = await fetch(`./adventure/campaign01${chNum}.tsv`)
    if (!res.ok) return null
    const text = await res.text()
    return parseChapterMeta(text, language)
  } catch { return null }
}

function parseChapterMeta(tsv, language) {
  // Extract only @chapter, @artifact, @story_intro, @story_outro from TSV
  const meta = {}
  const langOrder = ['en','zh','ja','de','es']
  for (const raw of tsv.split('\n')) {
    const cells = raw.trim().split('\t')
    const tag = cells[0]
    if (tag === '@chapter') {
      meta.number = cells[1]
      // cells 2-6: en, zh, ja, de, es
      const titles = {}
      langOrder.forEach((l,i) => { titles[l] = cells[2+i]?.trim() ?? '' })
      meta.titles = titles
      meta.title = titles[language] || titles.en
      meta.titleTranslation = titles.en
      meta.level = cells[7]?.trim() ?? ''
    }
    if (tag === '@artifact') {
      meta.grammarArtifact = { icon: cells[1]?.trim(), name: cells[2]?.trim(), grammar: cells[3]?.trim() }
    }
    if (tag === '@story_intro') {
      const t = {}; langOrder.forEach((l,i) => { t[l] = cells[1+i]?.trim() ?? '' })
      meta.storyIntro = t[language] || t.en
      meta.storyIntroTranslation = t.en
    }
    if (tag === '@story_outro') {
      const t = {}; langOrder.forEach((l,i) => { t[l] = cells[1+i]?.trim() ?? '' })
      meta.storyOutro = t[language] || t.en
      meta.storyOutroTranslation = t.en
    }
  }
  return meta
}

function getProgress() {
  try { return JSON.parse(localStorage.getItem('adventureProgress') || '{}') }
  catch { return {} }
}

function saveProgress(p) {
  localStorage.setItem('adventureProgress', JSON.stringify(p))
}

// Phase order within a chapter
const PHASES = ['vocab', 'grammar', 'dialogue', 'passage', 'complete']

function phaseLabel(phase) {
  return { vocab: 'Vocab', grammar: 'Grammar', dialogue: 'Dialogue', passage: 'Reading', complete: 'Done' }[phase] ?? phase
}

function ChapterCard({ chapter, status, phasesDone, isNext, onOpen, meta }) {
  const locked = status === 'locked'
  const done   = status === 'complete'
  const active = !locked && !done

  return (
    <button
      className={`adv-chapter-card ${done ? 'done' : ''} ${active ? 'active' : ''} ${locked ? 'locked' : ''} ${isNext ? 'next' : ''}`}
      onClick={() => !locked && onOpen(chapter)}
      disabled={locked}
    >
      <div className="adv-chapter-num">Ch.{chapter.number}</div>
      <div className="adv-chapter-info">
        <div className="adv-chapter-title">{meta?.title || `Chapter ${chapter.number}`}</div>
        <div className="adv-chapter-sub">{meta?.titles?.ja ?? ""}</div>
        <div className="adv-chapter-level">
          <span className="adv-level-badge">{meta?.level || chapter.level}</span>
          {meta?.grammarArtifact && (
            <span className="adv-artifact-badge">{meta.grammarArtifact.icon} {meta.grammarArtifact.name}</span>
          )}
        </div>
      </div>
      <div className="adv-chapter-status">
        {done && <span className="adv-done-icon">✓</span>}
        {locked && <span className="adv-lock-icon">🔒</span>}
        {active && !done && (
          <div className="adv-phase-dots">
            {PHASES.slice(0,-1).map(p => (
              <span key={p} className={`adv-phase-dot ${phasesDone.includes(p) ? 'done' : ''}`} title={phaseLabel(p)} />
            ))}
          </div>
        )}
      </div>
    </button>
  )
}

export default function Adventure() {
  const { activeLanguage, setScreen, goBack } = useApp()
  const [campaign,      setCampaign]      = useState(null)
  const [chapterMetas,  setChapterMetas]  = useState({})
  const [loading,       setLoading]       = useState(true)
  const [progress,      setProgress]      = useState(getProgress)
  const [openChapter,   setOpenChapter]   = useState(null)

  useEffect(() => {
    setLoading(true)
    loadCampaign().then(data => {
      setCampaign(data)
      setLoading(false)
    })
  }, [])

  // Load chapter metadata from TSV whenever language changes
  useEffect(() => {
    if (!campaign || !activeLanguage) return
    const metas = {}
    Promise.all(
      campaign.chapters.map(ch =>
        loadChapterMeta(ch.number, activeLanguage).then(meta => {
          if (meta) metas[ch.id] = meta
        })
      )
    ).then(() => setChapterMetas({ ...metas }))
  }, [campaign, activeLanguage])

  function getChapterStatus(chapter) {
    const cp = progress[chapter.id]
    if (!cp) {
      // Chapter 1 always unlocked; others locked until previous complete
      if (chapter.number === 1) return 'unlocked'
      const prevId = campaign.chapters[chapter.number - 2]?.id
      return progress[prevId]?.phase === 'complete' ? 'unlocked' : 'locked'
    }
    return cp.phase === 'complete' ? 'complete' : 'unlocked'
  }

  function getPhasesDone(chapterId) {
    const cp = progress[chapterId]
    if (!cp) return []
    const idx = PHASES.indexOf(cp.phase)
    return PHASES.slice(0, idx)
  }

  function handleChapterComplete(chapterId) {
    const next = { ...progress, [chapterId]: { phase: 'complete' } }
    setProgress(next)
    saveProgress(next)
    setOpenChapter(null)
  }

  function openChapterWithMeta(chapter) {
    const meta = chapterMetas[chapter.id] ?? {}
    setOpenChapter({ ...chapter, ...meta })
  }

  function handlePhaseAdvance(chapterId, phase) {
    const next = { ...progress, [chapterId]: { phase } }
    setProgress(next)
    saveProgress(next)
  }

  // Determine which chapter to highlight as "next"
  const nextChapterId = useMemo(() => {
    if (!campaign) return null
    for (const ch of campaign.chapters) {
      if (getChapterStatus(ch) !== 'complete') return ch.id
    }
    return null
  }, [campaign, progress])

  const completedCount = campaign ? campaign.chapters.filter(ch => progress[ch.id]?.phase === 'complete').length : 0
  const totalCount     = campaign?.chapters.length ?? 0

  if (openChapter) {
    return (
      <AdventureChapter
        chapter={openChapter}
        currentPhase={progress[openChapter.id]?.phase ?? 'vocab'}
        onPhaseAdvance={(phase) => handlePhaseAdvance(openChapter.id, phase)}
        onComplete={() => handleChapterComplete(openChapter.id)}
        onBack={() => setOpenChapter(null)}
      />
    )
  }

  return (
    <div className="adv-screen">
      {/* Header */}
      <div className="adv-header">
        <button className="adv-back" onClick={goBack}>← Back</button>
        <span className="adv-header-title">Adventure</span>
        <span className="adv-progress-label">
          {completedCount}/{totalCount}
        </span>
      </div>

      {loading ? (
        <div className="adv-empty">Loading campaign…</div>
      ) : !campaign ? (
        <div className="adv-empty">
          No adventure available for this language yet.
        </div>
      ) : (
        <>
          {/* Campaign intro */}
          <div className="adv-campaign-intro">
            <div className="adv-campaign-title">{campaign.title}</div>
            <div className="adv-campaign-sub">{campaign.description}</div>
            {completedCount > 0 && (
              <div className="adv-campaign-bar">
                <div className="adv-campaign-fill" style={{ width: `${(completedCount/totalCount)*100}%` }} />
              </div>
            )}
          </div>

          {/* Chapter map — bottom to top */}
          <div className="adv-map">
            {[...campaign.chapters].reverse().map(chapter => {
              const status = getChapterStatus(chapter)
              return (
                <ChapterCard
                  key={chapter.id}
                  chapter={chapter}
                  status={status}
                  phasesDone={getPhasesDone(chapter.id)}
                  isNext={chapter.id === nextChapterId}
                  onOpen={openChapterWithMeta}
                  meta={chapterMetas[chapter.id]}
                />
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
