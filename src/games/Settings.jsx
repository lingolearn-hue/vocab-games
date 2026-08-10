import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import { leitnerStorageKeys } from '../engine/leitner'
import { getVoicesForLanguage, isSupported as speechSupported } from '../engine/speech'
import HelpButton from '../components/HelpButton'
import './Settings.css'

const VOICE_LANGUAGES = [
  { id: 'zh', label: 'Chinese 🇨🇳' },
  { id: 'ja', label: 'Japanese 🇯🇵' },
  { id: 'de', label: 'German 🇩🇪' },
  { id: 'es', label: 'Spanish 🇪🇸' },
  { id: 'fr', label: 'French 🇫🇷' },
  { id: 'en', label: 'English 🇬🇧' },
]

export default function Settings() {
  const { setScreen, goBack, settings, updateSettings } = useApp()
  const [voicesLoaded, setVoicesLoaded] = useState(false)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') setScreen('setup') }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Voices load asynchronously in most browsers — getVoices() can return an
  // empty list on first render until 'voiceschanged' fires.
  useEffect(() => {
    if (!speechSupported()) return
    const check = () => setVoicesLoaded(window.speechSynthesis.getVoices().length > 0)
    check()
    window.speechSynthesis.addEventListener('voiceschanged', check)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', check)
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

  const BACKUP_KEYS = ['vocabScores', 'vocabSettings', 'vocabMnemonics', 'vocabMnemonicsSeeded', 'grammarScores', 'activeLanguage', 'rc-high', 'adventureProgress', 'vocabCustomPassage', ...leitnerStorageKeys()]

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
        <HelpButton
          title="Settings"
          description="Light/dark appearance, a per-language voice override for text-to-speech (useful when the browser default doesn't match your device's preferred voice), and data export/import/reset."
        />
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

        {/* ── Voice ── */}
        {speechSupported() && (
          <>
            <div className="st-section-label">Voice</div>
            <div className="st-row--padded">
              {!voicesLoaded && (
                <p className="st-hint">Loading available voices…</p>
              )}
              {voicesLoaded && VOICE_LANGUAGES.map(({ id, label }) => {
                const voices = getVoicesForLanguage(id)
                if (voices.length === 0) return null
                return (
                  <div key={id} className="st-voice-row">
                    <span className="st-voice-label">{label}</span>
                    <select
                      className="st-voice-select"
                      value={cfg.voices?.[id] ?? ''}
                      onChange={e => set(`voices.${id}`, e.target.value || null)}
                    >
                      <option value="">Default</option>
                      {voices.map(v => (
                        <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                )
              })}
              <p className="st-hint">
                Pick a specific voice per language — e.g. to match your device's
                configured system voice. "Default" leaves it up to the browser.
              </p>
            </div>
          </>
        )}

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
