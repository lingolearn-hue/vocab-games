import { useState } from 'react'
import {
  CHALLENGE_TYPES, FLAVORS, typeLabel, flavorText, challengeKey,
  getState, changeTask, changeFlavor, acceptChallenge,
  cancelChallenge, finishChallenge, markTodayDone, toggleFavorite, pickTask,
} from '../engine/dailyChallenge'
import { getExamples } from '../engine/dailyChallengeExamples'
import './DailyChallenge.css'

const TABS = [
  { id: 'today',     label: 'Task of the day', icon: '☀️' },
  { id: 'open',      label: 'Open challenges',  icon: '📋' },
  { id: 'grid',      label: 'Browse all',       icon: '🗓️' },
  { id: 'favorites', label: 'Favorite tasks',   icon: '⭐' },
]

export default function DailyChallenge({ lang, onClose }) {
  const [tab, setTab] = useState('today')
  const [state, setState] = useState(() => getState(lang))
  const [spinning, setSpinning] = useState(null) // null | 'task' | 'flavor'

  const todayKey = challengeKey(state.todayType, state.todayFlavorId)
  const todayFlavor = flavorText(state.todayType, state.todayFlavorId)
  const todayExamples = getExamples(state.todayType, state.todayFlavorId, lang)
  const todayIsOpen = !!state.open[todayKey]
  const todayIsFavorite = !!state.favorites[todayKey]

  function handleChangeTask() {
    setSpinning('task')
    setTimeout(() => {
      setState(changeTask(lang))
      setSpinning(null)
    }, 550) // matches CSS orb-glow animation duration
  }

  function handleChangeFlavor() {
    setSpinning('flavor')
    setTimeout(() => {
      setState(changeFlavor(lang))
      setSpinning(null)
    }, 550)
  }

  function handleAcceptOrComplete() {
    if (!todayIsOpen) {
      setState(acceptChallenge(lang, state.todayType, state.todayFlavorId))
    } else {
      setState(markTodayDone(lang))
    }
  }

  function handleToggleFavorite(key) {
    setState(toggleFavorite(lang, key))
  }

  function handleCancelOpen(key) {
    setState(cancelChallenge(lang, key))
  }

  function handleFinishOpen(key) {
    setState(finishChallenge(lang, key))
  }

  const openList = Object.entries(state.open) // [key, {typeId, flavorId, acceptedAt}]
  const favoriteList = Object.keys(state.favorites)

  return (
    <div className="dc-screen" onClick={onClose}>
      <div className="dc-panel" onClick={e => e.stopPropagation()}>
        <button className="dc-close" onClick={onClose}>✕</button>
        <h1 className="dc-title">Daily Challenge</h1>
        <p className="dc-subtitle">Real-world practice — no phone, no checking, no pressure.</p>

        <div className="dc-body">
          <div className="dc-rail">
            {TABS.map(t => (
              <button
                key={t.id}
                className={`dc-rail-btn ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
                title={t.label}
                aria-label={t.label}
              >
                <span className="dc-rail-icon">{t.icon}</span>
                {tab === t.id && <span className="dc-rail-label">{t.label}</span>}
              </button>
            ))}
          </div>

          <div className="dc-content">
            {tab === 'today' && (
              <div className="dc-today">
                <div className="dc-today-type">{typeLabel(state.todayType)}</div>
                <div className={`dc-today-flavor ${spinning ? `dc-orb-active dc-orb-${spinning}` : ''}`}>
                  {spinning
                    ? <span className="dc-orb"><span className="dc-orb-glow" /></span>
                    : <span>{todayFlavor}</span>}
                </div>

                <div className="dc-examples-slot">
                  {!spinning && todayExamples.length > 0 && (
                    <div className="dc-examples">
                      {todayExamples.map((ex, i) => (
                        <div key={i} className="dc-example-line">{ex}</div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="dc-today-actions">
                  <button className="dc-btn dc-btn-ghost" onClick={handleChangeTask} disabled={!!spinning}>Change task</button>
                  <button className="dc-btn dc-btn-ghost" onClick={handleChangeFlavor} disabled={!!spinning}>
                    Change flavor
                  </button>
                </div>

                <div className="dc-today-main-actions">
                  <button
                    className={`dc-star ${todayIsFavorite ? 'on' : ''}`}
                    onClick={() => handleToggleFavorite(todayKey)}
                    title="Favorite this challenge"
                    aria-label="Favorite this challenge"
                  >★</button>
                  <button className="dc-btn dc-btn-primary" onClick={handleAcceptOrComplete}>
                    {todayIsOpen ? 'Task complete' : 'Accept challenge'}
                  </button>
                </div>

                <div className="dc-done-count-slot">
                  {state.counts[todayKey] > 0 && (
                    <div className="dc-done-count">Completed {state.counts[todayKey]}× before</div>
                  )}
                </div>
              </div>
            )}

            {tab === 'open' && (
              <div className="dc-list">
                {openList.length === 0 && <p className="dc-empty">No open challenges. Accept today's task to add one.</p>}
                {openList.map(([key, item]) => {
                  const isFav = !!state.favorites[key]
                  return (
                    <div key={key} className="dc-list-row">
                      <button
                        className={`dc-star dc-star-inline ${isFav ? 'on' : ''}`}
                        onClick={() => handleToggleFavorite(key)}
                        title="Favorite this challenge"
                        aria-label="Favorite this challenge"
                      >★</button>
                      <div className="dc-list-row-text">
                        <div className="dc-list-row-type">{typeLabel(item.typeId)}</div>
                        <div className="dc-list-row-flavor">{flavorText(item.typeId, item.flavorId)}</div>
                        {getExamples(item.typeId, item.flavorId, lang).map((ex, i) => (
                          <div key={i} className="dc-example-line dc-example-line-small">{ex}</div>
                        ))}
                      </div>
                      <div className="dc-list-row-actions">
                        <button className="dc-btn dc-btn-small" onClick={() => handleFinishOpen(key)}>Finished</button>
                        <button className="dc-btn dc-btn-small dc-btn-ghost" onClick={() => handleCancelOpen(key)}>Cancel</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {tab === 'grid' && (
              <div className="dc-grid-wrap">
                <div className="dc-grid">
                  {CHALLENGE_TYPES.map(type => (
                    <div key={type.id} className="dc-grid-col">
                      <div className="dc-grid-col-header">{type.weekday}<br /><span>{type.label}</span></div>
                      {FLAVORS[type.id].map(flavor => {
                        const key = challengeKey(type.id, flavor.id)
                        const isFav = !!state.favorites[key]
                        const count = state.counts[key] || 0
                        return (
                          <div key={key} className={`dc-grid-cell ${isFav ? 'dc-grid-cell-fav' : ''}`}>
                            <button
                              className="dc-grid-cell-main"
                              onClick={() => { setState(pickTask(lang, type.id, flavor.id)); setTab('today') }}
                              title={flavor.text}
                            >
                              <span className="dc-grid-cell-text">{flavor.text}</span>
                              {count > 0 && <span className="dc-grid-cell-count">×{count}</span>}
                            </button>
                            <button
                              className={`dc-star dc-star-grid ${isFav ? 'on' : ''}`}
                              onClick={() => handleToggleFavorite(key)}
                              title="Favorite this challenge"
                              aria-label="Favorite this challenge"
                            >★</button>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'favorites' && (
              <div className="dc-list">
                {favoriteList.length === 0 && <p className="dc-empty">No favorites yet. Tap the star on a challenge to save it here.</p>}
                {favoriteList.map(key => {
                  const [typeId, flavorId] = key.split('::')
                  const count = state.counts[key] || 0
                  return (
                    <div key={key} className="dc-list-row">
                      <button
                        className="dc-star dc-star-inline on"
                        onClick={() => handleToggleFavorite(key)}
                        title="Unfavorite this challenge"
                        aria-label="Unfavorite this challenge"
                      >★</button>
                      <div className="dc-list-row-text">
                        <div className="dc-list-row-type">{typeLabel(typeId)}</div>
                        <div className="dc-list-row-flavor">{flavorText(typeId, flavorId)}</div>
                        {count > 0 && <div className="dc-done-count">Completed {count}×</div>}
                      </div>
                      <div className="dc-list-row-actions">
                        <button className="dc-btn dc-btn-small" onClick={() => { setState(pickTask(lang, typeId, flavorId)); setTab('today') }}>
                          Set as today
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
