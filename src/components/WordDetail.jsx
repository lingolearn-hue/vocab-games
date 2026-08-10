import { useState, useEffect, useRef } from 'react'
import { getMnemonic, setMnemonic, getAllMnemonics } from '../engine/mnemonics'
import { getExampleSentence } from '../engine/examples'
import { getConjugation } from '../engine/conjugations'
import RubyText from './RubyText'
import { TextWithLookup } from './TextWithLookup'
import './WordDetail.css'

/**
 * Word-detail overlay: translations, POS/level, example sentence, and an
 * editable mnemonic. Visually and functionally mirrors Flashcard's detail
 * panel (translations/example/mnemonic sections), minus the flashcard-
 * specific Known/Unknown/Master action buttons, which don't make sense
 * outside a review session. Used by VocabBrowser; Flashcard keeps its own
 * copy since its panel also drives the review flow (pendingAdvance,
 * isRevealed, etc.) — genuinely different enough not to force into one
 * shared component, but kept visually identical via matching class names/
 * layout so the two feel like the same feature.
 */
export default function WordDetail({ entry, language, lookup, scores, showReading, onClose }) {
  const [exampleSentence, setExampleSentence] = useState(null)
  const [conjugation, setConjugation] = useState(null)
  const [editingMnemonic, setEditingMnemonic] = useState(false)
  const [mnemonicText, setMnemonicText] = useState('')
  const mnemonicInputRef = useRef(null)

  useEffect(() => {
    setMnemonicText(getMnemonic(entry.id))
    setEditingMnemonic(false)
  }, [entry.id])

  useEffect(() => {
    let cancelled = false
    setExampleSentence(null)
    getExampleSentence(entry.listId, entry.entry, entry.pos).then(sentence => {
      if (!cancelled) setExampleSentence(sentence)
    })
    return () => { cancelled = true }
  }, [entry.listId, entry.entry, entry.pos])

  // Conjugation data currently only exists for German verbs (see
  // conjugations.js) — the fetch resolves to null for every other
  // language/pos, so this section simply doesn't render for them.
  useEffect(() => {
    let cancelled = false
    setConjugation(null)
    if (entry.pos !== 'verb') return
    getConjugation(language, entry.entry, entry.pos).then(c => {
      if (!cancelled) setConjugation(c)
    })
    return () => { cancelled = true }
  }, [language, entry.entry, entry.pos])

  useEffect(() => {
    if (editingMnemonic) mnemonicInputRef.current?.focus()
  }, [editingMnemonic])

  function saveMnemonic() {
    setMnemonic(entry.id, mnemonicText)
    setEditingMnemonic(false)
  }

  const savedMnemonic = getMnemonic(entry.id)
  const mnemonicRecord = getAllMnemonics()[entry.id]
  const isSeeded = mnemonicRecord?.seeded ?? false
  const allTranslations = entry.translation ?? []

  return (
    <div className="wd-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="wd-panel">
        <div className="wd-header">
          <RubyText text={entry.entry} reading={entry.reading} visible={showReading} size="md" />
          <button className="wd-close" onClick={onClose}>✕</button>
        </div>

        <div className="wd-section">
          <span className="wd-label">Translations</span>
          <div className="wd-translations">
            {allTranslations.map((t, i) => (
              <span key={i} className="wd-trans-item">{t}</span>
            ))}
          </div>
        </div>

        {(entry.pos || entry.level) && (
          <div className="wd-section wd-meta">
            {entry.pos   && <span className="wd-pos">{entry.pos}</span>}
            {entry.level && <span className="wd-level">{entry.level}</span>}
          </div>
        )}

        {conjugation && (
          <div className="wd-section">
            <span className="wd-label">🔤 Conjugation</span>
            <div className="wd-conjugation">
              <div className="wd-conj-row"><span className="wd-conj-key">er/sie/es</span><span className="wd-conj-val">{conjugation.presentTense}</span></div>
              <div className="wd-conj-row"><span className="wd-conj-key">Präteritum</span><span className="wd-conj-val">{conjugation.pastTense}</span></div>
              <div className="wd-conj-row"><span className="wd-conj-key">Partizip II</span><span className="wd-conj-val">{conjugation.pastParticiple}</span></div>
              <div className="wd-conj-row"><span className="wd-conj-key">Perfekt mit</span><span className="wd-conj-val">{conjugation.auxiliary}</span></div>
            </div>
          </div>
        )}

        <div className="wd-section">
          <span className="wd-label">📝 Example</span>
          {exampleSentence
            ? <div className="wd-example">{exampleSentence}</div>
            : <span className="wd-example-empty">No example sentence yet.</span>
          }
        </div>

        <div className="wd-section">
          <div className="wd-mnemonic-header">
            <span className="wd-label">
              💡 Mnemonic
              {isSeeded && <span className="wd-mnemonic-seeded-badge">starter</span>}
            </span>
            {!editingMnemonic && (
              <button className="wd-edit-btn" onClick={() => setEditingMnemonic(true)}>
                {savedMnemonic ? (isSeeded ? 'Replace' : 'Edit') : '+ Add'}
              </button>
            )}
          </div>

          {editingMnemonic ? (
            <div className="wd-mnemonic-edit">
              <textarea
                ref={mnemonicInputRef}
                className="wd-mnemonic-input"
                value={mnemonicText}
                onChange={e => setMnemonicText(e.target.value)}
                placeholder="Write a memory hook for this word…"
                rows={3}
              />
              <div className="wd-mnemonic-actions">
                <button className="wd-mnemonic-save" onClick={saveMnemonic}>Save</button>
                <button className="wd-mnemonic-cancel" onClick={() => {
                  setMnemonicText(getMnemonic(entry.id))
                  setEditingMnemonic(false)
                }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="wd-mnemonic-text">
              {savedMnemonic
                ? <TextWithLookup text={savedMnemonic} language={language} lookup={lookup} scores={scores} showReading={showReading} noHighlight />
                : <span className="wd-mnemonic-empty">No further details yet. Add a mnemonic to help remember this word.</span>
              }
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
