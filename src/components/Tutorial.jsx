import { useState } from 'react'
import { BOX_HELP_STEPS } from './HelpOverlay'
import './Tutorial.css'

/**
 * Two-page onboarding tutorial. Shown automatically on first launch
 * (see App.jsx's TutorialGate) and reopenable any time via the front
 * page's "?" button (see Setup.jsx) — in the reopened case there's no
 * `onDone` side effect beyond closing, so it's safe to show repeatedly.
 */
export default function Tutorial({ onDone }) {
  const [page, setPage] = useState(0)  // 0 = warning, 1 = box system

  return (
    <div className="tut-screen">
      <div className="tut-panel">
        <button className="tut-close" onClick={onDone}>✕</button>

        {page === 0 && (
          <>
            <div className="tut-top">
              <div className="tut-icon">🚧</div>
              <h1 className="tut-title">Welcome to Vocab Games</h1>
              <p className="tut-warning-badge">Early Development Preview</p>
              <p className="tut-warning-text">
                This app is actively being built and improved.
                Features change often — and unfortunately, updates may
                reset your learning progress and saved data.
              </p>
              <p className="tut-warning-text">
                We're sorry for the inconvenience. Thank you for testing!
              </p>
            </div>

            <div className="tut-bottom">
              <button className="tut-next-btn" onClick={() => setPage(1)}>
                Got it — what's the box system? →
              </button>
            </div>
          </>
        )}

        {page === 1 && (
          <>
            <div className="tut-top">
              <h2 className="tut-title tut-title--sm">How learning works</h2>
              <p className="tut-subtitle">
                Words move through boxes based on how well you know them.
                Get it right → move up a box. Get it wrong → move down a box.
              </p>

              <div className="tut-boxes">
                {BOX_HELP_STEPS.map((s, i) => (
                  <div key={i} className="tut-box-row">
                    <div className="tut-box-badge" style={{ borderColor: s.color, color: s.color }}>
                      {s.box}
                    </div>
                    <div className="tut-box-info">
                      <span className="tut-box-label" style={{ color: s.color }}>{s.label}</span>
                      <span className="tut-box-desc">{s.desc}</span>
                    </div>
                    {i < BOX_HELP_STEPS.length - 1 && (
                      <div className="tut-box-arrow">↓</div>
                    )}
                  </div>
                ))}
              </div>

              <p className="tut-rhythm">
                Each day, the <strong>highest box with cards</strong> opens automatically.
                Once it's empty, the next box down opens. You can also
                <strong> tap any box</strong> — including Mastered — to practice it directly,
                any time.
              </p>
            </div>

            <div className="tut-bottom">
              <button className="tut-next-btn" onClick={onDone}>
                Let's go! →
              </button>
              <button className="tut-back-btn" onClick={() => setPage(0)}>
                ← Back
              </button>
            </div>
          </>
        )}

        {/* Page dots */}
        <div className="tut-dots">
          <div className={`tut-dot ${page === 0 ? 'active' : ''}`} />
          <div className={`tut-dot ${page === 1 ? 'active' : ''}`} />
        </div>

      </div>
    </div>
  )
}
