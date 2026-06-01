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
import Dialogue from './games/Dialogue'
<<<<<<< HEAD
=======
import GrammarTrainer from './games/GrammarTrainer'
import MatchingDrills from './games/MatchingDrills'
import './App.css'

const LANGUAGE_FLAGS = { zh: '🇨🇳', es: '🇪🇸', de: '🇩🇪', ja: '🇯🇵' }
const LANGUAGES = [
  { language: 'zh', label: 'Chinese 🇨🇳' },
  { language: 'es', label: 'Spanish 🇪🇸' },
  { language: 'de', label: 'German 🇩🇪'  },
  { language: 'ja', label: 'Japanese 🇯🇵' },
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
>>>>>>> 8ad062d (Initial commit_4)

function Router() {
  const { screen } = useApp()
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
<<<<<<< HEAD
=======
    case 'grammar':   return <GrammarTrainer />
    case 'matching':  return <MatchingDrills />
>>>>>>> 8ad062d (Initial commit_4)
    default:          return <Setup />
  }
}

export default function App() {
  return (
    <AppProvider>
      <Router />
<<<<<<< HEAD
=======
      <FirstLaunchOverlay />
>>>>>>> 8ad062d (Initial commit_4)
    </AppProvider>
  )
}
