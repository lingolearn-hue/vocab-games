/**
 * Web Speech API — Text-to-Speech
 * Language codes map from our internal language IDs to BCP-47 tags.
 *
 * By default, utterance.voice is left unset (browser/OS default for the
 * given language). A per-language voice picker was tried once and removed,
 * then reintroduced here in a narrower form: there's still no reliable way
 * to query "the OS's configured system TTS voice" as a distinct concept —
 * SpeechSynthesisVoice only exposes a `.default` flag, which is a browser
 * engine guess, not necessarily the voice configured at the OS level (e.g.
 * a custom Siri voice on iOS). So instead of guessing, we let the user pick
 * an explicit voice per language in Settings; that choice is stored by
 * voiceURI (a stable per-voice identifier) and applied here whenever set.
 * Leaving voice unset falls back to the previous, most-predictable default
 * behavior.
 */

const STORAGE_KEY = 'vocabSettings'

const LANG_CODES = {
  zh: 'zh-CN',
  ja: 'ja-JP',
  de: 'de-DE',
  es: 'es-ES',
  fr: 'fr-FR',
  en: 'en-US',
}

export function isSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/** All voices currently available for a given internal language id. */
export function getVoicesForLanguage(language) {
  if (!isSupported()) return []
  const langCode = LANG_CODES[language]
  if (!langCode) return []
  const prefix = langCode.split('-')[0]
  return window.speechSynthesis.getVoices()
    .filter(v => v.lang === langCode || v.lang.split('-')[0] === prefix)
}

function readVoicePref(language) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.voices?.[language] ?? null
  } catch {
    return null
  }
}

function resolveVoice(language) {
  const voiceURI = readVoicePref(language)
  if (!voiceURI || !isSupported()) return null
  return window.speechSynthesis.getVoices().find(v => v.voiceURI === voiceURI) ?? null
}

function buildUtterance(text, language, options) {
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang  = LANG_CODES[language] ?? 'zh-CN'
  utterance.rate  = options.rate  ?? 0.9   // slightly slower than default for learners
  utterance.pitch = options.pitch ?? 1.0
  const voice = resolveVoice(language)
  if (voice) utterance.voice = voice
  return utterance
}

export function speak(text, language, options = {}) {
  if (!isSupported() || !text) return
  // Cancel any current speech first
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(buildUtterance(text, language, options))
}

/**
 * Same as speak(), but returns a Promise that resolves once the utterance
 * finishes (or immediately if unsupported/empty) — needed for sequencing
 * several utterances back-to-back (e.g. word → translation → example
 * sentence in the Listening game) without stepping on each other, since
 * speak() calls speechSynthesis.cancel() on every call and would cut off
 * anything still in progress.
 */
export function speakAndWait(text, language, options = {}) {
  return new Promise(resolve => {
    if (!isSupported() || !text) { resolve(); return }
    window.speechSynthesis.cancel()
    const utterance = buildUtterance(text, language, options)
    utterance.onend = () => resolve()
    utterance.onerror = () => resolve()  // don't let a TTS glitch hang the whole sequence
    window.speechSynthesis.speak(utterance)
  })
}

export function stop() {
  if (isSupported()) window.speechSynthesis.cancel()
}
