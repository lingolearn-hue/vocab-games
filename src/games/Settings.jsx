import { useApp } from '../context/AppContext'
import { getAllScores } from '../engine/srs'
import './Settings.css'

const ANSWER_FIELD_OPTIONS = [
  { value: 'entry',       label: 'Entry (foreign word)' },
  { value: 'translation', label: 'Translation' },
  { value: 'reading',     label: 'Reading (pinyin/kana)' },
]

const GAMES_WITH_FIELDS = [
  { id: 'flashcard', label: '🃏 Flashcard' },
  { id: 'pairmatch', label: '🔗 Pair Match' },
  { id: 'racecar',   label: '🏎 Race Car' },
  { id: 'gapfill',   label: '✏️ Gap Fill' },
  { id: 'typing',    label: '⌨️ Typing' },
]

function FieldRow({ label, fields, onChange }) {
  return (
    <div className="st-field-row">
      <span className="st-field-label">{label}</span>
      <div className="st-field-selects">
        <div className="st-field-group">
          <label className="st-field-sublabel">Prompt</label>
          <select
            className="st-select"
            value={fields?.prompt ?? '__global__'}
            onChange={e => onChange('prompt', e.target.value === '__global__' ? null : e.target.value)}
          >
            {fields === null && <option value="__global__">↑ Use global</option>}
            {ANSWER_FIELD_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="st-field-group">
          <label className="st-field-sublabel">Answer</label>
          <select
            className="st-select"
            value={fields?.answer ?? '__global__'}
            onChange={e => onChange('answer', e.target.value === '__global__' ? null : e.target.value)}
          >
            {fields === null && <option value="__global__">↑ Use global</option>}
            {ANSWER_FIELD_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}

export default function Settings() {
  const { setScreen, settings, updateSettings } = useApp()

  function set(path, value) {
    updateSettings(s => {
      const parts = path.split('.')
      if (parts.length === 1) return { ...s, [path]: value }
      if (parts.length === 2) return { ...s, [parts[0]]: { ...s[parts[0]], [parts[1]]: value } }
      if (parts.length === 3) return {
        ...s,
        [parts[0]]: {
          ...s[parts[0]],
          [parts[1]]: { ...s[parts[0]][parts[1]], [parts[2]]: value }
        }
      }
      return s
    })
  }

  function setGlobalAnswerField(field, value) {
    updateSettings(s => ({
      ...s,
      answerFields: {
        ...s.answerFields,
        global: { ...s.answerFields.global, [field]: value }
      }
    }))
  }

  function setGameAnswerField(game, field, value) {
    updateSettings(s => {
      const current = s.answerFields[game] ?? { ...s.answerFields.global }
      if (value === null) {
        // Reset to global
        return { ...s, answerFields: { ...s.answerFields, [game]: null } }
      }
      return {
        ...s,
        answerFields: {
          ...s.answerFields,
          [game]: { ...current, [field]: value }
        }
      }
    })
  }

  function applyGlobalFieldsToAll() {
    updateSettings(s => ({
      ...s,
      answerFields: {
        ...s.answerFields,
        flashcard: null,
        pairmatch: null,
        racecar:   null,
        gapfill:   null,
        typing:    null,
      }
    }))
  }

  function resetAllScores() {
    if (!confirm('Reset ALL scores? This cannot be undone.')) return
    localStorage.removeItem('vocabScores')
    window.location.reload()
  }

  const { settings: s } = { settings }
  const cfg = settings

  return (
    <div className="st-screen">
      <div className="st-header">
        <button className="st-back" onClick={() => setScreen('setup')}>← Back</button>
        <span className="st-title">Settings</span>
      </div>

      <div className="st-body">

        {/* ── Appearance ── */}
        <section className="st-section">
          <h2>Appearance</h2>

          <div className="st-row">
            <span className="st-label">Dark mode</span>
            <div className="st-seg">
              {['auto', 'light', 'dark'].map(v => (
                <button
                  key={v}
                  className={`st-seg-btn ${cfg.darkMode === v ? 'active' : ''}`}
                  onClick={() => set('darkMode', v)}
                >
                  {v === 'auto' ? 'Auto' : v === 'light' ? '☀️ Light' : '🌙 Dark'}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Defaults ── */}
        <section className="st-section">
          <h2>Defaults</h2>

          <div className="st-row">
            <span className="st-label">Direction</span>
            <div className="st-seg">
              <button
                className={`st-seg-btn ${cfg.direction === 'entry->translation' ? 'active' : ''}`}
                onClick={() => set('direction', 'entry->translation')}
              >Foreign → Trans</button>
              <button
                className={`st-seg-btn ${cfg.direction === 'translation->entry' ? 'active' : ''}`}
                onClick={() => set('direction', 'translation->entry')}
              >Trans → Foreign</button>
            </div>
          </div>

          <div className="st-row">
            <span className="st-label">Show reading by default</span>
            <button
              className={`st-toggle ${cfg.showReading ? 'active' : ''}`}
              onClick={() => set('showReading', !cfg.showReading)}
            >
              {cfg.showReading ? 'On' : 'Off'}
            </button>
          </div>
        </section>

        {/* ── Answer fields ── */}
        <section className="st-section">
          <h2>Answer fields</h2>
          <p className="st-hint">Set globally or override per game.</p>

          <div className="st-subsection">
            <div className="st-subsection-header">
              <span className="st-sublabel">Global (default for all games)</span>
              <button className="st-apply-all" onClick={applyGlobalFieldsToAll}>
                Apply to all games
              </button>
            </div>
            <FieldRow
              label="Global"
              fields={cfg.answerFields.global}
              onChange={(field, value) => setGlobalAnswerField(field, value)}
            />
          </div>

          {GAMES_WITH_FIELDS.map(g => {
            const gameFields = cfg.answerFields[g.id]
            return (
              <div key={g.id} className="st-subsection">
                <div className="st-subsection-header">
                  <span className="st-sublabel">{g.label}</span>
                  {gameFields !== null && (
                    <button
                      className="st-reset-game"
                      onClick={() => setGameAnswerField(g.id, null, null)}
                    >
                      Reset to global
                    </button>
                  )}
                </div>
                {gameFields === null ? (
                  <div className="st-using-global">
                    Using global · {cfg.answerFields.global.prompt} → {cfg.answerFields.global.answer}
                    <button
                      className="st-override-btn"
                      onClick={() => updateSettings(s => ({
                        ...s,
                        answerFields: { ...s.answerFields, [g.id]: { ...s.answerFields.global } }
                      }))}
                    >
                      Override
                    </button>
                  </div>
                ) : (
                  <FieldRow
                    label={g.label}
                    fields={gameFields}
                    onChange={(field, value) => setGameAnswerField(g.id, field, value)}
                  />
                )}
              </div>
            )
          })}
        </section>

        {/* ── Race Car ── */}
        <section className="st-section">
          <h2>🏎 Race Car</h2>

          <div className="st-row">
            <span className="st-label">Default speed</span>
            <div className="st-slider-wrap">
              <input
                type="range" min="50" max="200" step="5"
                value={Math.round(cfg.racecar.defaultSpeed * 100)}
                onChange={e => set('racecar.defaultSpeed', e.target.value / 100)}
                className="st-slider"
              />
              <span className="st-slider-val">×{cfg.racecar.defaultSpeed.toFixed(2)}</span>
            </div>
          </div>

          <div className="st-row">
            <span className="st-label">Boost zone enabled</span>
            <button
              className={`st-toggle ${cfg.racecar.boostEnabled ? 'active' : ''}`}
              onClick={() => set('racecar.boostEnabled', !cfg.racecar.boostEnabled)}
            >
              {cfg.racecar.boostEnabled ? 'On' : 'Off'}
            </button>
          </div>
        </section>

        {/* ── Flashcard ── */}
        <section className="st-section">
          <h2>🃏 Flashcard</h2>

          <div className="st-row">
            <span className="st-label">Swipe sensitivity</span>
            <div className="st-slider-wrap">
              <input
                type="range" min="50" max="200" step="5"
                value={Math.round(cfg.flashcard.swipeSensitivity * 100)}
                onChange={e => set('flashcard.swipeSensitivity', e.target.value / 100)}
                className="st-slider"
              />
              <span className="st-slider-val">×{cfg.flashcard.swipeSensitivity.toFixed(2)}</span>
            </div>
          </div>
        </section>

        {/* ── Gap Fill ── */}
        <section className="st-section">
          <h2>✏️ Gap Fill</h2>

          <div className="st-row">
            <span className="st-label">Fixed sentence ratio</span>
            <div className="st-slider-wrap">
              <input
                type="range" min="0" max="100" step="10"
                value={Math.round(cfg.gapfill.fixedRatio * 100)}
                onChange={e => set('gapfill.fixedRatio', e.target.value / 100)}
                className="st-slider"
              />
              <span className="st-slider-val">{Math.round(cfg.gapfill.fixedRatio * 100)}%</span>
            </div>
          </div>
        </section>

        {/* ── Pair Match ── */}
        <section className="st-section">
          <h2>🔗 Pair Match</h2>

          <div className="st-row">
            <span className="st-label">Round size</span>
            <div className="st-seg">
              {[3, 4, 5, 6, 8].map(v => (
                <button
                  key={v}
                  className={`st-seg-btn ${cfg.pairmatch.roundSize === v ? 'active' : ''}`}
                  onClick={() => set('pairmatch.roundSize', v)}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Typing ── */}
        <section className="st-section">
          <h2>⌨️ Typing</h2>

          <div className="st-row">
            <span className="st-label">Require correct answer</span>
            <button
              className={`st-toggle ${cfg.typing.requireCorrect ? 'active' : ''}`}
              onClick={() => set('typing.requireCorrect', !cfg.typing.requireCorrect)}
            >
              {cfg.typing.requireCorrect ? 'On' : 'Off'}
            </button>
          </div>

          <div className="st-row">
            <span className="st-label">Skip button enabled</span>
            <button
              className={`st-toggle ${cfg.typing.skipEnabled ? 'active' : ''}`}
              onClick={() => set('typing.skipEnabled', !cfg.typing.skipEnabled)}
            >
              {cfg.typing.skipEnabled ? 'On' : 'Off'}
            </button>
          </div>
        </section>

        {/* ── Danger zone ── */}
        <section className="st-section st-danger-section">
          <h2>Data</h2>
          <button className="st-danger-btn" onClick={resetAllScores}>
            Reset all scores
          </button>
        </section>

      </div>
    </div>
  )
}
