import { useState, useEffect, useMemo, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { buildLookup, tokenise, loadReaderPassages } from '../engine/reader'
import { TextWithLookup } from '../components/TextWithLookup'
import './GradedReader.css'

export default function GradedReader() {
  const { activeEntries, loadedLists, selectedIds, showReading, scores, setScreen, activeLanguage } = useApp()

  const [passages,        setPassages]        = useState([])
  const [activePassage,   setActivePassage]   = useState(null)
  const [pastedText,      setPastedText]      = useState('')
  const [pastedTitle,     setPastedTitle]     = useState('')
  const [mode,            setMode]            = useState('library')
  const [customPassage,   setCustomPassage]   = useState(null)
  const [showTranslation, setShowTranslation] = useState(false)
  const textAreaRef = useRef(null)

  const language = useMemo(() => {
    if (activeLanguage) return activeLanguage
    const firstList = selectedIds.map(id => loadedLists[id]).find(Boolean)
    return firstList?.language ?? 'zh'
  }, [activeLanguage, selectedIds, loadedLists])

  const lookup = useMemo(() => buildLookup(activeEntries), [activeEntries])

  useEffect(() => {
    if (!activeLanguage) return
    loadReaderPassages(`${activeLanguage}-en`).then(data => {
      setPassages(data?.passages ?? [])
    })
  }, [activeLanguage])

  function openPassage(p) {
    setActivePassage(p)
    setCustomPassage(null)
    setShowTranslation(false)
  }

  function openCustom() {
    if (!pastedText.trim()) return
    setCustomPassage({ id: 'custom', title: pastedTitle || 'Custom text', text: pastedText, translation: null })
    setActivePassage(null)
    setShowTranslation(false)
  }

  const currentPassage = activePassage ?? customPassage

  // ── List view ──────────────────────────────────────────────────────────────
  if (!currentPassage) {
    return (
      <div className="gr-screen">
        <div className="gr-header">
          <button className="gr-back" onClick={() => setScreen('setup')}>← Back</button>
          <span className="gr-title">Reader</span>
          <div className="gr-header-tabs">
            <button className={`gr-tab ${mode === 'library' ? 'active' : ''}`} onClick={() => setMode('library')}>Library</button>
            <button className={`gr-tab ${mode === 'paste'   ? 'active' : ''}`} onClick={() => setMode('paste')}>Paste</button>
          </div>
        </div>

        {mode === 'library' ? (
          <div className="gr-body">
            {passages.length === 0 ? (
              <div className="gr-empty">
                {activeLanguage ? 'No passages available for this language yet.' : 'Select a language on the home screen first.'}
              </div>
            ) : (
              <div className="gr-passage-list">
                {passages.map(p => {
                  const passageSpans = tokenise(p.text, lookup, language)
                  const matchedIds = [...new Set(passageSpans.filter(s => s.entry).map(s => s.entry.id))]
                  const knownCount = matchedIds.filter(id => (scores[id]?.global ?? 'unseen') !== 'unseen').length
                  return (
                    <button key={p.id} className="gr-passage-card" onClick={() => openPassage(p)}>
                      <div className="gr-passage-card-top">
                        <span className="gr-passage-title">{p.title}</span>
                        {p.level && <span className="gr-passage-level">{p.level}</span>}
                      </div>
                      {p.titleTranslation && <span className="gr-passage-subtitle">{p.titleTranslation}</span>}
                      <div className="gr-passage-stats">{matchedIds.length} vocab words · {knownCount} known</div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="gr-body">
            <div className="gr-paste-area">
              <input className="gr-paste-title" placeholder="Title (optional)" value={pastedTitle} onChange={e => setPastedTitle(e.target.value)} />
              <textarea ref={textAreaRef} className="gr-paste-input" placeholder="Paste or type your text here…" value={pastedText} onChange={e => setPastedText(e.target.value)} rows={10} />
              <button className="gr-paste-btn" disabled={!pastedText.trim()} onClick={openCustom}>Read →</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Reading view ───────────────────────────────────────────────────────────
  return (
    <div className="gr-screen">
      <div className="gr-header">
        <button className="gr-back" onClick={() => { setActivePassage(null); setCustomPassage(null) }}>← Back</button>
        <span className="gr-title gr-reading-title">{currentPassage.title}</span>
        {currentPassage.translation && (
          <button className={`gr-trans-toggle ${showTranslation ? 'active' : ''}`} onClick={() => setShowTranslation(t => !t)}>EN</button>
        )}
      </div>

      <div className="gr-body gr-reading-body">
        <div className="gr-text">
          <TextWithLookup text={currentPassage.text} language={language} lookup={lookup} scores={scores} showReading={showReading} />
        </div>

        {showTranslation && currentPassage.translation && (
          <div className="gr-translation"><p>{currentPassage.translation}</p></div>
        )}

        <div className="gr-legend">
          <span className="gr-legend-item gr-legend--mastered">mastered</span>
          <span className="gr-legend-item gr-legend--learning">learning</span>
          <span className="gr-legend-item gr-legend--unseen">unseen</span>
          <span className="gr-legend-item gr-legend--unknown">not in list</span>
        </div>
      </div>
    </div>
  )
}
