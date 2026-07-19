import { useEffect, useState } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import Setup from './components/Setup'
import RaceCar from './games/RaceCar'
import PairMatch from './games/PairMatch'
import Flashcard from './games/Flashcard'
import GapFill from './games/GapFill'
import VocabBrowser from './games/VocabBrowser'
import Settings from './games/Settings'
import Stats from './games/Stats'
import Typing from './games/Typing'
import GradedReader from './games/GradedReader'
import StrokeOrder from './games/StrokeOrder'
import Dialogue from './games/Dialogue'
import GrammarTrainer from './games/GrammarTrainer'
import MatchingDrills from './games/MatchingDrills'
import Adventure from './games/Adventure'
import GrammarDictionary from './games/GrammarDictionary'
import Tutorial from './components/Tutorial'
import './App.css'

const LANGUAGE_FLAGS = { zh: '🇨🇳', es: '🇪🇸', de: '🇩🇪', ja: '🇯🇵', en: '🇬🇧', fr: '🇫🇷' }
const LANGUAGES = [
  { language: 'zh', label: 'Chinese 🇨🇳' },
  { language: 'es', label: 'Spanish 🇪🇸' },
  { language: 'de', label: 'German 🇩🇪'  },
  { language: 'fr', label: 'French 🇫🇷'   },
  { language: 'ja', label: 'Japanese 🇯🇵' },
  { language: 'en', label: 'English 🇬🇧'  },
]

function FirstLaunchOverlay() {
  const { activeLanguage, setActiveLanguage } = useApp()
  if (activeLanguage) return null
  return (
    <div className="fl-overlay">
      <div className="fl-panel">
        <h2 className="fl-title">Welcome to Vocab Games</h2>
        <p className="fl-subtitle">Choose a language to get started</p>
        <div className="fl-lang-grid">
          {LANGUAGES.map(l => (
            <button
              key={l.language}
              className="fl-lang-btn"
              onClick={() => setActiveLanguage(l.language)}
            >
              <span className="fl-flag">{LANGUAGE_FLAGS[l.language]}</span>
              <span className="fl-lang-name">{l.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Router() {
  const { screen, goBack } = useApp()

  // Global Escape: always goes back to previous screen
  useEffect(() => {
    const GAME_SCREENS = new Set(['racecar','pairmatch','flashcard','gapfill','typing',
      'reader','dialogue','grammar','matching','vocab','stats','settings','adventure','grammar-dict'])
    function onKey(e) {
      if (e.key === 'Escape' && GAME_SCREENS.has(screen)) goBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [screen, goBack])

  switch (screen) {
    case 'racecar':   return <RaceCar />
    case 'pairmatch': return <PairMatch />
    case 'flashcard': return <Flashcard />
    case 'gapfill':   return <GapFill />
    case 'vocab':     return <VocabBrowser />
    case 'typing':    return <Typing />
    case 'settings':  return <Settings />
    case 'stats':     return <Stats />
    case 'reader':    return <GradedReader />
    case 'dialogue':  return <Dialogue />
    case 'grammar':   return <GrammarTrainer />
    case 'matching':  return <MatchingDrills />
    case 'adventure':     return <Adventure />
    case 'grammar-dict':  return <GrammarDictionary />
    case 'stroke-order':  return <StrokeOrder />
    default:              return <Setup />
  }
}

function LoadingOverlay() {
  const { vocabLoading } = useApp()
  if (!vocabLoading) return null
  return (
    <div className="loading-overlay">
      <div className="loading-spinner" />
      <div className="loading-text">Loading vocabulary…</div>
    </div>
  )
}

function TutorialGate({ children }) {
  const [showTutorial, setShowTutorial] = useState(
    () => !localStorage.getItem('hasSeenTutorial')
  )

  function handleDone() {
    localStorage.setItem('hasSeenTutorial', '1')
    setShowTutorial(false)
  }

  return (
    <>
      {children}
      {showTutorial && <Tutorial onDone={handleDone} />}
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <TutorialGate>
        <Router />
        <FirstLaunchOverlay />
        <LoadingOverlay />
      </TutorialGate>
    </AppProvider>
  )
}
