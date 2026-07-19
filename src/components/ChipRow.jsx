import { useRef, useLayoutEffect, useState } from 'react'

/**
 * Wraps a row of chips and makes them elastic: they grow to fill the
 * available row width when there's slack, and shrink (via real font-size and
 * padding, not a visual transform) when they'd otherwise overflow — so they
 * always occupy exactly one row, never wrapping, and never leaving the row
 * looking sparse with empty space at the end.
 *
 * Mechanism: measures natural content width vs. available width, then sets
 * a `--chip-row-scale` CSS variable on the wrapper. Chip rules opt in by
 * multiplying their own font-size/padding by `var(--chip-row-scale, 1)` via
 * calc() — see index.css's .level-chip etc. This keeps real
 * layout metrics (so chips don't blur or look visually "off" the way a
 * transform: scale() would), while ChipRow stays a single, generic,
 * reusable measuring component that knows nothing about chip styling.
 *
 * Bounded to a sane range (0.05–1.4) so text never becomes comically
 * oversized with very few/short chips; the low floor exists to guarantee
 * a full row of chips (e.g. all 7 category parents, or "HSK1".."HSK9")
 * always fits on one row on narrow phones without ever wrapping.
 */
const MIN_SCALE = 0.05
const MAX_SCALE = 1.4

export default function ChipRow({ className = '', children }) {
  const outerRef = useRef(null)
  const innerRef = useRef(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return

    function measure() {
      const cs = getComputedStyle(outer)
      const hPadding = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
      const available = outer.clientWidth - hPadding
      // Derive the natural (unscaled) content width from the currently
      // rendered width, rather than imperatively resetting the DOM to scale
      // 1 first — that reset was itself a size change, which retriggers the
      // ResizeObserver below, which recomputes the same scale and calls
      // setScale with an identical value, so React bails the re-render and
      // the imperative reset is left as the final (wrong) DOM state instead
      // of the computed scale ever actually rendering.
      const currentScale = parseFloat(cs.getPropertyValue('--chip-row-scale')) || 1
      const neededAtCurrentScale = inner.scrollWidth
      if (available <= 0 || neededAtCurrentScale <= 0 || currentScale <= 0) return
      const naturalNeeded = neededAtCurrentScale / currentScale
      const raw = available / naturalNeeded
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, raw))
      setScale(prev => (Math.abs(prev - next) < 0.01 ? prev : next))
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(outer)
    return () => ro.disconnect()
  }, [children])

  return (
    <div
      ref={outerRef}
      className={`chip-row-outer ${className}`}
      style={{ '--chip-row-scale': scale }}
    >
      <div ref={innerRef} className="chip-row-inner">
        {children}
      </div>
    </div>
  )
}
