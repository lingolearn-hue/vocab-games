import { useState, useEffect, useMemo, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { getAllGrammarScores, recordGrammarCorrect, recordGrammarWrong } from '../engine/grammar'
import SpeakButton from '../components/SpeakButton'
import HelpButton from '../components/HelpButton'
import './MatchingDrills.css'

// ── Tone parsing ──────────────────────────────────────────────────────────────

const TONE_MAP = {
  // tone 1
  'ā':1,'ē':1,'ī':1,'ō':1,'ū':1,'ǖ':1,
  // tone 2
  'á':2,'é':2,'í':2,'ó':2,'ú':2,'ǘ':2,
  // tone 3
  'ǎ':3,'ě':3,'ǐ':3,'ǒ':3,'ǔ':3,'ǚ':3,
  // tone 4
  'à':4,'è':4,'ì':4,'ò':4,'ù':4,'ǜ':4,
}

const TONE_LABELS = { 1:'¯', 2:'/', 3:'ˇ', 4:'\\' }
const TONE_NAMES  = { 1:'1st tone', 2:'2nd tone', 3:'3rd tone', 4:'4th tone' }
const TONE_COLORS = { 1:'#4f7ef8', 2:'#22a06b', 3:'#e05cb0', 4:'#e5534b' }

function getSyllableTone(syllable) {
  for (const ch of syllable) {
    if (TONE_MAP[ch]) return TONE_MAP[ch]
  }
  return 5 // neutral
}

function parseTones(reading) {
  // reading is space-separated syllables e.g. "pínɡguǒ" or "nǐ hǎo"
  // But may also be continuous like "píngguǒ" — split on vowel tone changes
  const syllables = reading.trim().split(/\s+/)
  return syllables.map(s => ({ syllable: s, tone: getSyllableTone(s) }))
}

// ── Shared quiz engine ────────────────────────────────────────────────────────

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }

function useQuiz(entries, getAnswer, getOptions, scoreKey) {
  const [queue,     setQueue]     = useState([])
  const [qIndex,    setQIndex]    = useState(0)
  const [chosen,    setChosen]    = useState(null)
  const [feedback,  setFeedback]  = useState(null)
  const [correct,   setCorrect]   = useState(0)
  const [total,     setTotal]     = useState(0)
  const [cycleCount, setCycleCount] = useState(0)

  // Build priority queue: unanswered first, then low accuracy
  const buildQueue = useCallback(() => {
    const scores = getAllGrammarScores()
    return [...entries].sort((a, b) => {
      const sa = scores[scoreKey(a)] ?? { attempts: 0, correct: 0 }
      const sb = scores[scoreKey(b)] ?? { attempts: 0, correct: 0 }
      if (sa.attempts === 0 && sb.attempts > 0) return -1
      if (sb.attempts === 0 && sa.attempts > 0) return 1
      if (sa.attempts === 0) return 0
      return (sa.correct / sa.attempts) - (sb.correct / sb.attempts)
    })
  }, [entries, scoreKey])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- rebuilds the drill queue when entries/cycle change
    if (entries.length > 0) setQueue(buildQueue())
  }, [entries, cycleCount])

  const current = queue[qIndex % Math.max(1, queue.length)]
  const options  = useMemo(() => current ? getOptions(current, entries) : [], [current?.id])

  function choose(opt) {
    if (feedback || !current) return
    setChosen(opt)
    const correct = opt === getAnswer(current)
    setFeedback(correct ? 'correct' : 'wrong')
    setTotal(t => t + 1)
    if (correct) {
      setCorrect(c => c + 1)
      recordGrammarCorrect(scoreKey(current))
      setTimeout(() => advance(), 900)
    } else {
      recordGrammarWrong(scoreKey(current))
    }
  }

  function advance() {
    const next = qIndex + 1
    if (next % queue.length === 0) setCycleCount(c => c + 1)
    setQIndex(next)
    setChosen(null)
    setFeedback(null)
  }

  const accuracy = total > 0 ? Math.round((correct / total) * 100) : null

  return { current, options, chosen, feedback, correct, total, accuracy, choose, advance }
}

// ── Gender drill (German & Spanish) ──────────────────────────────────────────

function getArticle(entry, language) {
  if (language === 'de') {
    const m = entry.entry.match(/^(der|die|das)\s/)
    return m ? m[1] : null
  }
  if (language === 'es') {
    return entry.gender === 'm' ? 'el' : entry.gender === 'f' ? 'la' : null
  }
  return null
}

const GENDER_OPTIONS = {
  de: ['der', 'die', 'das'],
  es: ['el', 'la'],
}

const GENDER_NAMES = {
  de: { der: 'masculine', die: 'feminine', das: 'neuter' },
  es: { el: 'masculine', la: 'feminine' },
}

export function GenderDrill() {
  const { activeEntries, showReading, activeLanguage, loadedLists, selectedIds } = useApp()
  const language = activeLanguage ?? loadedLists[selectedIds[0]]?.language ?? 'de'

  // Only nouns with gender
  const nouns = useMemo(() =>
    activeEntries.filter(e => e.pos === 'noun' && getArticle(e, language) !== null),
    [activeEntries, language]
  )

  const getAnswer = useCallback(e => getArticle(e, language), [language])
  const getOptions = useCallback(() => shuffle(GENDER_OPTIONS[language] ?? []), [language])
  const scoreKey   = useCallback(e => `gender:${e.id}`, [])

  const { current, options, chosen, feedback, total, accuracy, choose, advance } = useQuiz(
    nouns, getAnswer, getOptions, scoreKey
  )

  // Strip article from display (de: "der Apfel" → "Apfel", es: "manzana" stays)
  function displayEntry(e) {
    if (language === 'de') return e.entry.replace(/^(der|die|das)\s/, '')
    return e.entry
  }

  if (nouns.length === 0) return (
    <div className="md-empty">No nouns with gender data loaded. Select German or Spanish.</div>
  )

  const correctArticle = current ? getAnswer(current) : ''
  const genderName = current ? GENDER_NAMES[language]?.[correctArticle] : ''

  return (
    <div className="md-exercise">
      {total > 0 && (
        <div className="md-score">{total} done{accuracy !== null ? ` · ${accuracy}%` : ''}</div>
      )}

      <div className={`md-card ${feedback || ''}`}>
        <div className="md-prompt">
          <span className="md-article-blank">___</span>
          <span className="md-entry">{current ? displayEntry(current) : ''}</span>
          <SpeakButton text={current?.entry} language={language} size="md" />
        </div>
        {current?.reading && showReading && (
          <div className="md-reading">{current.reading}</div>
        )}
        <div className="md-translation">{current?.translation[0]}</div>
      </div>

      <div className="md-options md-options--wide">
        {options.map(opt => {
          let state = ''
          if (feedback) {
            if (opt === correctArticle) state = 'correct'
            else if (opt === chosen)    state = 'wrong'
          }
          return (
            <button
              key={opt}
              className={`md-option md-option--${state || 'idle'}`}
              onClick={() => choose(opt)}
              disabled={!!feedback}
            >
              {opt}
            </button>
          )
        })}
      </div>

      {feedback === 'correct' && (
        <div className="md-feedback md-feedback--correct">
          ✓ {correctArticle} — {genderName}
        </div>
      )}
      {feedback === 'wrong' && (
        <div className="md-feedback md-feedback--wrong">
          ✗ It's <strong>{correctArticle}</strong> ({genderName})
          <button className="md-next-btn" onClick={advance}>Next →</button>
        </div>
      )}
    </div>
  )
}

// ── Tone drill (Chinese) ──────────────────────────────────────────────────────

// Strip tone diacritics from a pinyin syllable: māo → mao
function stripTone(syl) {
  return syl.normalize('NFD').replace(/[\u0300-\u036f]/g,'').normalize('NFC')
}

export function ToneDrill() {
  const { activeEntries, activeLanguage } = useApp()
  const language = activeLanguage ?? 'zh'
  const [showPinyin, setShowPinyin] = useState(true)

  const syllableItems = useMemo(() => {
    const items = []
    for (const e of activeEntries) {
      if (!e.reading) continue
      const tones = parseTones(e.reading)
      tones.forEach((t, i) => {
        if (t.tone === 5) return
        items.push({
          id: `${e.id}::tone::${i}`,
          entry: e.entry,
          reading: e.reading,
          translation: e.translation,
          syllable: t.syllable,          // with tone mark e.g. māo
          syllableIndex: i,
          tone: t.tone,
          totalSyllables: tones.length,
          entryId: e.id,
        })
      })
    }
    return items
  }, [activeEntries])

  // Always show all 5 tones in fixed order 1–5
  const getAnswer  = useCallback(item => item.tone, [])
  const getOptions = useCallback(() => [1,2,3,4,5], [])
  const scoreKey   = useCallback(item => `tone:${item.id}`, [])

  const { current, options, chosen, feedback, total, accuracy, choose, advance } = useQuiz(
    syllableItems, getAnswer, getOptions, scoreKey
  )

  if (syllableItems.length === 0) return (
    <div className="md-empty">No tonal words loaded. Select Chinese.</div>
  )

  const correctTone = current?.tone

  // Pinyin above the character — tone-stripped so the student can't cheat
  function renderPinyinAbove(item) {
    if (!item || !showPinyin) return null
    const parts = item.reading.trim().split(/\s+/)
    return (
      <div className="md-tone-pinyin-above">
        {parts.map((syl, i) => (
          <span
            key={i}
            className={`md-tone-syl-above ${i === item.syllableIndex ? 'target' : ''}`}
          >
            {stripTone(syl)}{i === item.syllableIndex ? '?' : ''}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="md-exercise">
      <div className="md-tone-header">
        {total > 0 && (
          <div className="md-score">{total} done{accuracy !== null ? ` · ${accuracy}%` : ''}</div>
        )}
        <button
          className={`md-pinyin-toggle ${showPinyin ? 'active' : ''}`}
          onClick={() => setShowPinyin(v => !v)}
        >
          拼音 {showPinyin ? 'on' : 'off'}
        </button>
      </div>

      <div className={`md-card ${feedback || ''}`}>
        <div className="md-prompt md-prompt--cjk">
          {current && (
            <>
              {renderPinyinAbove(current)}
              <span className="md-entry">{current.entry}</span>
              <SpeakButton text={current.entry} language={language} size="md" />
            </>
          )}
        </div>
        <div className="md-tone-question">
          What tone is <strong>{stripTone(current?.syllable ?? '')}</strong>
          {current?.totalSyllables > 1 && (
            <span className="md-syllable-pos"> (syllable {current.syllableIndex + 1} of {current.totalSyllables})</span>
          )}?
        </div>
        <div className="md-translation">{current?.translation[0]}</div>
      </div>

      <div className="md-options md-options--tones">
        {options.map(tone => {
          let state = ''
          if (feedback) {
            if (tone === correctTone) state = 'correct'
            else if (tone === chosen) state = 'wrong'
          }
          const labels5 = { ...TONE_LABELS, 5: '· (neutral)' }
          const names5  = { ...TONE_NAMES,  5: 'Neutral' }
          return (
            <button
              key={tone}
              className={`md-option md-option--tone md-option--${state || 'idle'}`}
              style={{ '--tone-color': TONE_COLORS[tone] ?? '#aaa' }}
              onClick={() => choose(tone)}
              disabled={!!feedback}
            >
              <span className="md-tone-num">{tone}</span>
              <span className="md-tone-mark">{labels5[tone]}</span>
              <span className="md-tone-name">{names5[tone]}</span>
            </button>
          )
        })}
      </div>

      {feedback === 'correct' && (
        <div className="md-feedback md-feedback--correct">
          ✓ {current?.syllable} — Tone {correctTone}
        </div>
      )}
      {feedback === 'wrong' && (
        <div className="md-feedback md-feedback--wrong">
          ✗ Tone <strong>{correctTone}</strong> — {current?.syllable}
          <button className="md-next-btn" onClick={advance}>Next →</button>
        </div>
      )}
    </div>
  )
}

// ── Measure word drill (Chinese & Japanese) ───────────────────────────────────

const MW_DISTRACTORS = {
  zh: ['个', '只', '本', '张', '杯', '瓶', '条', '块', '件', '双'],
  ja: ['個', '匹', '冊', '杯', '本', '枚', '台', '頭', '羽', '人'],
}

export function MeasureWordDrill() {
  const { activeEntries, showReading, activeLanguage } = useApp()

  const language = activeLanguage ?? 'zh'

  // Only nouns with a measure word
  const nouns = useMemo(() =>
    activeEntries.filter(e => e.pos === 'noun' && e.measureWord),
    [activeEntries]
  )

  const allMeasureWords = useMemo(() => {
    const fromVocab = [...new Set(nouns.map(e => e.measureWord))]
    const fallback  = MW_DISTRACTORS[language] ?? []
    return [...new Set([...fromVocab, ...fallback])]
  }, [nouns, language])

  const getAnswer = useCallback(e => e.measureWord, [])
  const getOptions = useCallback((entry) => {
    const correct = entry.measureWord
    const others  = shuffle(allMeasureWords.filter(mw => mw !== correct))
    return shuffle([correct, ...others.slice(0, 3)])
  }, [allMeasureWords])
  const scoreKey = useCallback(e => `mw:${e.id}`, [])

  const { current, options, chosen, feedback, total, accuracy, choose, advance } = useQuiz(
    nouns, getAnswer, getOptions, scoreKey
  )

  if (nouns.length === 0) return (
    <div className="md-empty">No nouns with measure word data loaded. Select Chinese or Japanese.</div>
  )

  const correctMW = current?.measureWord
  const quantifier = language === 'zh' ? '一' : 'ひとつの'

  return (
    <div className="md-exercise">
      {total > 0 && (
        <div className="md-score">{total} done{accuracy !== null ? ` · ${accuracy}%` : ''}</div>
      )}

      <div className={`md-card ${feedback || ''}`}>
        <div className="md-prompt md-prompt--cjk">
          <span className="md-mw-prefix">{quantifier}</span>
          <span className="md-article-blank">___</span>
          <span className="md-entry">{current?.entry}</span>
          <SpeakButton text={current?.entry} language={language} size="md" />
        </div>
        {current?.reading && showReading && (
          <div className="md-reading">{current.reading}</div>
        )}
        <div className="md-translation">{current?.translation[0]}</div>
      </div>

      <div className="md-options md-options--mw">
        {options.map(opt => {
          let state = ''
          if (feedback) {
            if (opt === correctMW) state = 'correct'
            else if (opt === chosen) state = 'wrong'
          }
          return (
            <button
              key={opt}
              className={`md-option md-option--mw md-option--${state || 'idle'}`}
              onClick={() => choose(opt)}
              disabled={!!feedback}
            >
              {opt}
            </button>
          )
        })}
      </div>

      {feedback === 'correct' && (
        <div className="md-feedback md-feedback--correct">
          ✓ {quantifier}{correctMW}{current?.entry}
        </div>
      )}
      {feedback === 'wrong' && (
        <div className="md-feedback md-feedback--wrong">
          ✗ Correct: <strong>{quantifier}{correctMW}{current?.entry}</strong>
          <button className="md-next-btn" onClick={advance}>Next →</button>
        </div>
      )}
    </div>
  )
}

// ── Drill selector wrapper ─────────────────────────────────────────────────────

const DRILL_TYPES = {
  gender:      { label: 'Gender',       icon: '♂♀',  desc: 'Match nouns to their article / gender' },
  tone:        { label: 'Tones',        icon: '♩',   desc: 'Identify the tone of each syllable' },
  measureWord: { label: 'Measure Words',icon: '量',   desc: 'Match nouns to their measure word' },
}

export default function MatchingDrills() {
  const { setScreen, activeLanguage } = useApp()
  const [activeDrill, setActiveDrill] = useState(null)

  // Determine which drills are relevant for the active language
  const available = useMemo(() => {
    const lang = activeLanguage
    const drills = []
    if (lang === 'de' || lang === 'es') drills.push('gender')
    if (lang === 'zh')                   drills.push('tone', 'measureWord')
    if (lang === 'ja')                   drills.push('measureWord')
    if (drills.length === 0)             drills.push('gender', 'tone', 'measureWord') // show all if unknown
    return drills
  }, [activeLanguage])

  return (
    <div className="md-screen">
      <div className="md-header">
        <button
          className="md-back"
          onClick={() => activeDrill ? setActiveDrill(null) : setScreen('setup')}
        >
          {activeDrill ? '← Drills' : '← Back'}
        </button>
        <span className="md-title">
          {activeDrill ? DRILL_TYPES[activeDrill]?.label : 'Matching Drills'}
        </span>
        <HelpButton
          title="Matching Drills"
          description="Practice grammar patterns such as gender, tone, or measure words by matching or choosing the correct form."
        />
      </div>

      <div className="md-body">
        {!activeDrill ? (
          <div className="md-drill-list">
            {available.map(type => (
              <button key={type} className="md-drill-card" onClick={() => setActiveDrill(type)}>
                <span className="md-drill-icon">{DRILL_TYPES[type].icon}</span>
                <div className="md-drill-info">
                  <span className="md-drill-label">{DRILL_TYPES[type].label}</span>
                  <span className="md-drill-desc">{DRILL_TYPES[type].desc}</span>
                </div>
                <span className="md-drill-arrow">›</span>
              </button>
            ))}
          </div>
        ) : activeDrill === 'gender' ? (
          <GenderDrill />
        ) : activeDrill === 'tone' ? (
          <ToneDrill />
        ) : (
          <MeasureWordDrill />
        )}
      </div>
    </div>
  )
}
