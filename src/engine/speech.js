/**
 * Web Speech API — Text-to-Speech
 * Language codes map from our internal language IDs to BCP-47 tags.
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

/**
 * Speak text in the given language.
 * @param {string} text - The text to speak
 * @param {string} language - Internal language code (zh, ja, de, es, en)
 * @param {object} options - Optional overrides: rate (0.1–2), pitch (0–2)
 */
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

export function stop() {
  if (isSupported()) window.speechSynthesis.cancel()
}
