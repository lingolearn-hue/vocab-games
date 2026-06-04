import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import './Settings.css'

const PROMPT_OPTIONS = [
  { value: 'entry',       label: 'Foreign word' },
  { value: 'translation', label: 'Translation' },
  { value: 'reading',     label: 'Reading' },
]

function Accordion({ title, icon, children, open, onToggle }) {
  return (
    <div className={`st-accordion ${open ? 'open' : ''}`}>
      <button className="st-accordion-header" onClick={onToggle}>
        <span className="st-accordion-icon">{icon}</span>
        <span className="st-accordion-title">{title}</span>
        <span className="st-accordion-arrow">{open ? '▾' : '›'}</span>
      </button>
      {open && <div className="st-accordion-body">{children}</div>}
    </div>
  )
}

function LevelChips({ levels, availableLevels, onChange }) {
  if (!availableLevels.length) return <p className="st-hint">No vocab loaded yet.</p>
  return (
    <div className="st-chips">
      {availableLevels.map(level => {
        const active = !levels || levels.includes(level)
        return (
          <button
            key={level}
            className={`st-chip ${active ? 'active' : ''}`}
            onClick={() => {
              if (!levels) {
                onChange(availableLevels.filter(l => l !== level))
              } else {
                const next = levels.includes(level)
                  ? levels.filter(l => l !== level)
                  : [...levels, level]
                onChange(next.length === 0 || next.length === availableLevels.length ? null : next)
              }
            }}
          >
            {level}
          </button>
        )
      })}
    </div>
  )
}

export default function Settings() {
  const { setScreen, settings, updateSettings, availableLevels, activeLanguage } = useApp()
  const [open, setOpen] = useState(null)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') setScreen('setup') }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function toggle(id) { setOpen(o => o === id ? null : id) }
  const cfg = settings

  function set(path, value) {
    updateSettings(s => {
      const parts = path.split('.')
      if (parts.length === 1) return { ...s, [path]: value }
      if (parts.length === 2) return { ...s, [parts[0]]: { ...s[parts[0]], [parts[1]]: value } }
      return s
    })
  }

  function setGlobalLevels(levels) {
    updateSettings(s => ({ ...s, levels: { ...s.levels, global: levels } }))
  }

  function setGlobalField(field, value) {
    updateSettings(s => ({
      ...s,
      answerFields: { ...s.answerFields, global: { ...s.answerFields.global, [field]: value } }
    }))
  }

  function resetPromptTarget() {
    updateSettings(s => ({
      ...s,
      answerFields: {
        global: { prompt: 'entry', answer: 'translation' },
        flashcard: null, pairmatch: null, racecar: null, gapfill: null, typing: null,
      }
    }))
  }

  const BACKUP_KEYS = ['vocabScores', 'vocabSettings', 'vocabMnemonics', 'vocabMnemonicsSeeded', 'grammarScores', 'activeLanguage', 'rc-high']

  function exportBackup() {
    const data = {}
    for (const key of BACKUP_KEYS) {
      const val = localStorage.getItem(key)
      if (val !== null) data[key] = val
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `vocab-games-backup-${new Date().toISOString().slice(0,10)}.json`
    a.click(); URL.revokeObjectURL(url)
  }

  function importBackup() {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.json'
    input.onchange = async e => {
      const file = e.target.files[0]; if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        if (!confirm(`Import backup from ${file.name}? This will overwrite current progress.`)) return
        for (const [key, val] of Object.entries(data)) {
          if (BACKUP_KEYS.includes(key)) localStorage.setItem(key, val)
        }
        window.location.reload()
      } catch { alert('Invalid backup file.') }
    }
    input.click()
  }

  function resetAllScores() {
    if (!confirm('Reset ALL scores? This cannot be undone.')) return
    localStorage.removeItem('vocabScores')
    window.location.reload()
  }

  const gp = cfg.answerFields.global.prompt
  const ga = cfg.answerFields.global.answer
  const promptLabel = PROMPT_OPTIONS.find(o => o.value === gp)?.label ?? gp
  const answerLabel = PROMPT_OPTIONS.find(o => o.value === ga)?.label ?? ga

  return (
    <div className="st-screen">
      <div className="st-header">
        <button className="st-back" onClick={goBack}>← Back</button>
        <span className="st-title">Settings</span>
      </div>

      <div className="st-body">

        {/* ── Appearance ── */}
        <div className="st-row st-row--padded">
          <span className="st-label">Appearance</span>
          <div className="st-seg">
            {['auto', 'light', 'dark'].map(v => (
              <button key={v} className={`st-seg-btn ${cfg.darkMode === v ? 'active' : ''}`}
                onClick={() => set('darkMode', v)}>
                {v === 'auto' ? 'Auto' : v === 'light' ? '☀️' : '🌙'}
              </button>
            ))}
          </div>
        </div>

        {/* ── Levels ── */}
        <div className="st-section-label">Levels</div>
        <div className="st-row st-row--padded">
          <LevelChips
            levels={cfg.levels.global}
            availableLevels={availableLevels}
            onChange={setGlobalLevels}
          />
        </div>

        {/* ── Vocabulary Games ── */}
        <Accordion title="Vocabulary Games" icon="🎯" open={open === 'vocab'} onToggle={() => toggle('vocab')}>

          {/* Show reading */}
          <div className="st-row">
            <span className="st-label">Show reading (pinyin/kana)</span>
            <button className={`st-toggle ${cfg.showReading ? 'active' : ''}`}
              onClick={() => set('showReading', !cfg.showReading)}>
              {cfg.showReading ? 'On' : 'Off'}
            </button>
          </div>

          {/* Prompt / Answer with inline reset */}
          <div className="st-row st-row--between">
            <span className="st-label">Prompt → Answer</span>
            <button className="st-ghost-btn" onClick={resetPromptTarget}>Reset</button>
          </div>
          <div className="st-prompt-row">
            <span className="st-sublabel">Prompt</span>
            <div className="st-seg">
              {PROMPT_OPTIONS.map(o => (
                <button key={o.value}
                  className={`st-seg-btn ${gp === o.value ? 'active' : ''}`}
                  onClick={() => setGlobalField('prompt', o.value)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div className="st-prompt-row">
            <span className="st-sublabel">Answer</span>
            <div className="st-seg">
              {PROMPT_OPTIONS.map(o => (
                <button key={o.value}
                  className={`st-seg-btn ${ga === o.value ? 'active' : ''}`}
                  onClick={() => setGlobalField('answer', o.value)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div className="st-current-label">{promptLabel} → {answerLabel}</div>
        </Accordion>

        {/* ── Typing ── */}
        <Accordion title="Typing" icon="⌨️" open={open === 'typing'} onToggle={() => toggle('typing')}>
          <div className="st-row">
            <span className="st-label">Require correct retype on wrong</span>
            <button className={`st-toggle ${cfg.typing.requireCorrect ? 'active' : ''}`}
              onClick={() => set('typing.requireCorrect', !cfg.typing.requireCorrect)}>
              {cfg.typing.requireCorrect ? 'On' : 'Off'}
            </button>
          </div>
          <div className="st-row">
            <span className="st-label">Skip button</span>
            <button className={`st-toggle ${cfg.typing.skipEnabled ? 'active' : ''}`}
              onClick={() => set('typing.skipEnabled', !cfg.typing.skipEnabled)}>
              {cfg.typing.skipEnabled ? 'On' : 'Off'}
            </button>
          </div>
        </Accordion>

        {/* ── Race Car ── */}
        <Accordion title="Race Car" icon="🏎" open={open === 'racecar'} onToggle={() => toggle('racecar')}>
          <div className="st-row">
            <span className="st-label">Base speed</span>
            <div className="st-slider-wrap">
              <input type="range" min="50" max="200" step="5"
                value={Math.round(cfg.racecar.defaultSpeed * 100)}
                onChange={e => set('racecar.defaultSpeed', e.target.value / 100)}
                className="st-slider" />
              <span className="st-slider-val">×{cfg.racecar.defaultSpeed.toFixed(1)}</span>
            </div>
          </div>
          <div className="st-row">
            <span className="st-label">Boost zone</span>
            <button className={`st-toggle ${cfg.racecar.boostEnabled ? 'active' : ''}`}
              onClick={() => set('racecar.boostEnabled', !cfg.racecar.boostEnabled)}>
              {cfg.racecar.boostEnabled ? 'On' : 'Off'}
            </button>
          </div>
        </Accordion>

        {/* ── Data ── */}
        <Accordion title="Data" icon="💾" open={open === 'data'} onToggle={() => toggle('data')}>
          <div className="st-data-btns">
            <button className="st-data-btn" onClick={exportBackup}>⬇ Export backup</button>
            <button className="st-data-btn" onClick={importBackup}>⬆ Import backup</button>
          </div>
          <button className="st-danger-btn" onClick={resetAllScores}>Reset all scores</button>
        </Accordion>

      </div>
    </div>
  )
}
