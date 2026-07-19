import { useState, useEffect, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import AdventureChapter from './AdventureChapter'
import { loadCampaignIndex, loadChapterJSON } from '../engine/campaignLoader'
import './Adventure.css'

function getProgress() {
  try { return JSON.parse(localStorage.getItem('adventureProgress') || '{}') }
  catch { return {} }
}
function saveProgress(p) { localStorage.setItem('adventureProgress', JSON.stringify(p)) }

// Chapter ids ("ch01", "ch02"...) repeat across campaigns, so every progress/meta
// lookup must be namespaced by campaign key to avoid cross-campaign collisions.
function pkey(campaignKey, chapterId) { return `${campaignKey ?? 'A'}:${chapterId}` }

const PHASES = ['vocab', 'grammar', 'dialogue', 'passage', 'complete']

// ── Chapter row inside accordion ─────────────────────────────────────────────

function ChapterRow({ chapter, status, phasesDone, isNext, onOpen, meta }) {
  const locked = status === 'locked'
  const done   = status === 'complete'

  return (
    <button
      className={`adv-chapter-row ${done ? 'done' : ''} ${locked ? 'locked' : ''} ${isNext ? 'next' : ''}`}
      onClick={() => onOpen(chapter)}
    >
      <span className="adv-row-num">Ch.{chapter.number}</span>
      <div className="adv-row-info">
        <span className="adv-row-title">{meta?.title || `Chapter ${chapter.number}`}</span>
        {meta?.level && <span className="adv-row-level">{meta.level}</span>}
      </div>
      <div className="adv-row-status">
        {done   && <span className="adv-done-icon">✓</span>}
        {locked && <span className="adv-lock-icon">🔒</span>}
        {!done && !locked && (
          <div className="adv-phase-dots">
            {PHASES.slice(0,-1).map(p => (
              <span key={p} className={`adv-phase-dot ${phasesDone.includes(p) ? 'done' : ''}`} />
            ))}
          </div>
        )}
      </div>
    </button>
  )
}

// ── Campaign accordion card ───────────────────────────────────────────────────

function CampaignCard({ campaign, progress, chapterMetas, activeLanguage, onOpenChapter, nextChapterId, open, onToggle }) {
  const t = (obj) => (obj && typeof obj === 'object') ? (obj[activeLanguage] || obj.en || '') : (obj ?? '')
  const ckey = campaign.key ?? 'A'

  const completedCount = campaign.chapters.filter(ch => progress[pkey(ckey, ch.id)]?.phase === 'complete').length
  const total          = campaign.totalChapters ?? campaign.chapters.length
  const pct            = total > 0 ? Math.round(completedCount / total * 100) : 0

  function getStatus(ch) {
    const cp = progress[pkey(ckey, ch.id)]
    if (cp?.phase === 'complete') return 'complete'
    if (ch.number === 1) return 'unlocked'
    const prev = campaign.chapters[ch.number - 2]
    return progress[pkey(ckey, prev?.id)]?.phase === 'complete' ? 'unlocked' : 'locked'
  }

  function getPhasesDone(chId) {
    const cp = progress[pkey(ckey, chId)]
    if (!cp) return []
    const idx = PHASES.indexOf(cp.phase)
    return PHASES.slice(0, idx)
  }

  return (
    <div className={`adv-campaign-card ${open ? 'open' : ''} ${campaign.comingSoon ? 'coming-soon' : ''}`}>
      {/* Campaign header — tap to expand */}
      <button className="adv-campaign-header" onClick={() => !campaign.comingSoon && onToggle(campaign.id)}>
        <span className="adv-campaign-icon">{campaign.icon ?? '⚔️'}</span>
        <div className="adv-campaign-info">
          <span className="adv-campaign-name">{t(campaign.titles)}</span>
          <span className="adv-campaign-sub">{t(campaign.subtitles)}</span>
        </div>
        <div className="adv-campaign-right">
          {campaign.comingSoon ? (
            <span className="adv-coming-soon">Coming soon</span>
          ) : (
            <>
              {completedCount > 0 && <span className="adv-campaign-pct">{pct}%</span>}
              <span className="adv-campaign-arrow">{open ? '▾' : '›'}</span>
            </>
          )}
        </div>
      </button>

      {/* Progress bar */}
      {open && completedCount > 0 && (
        <div className="adv-progress-bar">
          <div className="adv-progress-fill" style={{ width: `${pct}%` }} />
        </div>
      )}

      {/* Chapter list */}
      {open && !campaign.comingSoon && (
        <div className="adv-chapter-list">
          {campaign.chapters.map(ch => (
            <ChapterRow
              key={ch.id}
              chapter={ch}
              status={getStatus(ch)}
              phasesDone={getPhasesDone(ch.id)}
              isNext={pkey(ckey, ch.id) === nextChapterId}
              onOpen={ch => onOpenChapter(ch, campaign.key)}
              meta={chapterMetas[pkey(ckey, ch.id)]}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Adventure screen ─────────────────────────────────────────────────────

export default function Adventure() {
  const { activeLanguage, goBack } = useApp()
  const [campaigns,     setCampaigns]     = useState(null)
  const [chapterMetas,  setChapterMetas]  = useState({})
  const [loading,       setLoading]       = useState(true)
  const [progress,      setProgress]      = useState(getProgress)
  const [openChapter,   setOpenChapter]   = useState(null)
  const [openCampaignId, setOpenCampaignId] = useState(null)  // all collapsed by default; single-open accordion

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch on mount
    setLoading(true)
    loadCampaignIndex().then(data => {
      setCampaigns(data)
      setLoading(false)
    })
  }, [])

  // Load chapter meta for all campaigns when language changes
  useEffect(() => {
    if (!campaigns || !activeLanguage) return
    const allChapters = campaigns.flatMap(c => c.chapters.map(ch => ({ ...ch, campaignKey: c.key ?? 'A' })))
    const metas = {}
    Promise.all(
      allChapters.map(ch =>
        loadChapterJSON(ch.number, activeLanguage, ch.campaignKey).then(data => {
          if (data?.meta) metas[pkey(ch.campaignKey, ch.id)] = { ...data.meta, title: data.meta.chapterTitle }
        })
      )
    ).then(() => setChapterMetas({ ...metas }))
  }, [campaigns, activeLanguage])

  function handleChapterComplete(progressKey) {
    const next = { ...progress, [progressKey]: { phase: 'complete' } }
    setProgress(next); saveProgress(next)
    setOpenChapter(null)
  }

  function handlePhaseAdvance(progressKey, phase) {
    const next = { ...progress, [progressKey]: { phase } }
    setProgress(next); saveProgress(next)
  }

  function openChapterWithMeta(chapter, campaignKey) {
    const key  = campaignKey ?? 'A'
    const meta = chapterMetas[pkey(key, chapter.id)] ?? {}
    setOpenChapter({ ...chapter, ...meta, campaignKey: key })
  }

  // Next chapter to highlight across all campaigns (namespaced progress key)
  const nextChapterId = useMemo(() => {
    if (!campaigns) return null
    for (const campaign of campaigns) {
      for (const ch of campaign.chapters) {
        const key = pkey(campaign.key ?? 'A', ch.id)
        const cp = progress[key]
        if (!cp || cp.phase !== 'complete') return key
      }
    }
    return null
  }, [campaigns, progress])

  if (openChapter) {
    const progressKey = pkey(openChapter.campaignKey, openChapter.id)
    return (
      <AdventureChapter
        chapter={openChapter}
        currentPhase={progress[progressKey]?.phase ?? 'vocab'}
        onPhaseAdvance={phase => handlePhaseAdvance(progressKey, phase)}
        onComplete={() => handleChapterComplete(progressKey)}
        onBack={() => setOpenChapter(null)}
      />
    )
  }

  return (
    <div className="adv-screen">
      <div className="adv-header">
        <button className="adv-back" onClick={goBack}>← Back</button>
        <span className="adv-header-title">Adventure</span>
      </div>

      <div className="adv-scroll">
        {loading ? (
          <div className="adv-empty">Loading…</div>
        ) : !campaigns?.length ? (
          <div className="adv-empty">No adventures available yet.</div>
        ) : (
          campaigns.map(campaign => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              progress={progress}
              chapterMetas={chapterMetas}
              activeLanguage={activeLanguage}
              onOpenChapter={openChapterWithMeta}
              nextChapterId={nextChapterId}
              open={openCampaignId === campaign.id}
              onToggle={id => setOpenCampaignId(prev => prev === id ? null : id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
