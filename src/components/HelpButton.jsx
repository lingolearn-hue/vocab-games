import { useState } from 'react'
import HelpOverlay from './HelpOverlay'
import '../components/ReadingToggle.css'

/**
 * "?" button in the same visual style as the toggle buttons (DirectionToggle,
 * ReadingToggle, etc). Opens a one-page HelpOverlay with the game's
 * description, its header buttons explained, and (optionally) the shared
 * box-system explainer. Self-contained — just drop it in any header and
 * pass the content for that screen.
 */
export default function HelpButton({ title, description, buttons, showBoxes }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="reading-toggle" onClick={() => setOpen(true)} title="Help">?</button>
      {open && (
        <HelpOverlay
          title={title}
          description={description}
          buttons={buttons}
          showBoxes={showBoxes}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
