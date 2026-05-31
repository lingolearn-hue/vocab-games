/**
 * TextWithLookup — renders text with tappable vocab words.
 * Words are highlighted by SRS status; tapping shows WordPopup.
 *
 * Props:
 *   text       — string to render
 *   language   — 'zh'|'ja'|'es'|'de' etc.
 *   lookup     — Map from buildLookup()
 *   scores     — from AppContext
 *   showReading — boolean
 *   className  — extra class on wrapper
 *   isCJK      — override CJK rendering (default: auto from language)
 */

import { useState, useCallback } from 'react'
import { tokenise } from '../engine/reader'
import { getMnemonic, getAllMnemonics } from '../engine/mnemonics'
import RubyText from './RubyText'
import './TextWithLookup.css'

const CJK_LANGS = new Set(['zh', 'ja', 'ko'])

export function TextWithLookup({ text, language, lookup, scores, showReading, className = '' }) {
  const [tappedEntry, setTappedEntry] = useState(null)

  const spans = tokenise(text, lookup, language)
  const isCJK = CJK_LANGS.has(language)

  const handleTap = useCallback((span, e) => {
    if (!span.entry) return
    e.stopPropagation()
    setTappedEntry(prev => prev?.id === span.entry.id ? null : span.entry)
  }, [])

  return (
    <>
      <span
        className={`twl-text ${isCJK ? 'twl-cjk' : ''} ${className}`}
        onClick={() => setTappedEntry(null)}
      >
        {spans.map((span, i) => {
          if (!span.entry) {
            return <span key={i} className="twl-plain">{span.text}</span>
          }
          const status = scores[span.entry.id]?.global ?? 'unseen'
          const isActive = tappedEntry?.id === span.entry.id
          return (
            <span
              key={i}
              className={`twl-word twl-word--${status} ${isActive ? 'twl-word--active' : ''}`}
              onClick={e => handleTap(span, e)}
            >
              {span.text}
            </span>
          )
        })}
      </span>

      {tappedEntry && (
        <WordPopup
          entry={tappedEntry}
          scores={scores}
          showReading={showReading}
          onDismiss={() => setTappedEntry(null)}
        />
      )}
    </>
  )
}

export function WordPopup({ entry, scores, showReading, onDismiss }) {
  const status   = scores[entry.id]?.global ?? 'unseen'
  const mnemonic = getMnemonic(entry.id)
  const mnemonicRecord = getAllMnemonics()[entry.id]
  const isSeeded = mnemonicRecord?.seeded ?? false

  return (
    <div className="twl-popup-overlay" onClick={onDismiss}>
      <div className="twl-popup" onClick={e => e.stopPropagation()}>
        <button className="twl-popup-close" onClick={onDismiss}>✕</button>

        <div className="twl-popup-word">
          <RubyText
            text={entry.entry}
            reading={entry.reading}
            visible={showReading && !!entry.reading}
            size="lg"
          />
          <span className={`twl-popup-status twl-popup-status--${status}`}>{status}</span>
        </div>

        <div className="twl-popup-translations">
          {entry.translation.map((t, i) => (
            <span key={i} className="twl-popup-trans">{t}</span>
          ))}
        </div>

        {(entry.pos || entry.level) && (
          <div className="twl-popup-meta">
            {entry.pos   && <span className="twl-popup-pos">{entry.pos}</span>}
            {entry.level && <span className="twl-popup-level">{entry.level}</span>}
          </div>
        )}

        {mnemonic && (
          <div className="twl-popup-mnemonic">
            💡 {mnemonic}
            {isSeeded && <span className="twl-popup-seeded">starter</span>}
          </div>
        )}
      </div>
    </div>
  )
}
