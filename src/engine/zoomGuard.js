/**
 * Zoom guard — some browsers (notably iOS Safari, which ignores
 * `user-scalable=no` for accessibility reasons since iOS 10) can still let a
 * stray double-tap or pinch zoom the page in, even with our viewport meta tag
 * and `touch-action` CSS in place. Once zoomed, there's often no easy way back
 * for the user since pinch-to-zoom-out can be finicky on a small screen.
 *
 * This watches the visual viewport for a zoomed-in state and automatically
 * resets it by nudging the viewport meta tag, which forces the browser to
 * recompute layout at scale 1.0. Safe to call once at app startup.
 */

const RESET_DELAY_MS = 250  // wait briefly after the gesture ends before resetting, so we don't fight an intentional pinch mid-gesture
const ZOOM_THRESHOLD  = 1.02  // small tolerance for floating-point/rounding noise

export function installZoomGuard() {
  if (typeof window === 'undefined') return

  const viewportMeta = document.querySelector('meta[name="viewport"]')
  if (!viewportMeta) return

  let resetTimer = null

  function isZoomedIn() {
    // visualViewport.scale is the most direct signal where supported
    if (window.visualViewport && typeof window.visualViewport.scale === 'number') {
      return window.visualViewport.scale > ZOOM_THRESHOLD
    }
    // Fallback heuristic for browsers without the Visual Viewport API:
    // compare layout viewport width to the window's reported inner width.
    const layoutWidth = document.documentElement.clientWidth
    return layoutWidth > 0 && (window.innerWidth / layoutWidth) > ZOOM_THRESHOLD
  }

  function resetZoom() {
    // Re-applying the same viewport content forces most engines to
    // recompute and snap the visual viewport back to scale 1.0.
    const original = viewportMeta.getAttribute('content')
    viewportMeta.setAttribute('content', original + ', shrink-to-fit=no')
    requestAnimationFrame(() => {
      viewportMeta.setAttribute('content', original)
    })
  }

  function scheduleCheck() {
    clearTimeout(resetTimer)
    resetTimer = setTimeout(() => {
      if (isZoomedIn()) resetZoom()
    }, RESET_DELAY_MS)
  }

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', scheduleCheck)
    window.visualViewport.addEventListener('scroll', scheduleCheck)
  } else {
    window.addEventListener('resize', scheduleCheck)
  }
  // Also catch the end of a touch gesture directly, since some browsers
  // don't fire a visualViewport event until later.
  window.addEventListener('touchend', scheduleCheck, { passive: true })
}
