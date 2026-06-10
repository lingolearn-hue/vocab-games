import './RubyText.css'

/**
 * Renders text with optional ruby (furigana/pinyin) annotation above.
 * Uses native <ruby>/<rt> — browsers render rt above the base text.
 */
export default function RubyText({ text, reading, visible = true, size = 'md', className = '' }) {
  if (!text) return null

  if (!reading || !visible) {
    return <span className={`ruby-plain ruby-${size} ruby-no-rt ${className}`}>{text}</span>
  }

  const chars     = [...text]
  const syllables = reading.trim().split(/\s+/)
  const paired    = chars.length === syllables.length

  if (paired) {
    return (
      <span className={`ruby-wrap ruby-${size} ${className}`}>
        {chars.map((ch, i) => (
          <ruby key={i}>{ch}<rt className="ruby-rt">{syllables[i]}</rt></ruby>
        ))}
      </span>
    )
  }

  return (
    <span className={`ruby-wrap ruby-${size} ${className}`}>
      <ruby>{text}<rt className="ruby-rt">{reading}</rt></ruby>
    </span>
  )
}
