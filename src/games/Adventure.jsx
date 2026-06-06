import { useState, useEffect, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import AdventureChapter from './AdventureChapter'
import './Adventure.css'

async function loadCampaign(language) {
  try {
    const res = await fetch(`./adventure/${language}-campaign.json`)
    if (!res.ok) return null
    return res.json()
  } catch { return null }
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

function ChapterCard({ chapter, status, phasesDone, isNext, onOpen }) {
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
        <div className="adv-chapter-title">{chapter.title}</div>
        <div className="adv-chapter-sub">{chapter.titleTranslation}</div>
        <div className="adv-chapter-level">
          <span className="adv-level-badge">{chapter.level}</span>
          {chapter.grammarArtifact && (
            <span className="adv-artifact-badge">{chapter.grammarArtifact.icon} {chapter.grammarArtifact.name}</span>
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
  const [campaign,   setCampaign]   = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [progress,   setProgress]   = useState(getProgress)
  const [openChapter, setOpenChapter] = useState(null)

  useEffect(() => {
    if (!activeLanguage) return
    setLoading(true)
    loadCampaign(activeLanguage).then(data => {
      setCampaign(data)
      setLoading(false)
    })
  }, [activeLanguage])

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
          {activeLanguage !== 'ja' && ' Switch to Japanese 🇯🇵 to play.'}
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
                  onOpen={setOpenChapter}
                />
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
