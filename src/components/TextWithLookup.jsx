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

import { useState, useCallback, useMemo } from "react"
import { tokenise } from '../engine/reader'
import { getMnemonic, getAllMnemonics } from '../engine/mnemonics'
import RubyText from './RubyText'
import SpeakButton from './SpeakButton'
import './TextWithLookup.css'

const CJK_LANGS = new Set(['zh', 'ja', 'ko'])

export function TextWithLookup({ text, language, lookup, scores, showReading, className = '', noHighlight = false, surfaceForms = {} }) {
  const [tapped, setTapped] = useState(null)  // { entry, surface, conjugated }

  // Build augmented lookup that resolves surface forms via surfaceForms dict
  const augmentedLookup = useMemo(() => {
    const base = lookup ?? {}
    if (!surfaceForms || !Object.keys(surfaceForms).length) return base
    const langForms = surfaceForms[language] ?? {}
    if (!Object.keys(langForms).length) return base
    const extra = {}
    for (const [surface, lemma] of Object.entries(langForms)) {
      if (!base[surface] && base[lemma]) {
        extra[surface] = { ...base[lemma], _surface: surface }
      }
    }
    return { ...base, ...extra }
  }, [lookup, surfaceForms, language])

  const spans = tokenise(text, augmentedLookup, language)
  const isCJK = CJK_LANGS.has(language)

  const handleTap = useCallback((span, e) => {
    if (!span.entry) return
    e.stopPropagation()
    setTapped(prev => prev?.entry?.id === span.entry.id ? null : {
      entry: span.entry,
      surface: span.text,
      conjugated: !!span.conjugated || !!(span.entry._surface),
    })
  }, [])

  return (
    <>
      <span
        className={`twl-text ${isCJK ? 'twl-cjk' : ''} ${className}`}
        onClick={() => setTapped(null)}
      >
        {spans.map((span, i) => {
          if (!span.entry) {
            return <span key={i} className="twl-plain">{span.text}</span>
          }
          const status = noHighlight ? 'none' : (scores[span.entry.id]?.global ?? 'unseen')
          const isActive = tapped?.entry?.id === span.entry.id
          return (
            <span
              key={i}
              className={`twl-word ${noHighlight ? '' : `twl-word--${status}`} ${isActive ? 'twl-word--active' : ''} ${span.conjugated ? 'twl-word--conjugated' : ''}`}
              onClick={e => handleTap(span, e)}
            >
              {span.text}
            </span>
          )
        })}
      </span>

      {tapped && (
        <WordPopup
          entry={tapped.entry}
          surface={tapped.surface}
          conjugated={tapped.conjugated}
          scores={scores}
          showReading={showReading}
          language={language}
          onDismiss={() => setTapped(null)}
        />
      )}
    </>
  )
}

export function WordPopup({ entry, surface, conjugated, scores, showReading, onDismiss, language }) {
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
          <SpeakButton text={entry.entry} language={language} size="lg" />
          <span className={`twl-popup-status twl-popup-status--${status}`}>{status}</span>
        </div>
        {conjugated && surface && surface !== entry.entry && (
          <div className="twl-popup-conjugated">
            <span className="twl-popup-surface">{surface}</span>
            <span className="twl-popup-arrow">→</span>
            <span className="twl-popup-dict">{entry.entry}</span>
          </div>
        )}

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
