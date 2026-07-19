import { useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { leitnerStorageKeys } from '../engine/leitner'
import './Settings.css'

export default function Settings() {
  const { setScreen, goBack, settings, updateSettings } = useApp()

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') setScreen('setup') }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const cfg = settings

  function set(path, value) {
    updateSettings(s => {
      const parts = path.split('.')
      if (parts.length === 1) return { ...s, [path]: value }
      if (parts.length === 2) return { ...s, [parts[0]]: { ...s[parts[0]], [parts[1]]: value } }
      return s
    })
  }

  const BACKUP_KEYS = ['vocabScores', 'vocabSettings', 'vocabMnemonics', 'vocabMnemonicsSeeded', 'grammarScores', 'activeLanguage', 'rc-high', 'adventureProgress', ...leitnerStorageKeys()]

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
    localStorage.removeItem('grammarScores')
    localStorage.removeItem('rc-high')
    localStorage.removeItem('adventureProgress')
    for (const key of leitnerStorageKeys()) localStorage.removeItem(key)
    window.location.reload()
  }

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

        {/* ── Content ── */}
        <div className="st-section-label">Content</div>
        <div className="st-row st-row--padded">
          <span className="st-label">Mature vocabulary</span>
          <div className="st-seg">
            {[false, true].map(v => (
              <button key={String(v)} className={`st-seg-btn ${(cfg.showVulgar ?? false) === v ? 'active' : ''}`}
                onClick={() => set('showVulgar', v)}>
                {v ? 'Show' : 'Hide'}
              </button>
            ))}
          </div>
        </div>
        <p className="st-help-text">
          Some words are tagged as profanity or explicit biological terms.
          Hidden by default — turn on to include them in vocabulary lists and games.
        </p>

        {/* ── Data ── */}
        <div className="st-section-label">Data</div>
        <div className="st-row--padded">
          <div className="st-data-btns">
            <button className="st-data-btn" onClick={exportBackup}>⬇ Export backup</button>
            <button className="st-data-btn" onClick={importBackup}>⬆ Import backup</button>
          </div>
          <button className="st-danger-btn" onClick={resetAllScores}>Reset all scores</button>
        </div>

      </div>
    </div>
  )
}
