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
    default:          return <Setup />
  }
}

export default function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  )
}
