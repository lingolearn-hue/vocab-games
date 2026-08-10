import { useState } from 'react'
import { checkTileOrder, getAlternatives } from '../engine/grammar'
import './TileOrderExercise.css'

/**
 * Tap-to-place word-order exercise — shared by GrammarTrainer's static
 * pattern pool and Grammar Dictionary's dynamically generated tile-order
 * quizzes. Pure presentational + interaction logic; scoring/advancement is
 * left to the caller via callbacks so each context can do its own thing
 * (localStorage SRS scoring for Grammar Trainer, in-session running tally
 * for the dynamic quiz overlay).
 *
 * Props:
 *   tiles     — array of word/phrase strings, in scrambled bank order
 *   answers   — array of { order: [indices into tiles], note? } — one or
 *               more accepted orderings
 *   onCheck   — (isCorrect) => void, fired the moment the user checks
 *   onNext    — (isCorrect) => void, fired when the user dismisses feedback
 *               and moves on (via the "Next →" button)
 *   prompt    — optional override for the instruction text
 */
export default function TileOrderExercise({ tiles, answers, onCheck, onNext, prompt }) {
  const [placed,    setPlaced]    = useState([])
  const [feedback,  setFeedback]  = useState(null)
  const [alternatives, setAlternatives] = useState([])
  const [wrongMsg,  setWrongMsg]  = useState('')

  function placeTile(idx) {
    if (feedback || placed.includes(idx)) return
    setPlaced(p => [...p, idx])
  }

  function removeTile(pos) {
    if (feedback) return
    setPlaced(p => p.filter((_, i) => i !== pos))
  }

  function submit() {
    if (placed.length !== tiles.length) return
    const { correct, matchedAnswer } = checkTileOrder(tiles, placed, answers)
    if (correct) {
      setAlternatives(getAlternatives(tiles, answers, matchedAnswer))
      setFeedback('correct')
    } else {
      setWrongMsg(answers[0].order.map(i => tiles[i]).join(' '))
      setFeedback('wrong')
    }
    onCheck?.(correct)
  }

  function reset() {
    setPlaced([])
    setFeedback(null)
    setAlternatives([])
    setWrongMsg('')
  }

  return (
    <div className="toe-exercise">
      <p className="toe-prompt">{prompt ?? 'Arrange the tiles into the correct sentence order.'}</p>
      <div className={`toe-answer-zone ${feedback || ''}`}>
        {placed.length === 0
          ? <span className="toe-answer-placeholder">Tap tiles below to build the sentence…</span>
          : placed.map((idx, pos) => (
            <button
              key={pos}
              className="toe-tile toe-tile--placed"
              onClick={() => removeTile(pos)}
              disabled={!!feedback}
            >
              {tiles[idx]}
            </button>
          ))
        }
      </div>
      {/* Bank stays at fixed positions the whole time — tiles are greyed
          out and blocked once placed rather than removed from the list,
          so the remaining tiles don't reflow/jump around on every tap. */}
      <div className="toe-tile-bank">
        {tiles.map((word, idx) => (
          <button
            key={idx}
            className={`toe-tile toe-tile--bank ${placed.includes(idx) ? 'toe-tile--used' : ''}`}
            onClick={() => placeTile(idx)}
            disabled={!!feedback || placed.includes(idx)}
          >
            {word}
          </button>
        ))}
      </div>
      {!feedback && (
        <div className="toe-controls">
          <button className="toe-reset-btn" onClick={reset}>↺ Reset</button>
          <button
            className="toe-submit-btn"
            onClick={submit}
            disabled={placed.length !== tiles.length}
          >
            Check
          </button>
        </div>
      )}
      {feedback === 'correct' && (
        <div className="toe-correct-feedback">
          <span>✓ Correct!</span>
          {alternatives.map((alt, i) => (
            <div key={i} className="toe-alternative">
              Also correct: <strong>{alt.sentence}</strong>
              {alt.note && <span className="toe-alt-note"> — {alt.note}</span>}
            </div>
          ))}
        </div>
      )}
      {feedback === 'wrong' && (
        <div className="toe-wrong-feedback">
          <span className="toe-wrong-label">✗ Not quite.</span>
          One correct order: <strong>{wrongMsg}</strong>
        </div>
      )}
      {feedback && (
        <button className="toe-next-btn" onClick={() => onNext?.(feedback === 'correct')}>
          Next →
        </button>
      )}
    </div>
  )
}
