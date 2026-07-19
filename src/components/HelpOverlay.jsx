import './HelpOverlay.css'

/**
 * Shared box-system explanation, reused by every game wired into the
 * Leitner engine (Flashcard, PairMatch, StrokeOrder). Kept in one place so
 * it never drifts out of sync with the actual box mechanics in
 * engine/leitner.js.
 */
export const BOX_HELP_STEPS = [
  { box: '0', label: 'New / unseen',  color: '#999',    desc: "Words you haven't scored yet" },
  { box: '1', label: 'Box 1',         color: '#4f7ef8', desc: 'Just started or recently missed' },
  { box: '2', label: 'Box 2',         color: '#22a06b', desc: 'Getting familiar' },
  { box: '3', label: 'Box 3',         color: '#f0a500', desc: 'Nearly there' },
  { box: '4', label: 'Box 4',         color: '#e05cb0', desc: 'Almost mastered' },
  { box: '★', label: 'Mastered',      color: '#22a06b', desc: 'You know this word!' },
]

export function BoxHelpSection() {
  return (
    <div className="help-section">
      <div className="help-section-title">How the boxes work</div>
      <p className="help-boxes-intro">
        Marking a word <strong>Known</strong> moves it up one box; <strong>Unknown</strong> moves
        it down one box (never below 0). <strong>Master</strong> sends it straight to ★.
      </p>
      <div className="help-boxes">
        {BOX_HELP_STEPS.map((s, i) => (
          <div key={i} className="help-box-row">
            <div className="help-box-badge" style={{ borderColor: s.color, color: s.color }}>{s.box}</div>
            <div className="help-box-info">
              <span className="help-box-label" style={{ color: s.color }}>{s.label}</span>
              <span className="help-box-desc">{s.desc}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="help-boxes-footer">
        Each day, the highest box with cards in it opens automatically. Once it's
        empty, the next one down opens. You can also tap any box directly to
        practice it, any time.
      </p>
    </div>
  )
}

/**
 * One-page help overlay — the shared template every game screen uses via
 * HelpButton. Pass `title` + `description` for the game blurb, `buttons`
 * for the header-button legend, and `showBoxes` to include the shared
 * box-system explainer (only relevant for games wired into the Leitner
 * engine).
 */
export default function HelpOverlay({ title, description, buttons = [], showBoxes = false, onClose }) {
  return (
    <div className="help-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="help-panel">
        <div className="help-panel-header">
          <span className="help-panel-title">{title}</span>
          <button className="help-close" onClick={onClose}>✕</button>
        </div>

        <div className="help-panel-body">
          {description && <p className="help-description">{description}</p>}

          {buttons.length > 0 && (
            <div className="help-section">
              <div className="help-section-title">Buttons</div>
              <div className="help-buttons">
                {buttons.map((b, i) => (
                  <div key={i} className="help-button-row">
                    <span className="help-button-icon">{b.icon}</span>
                    <div className="help-button-info">
                      <span className="help-button-label">{b.label}</span>
                      <span className="help-button-desc">{b.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showBoxes && <BoxHelpSection />}
        </div>
      </div>
    </div>
  )
}
