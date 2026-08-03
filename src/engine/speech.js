/**
 * Web Speech API — Text-to-Speech
 * Language codes map from our internal language IDs to BCP-47 tags.
 *
 * Deliberately never sets utterance.voice — always leaves voice selection
 * to the browser/OS default for the given language. A per-language voice
 * picker was tried and removed: there's no reliable way for a webpage to
 * query "the OS's configured system TTS voice" as a distinct concept (only
 * a `.default` flag per voice, which is a browser-engine guess, not
 * necessarily what the user actually configured at the OS level — most
 * notably on Android/Chrome), so a picker mostly added complexity without
 * a dependable payoff. Leaving utterance.lang set and voice unset is the
 * most predictable choice.
 */

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

export function speak(text, language, options = {}) {
  if (!isSupported() || !text) return
  // Cancel any current speech first
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang  = LANG_CODES[language] ?? 'zh-CN'
  utterance.rate  = options.rate  ?? 0.9   // slightly slower than default for learners
  utterance.pitch = options.pitch ?? 1.0
  window.speechSynthesis.speak(utterance)
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
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang  = LANG_CODES[language] ?? 'zh-CN'
    utterance.rate  = options.rate  ?? 0.9
    utterance.pitch = options.pitch ?? 1.0
    utterance.onend = () => resolve()
    utterance.onerror = () => resolve()  // don't let a TTS glitch hang the whole sequence
    window.speechSynthesis.speak(utterance)
  })
}

export function stop() {
  if (isSupported()) window.speechSynthesis.cancel()
}
