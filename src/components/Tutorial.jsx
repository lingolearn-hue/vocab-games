import { useState } from 'react'
import './Tutorial.css'

const BOX_STEPS = [
  { box: '○', label: 'New', color: '#999',    desc: 'Words waiting to be learned' },
  { box: 'B1', label: 'Box 1', color: '#4f7ef8', desc: 'Practiced every round' },
  { box: 'B2', label: 'Box 2', color: '#22a06b', desc: 'Every 2nd round' },
  { box: 'B3', label: 'Box 3', color: '#f0a500', desc: 'Every 4th round' },
  { box: 'B4', label: 'Box 4', color: '#e05cb0', desc: 'Every 8th round' },
  { box: '★',  label: 'Mastered', color: '#22a06b', desc: 'You know this word!' },
]

export default function Tutorial({ onDone }) {
  const [page, setPage] = useState(0)  // 0 = warning, 1 = box system

  return (
    <div className="tut-screen">
      <div className="tut-panel">

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
                Get it right → advance. Get it wrong → back to Box 1.
              </p>

              <div className="tut-boxes">
                {BOX_STEPS.map((s, i) => (
                  <div key={i} className="tut-box-row">
                    <div className="tut-box-badge" style={{ borderColor: s.color, color: s.color }}>
                      {s.box}
                    </div>
                    <div className="tut-box-info">
                      <span className="tut-box-label" style={{ color: s.color }}>{s.label}</span>
                      <span className="tut-box-desc">{s.desc}</span>
                    </div>
                    {i < BOX_STEPS.length - 1 && (
                      <div className="tut-box-arrow">↓</div>
                    )}
                  </div>
                ))}
              </div>

              <p className="tut-rhythm">
                Box 1 opens <strong>every round</strong>.
                Box 2 opens <strong>every 2nd</strong>.
                Box 3 every <strong>4th</strong>, Box 4 every <strong>8th</strong>.
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
