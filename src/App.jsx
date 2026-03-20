import { useState, useEffect, useCallback, useRef } from 'react'
import { storageAPI } from './storage'
import './App.css'

const TEAMS_KEY = 'qa-hub/teams'

export default function App() {
  const [teams, setTeams] = useState([])
  const [storageReady, setStorageReady] = useState(false)
  const [toast, setToast] = useState(null)
  const skipRemoteToastRef = useRef(true)

  const showToast = useCallback((message, type) => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const r = await storageAPI.get(TEAMS_KEY)
      if (!cancelled && r?.value) {
        try {
          setTeams(JSON.parse(r.value))
        } catch {
          /* ignore bad snapshot */
        }
      }
      if (!cancelled) setStorageReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!storageReady) return
    const unsubscribe = storageAPI.subscribe(TEAMS_KEY, (r) => {
      if (r?.value) {
        let remote
        try {
          remote = JSON.parse(r.value)
        } catch {
          return
        }
        setTeams((prev) => {
          if (JSON.stringify(prev) !== JSON.stringify(remote)) {
            if (!skipRemoteToastRef.current) {
              showToast('Data updated by a teammate', 'info')
            }
            skipRemoteToastRef.current = false
            return remote
          }
          skipRemoteToastRef.current = false
          return prev
        })
      } else {
        skipRemoteToastRef.current = false
      }
    })
    return () => unsubscribe()
  }, [storageReady, showToast])

  async function persistTeams(next) {
    setTeams(next)
    await storageAPI.set(TEAMS_KEY, JSON.stringify(next))
  }

  function addTeam() {
    const name = window.prompt('Team name?')
    if (!name?.trim()) return
    void persistTeams([
      ...teams,
      { id: crypto.randomUUID(), name: name.trim() },
    ])
  }

  async function removeTeam(id) {
    await persistTeams(teams.filter((t) => t.id !== id))
  }

  return (
    <div className="qa-hub">
      <header className="qa-hub__header">
        <h1>QA Hub</h1>
        <p className="qa-hub__tagline">Test case management · shared teams</p>
      </header>

      {toast && (
        <div className={`qa-hub__toast qa-hub__toast--${toast.type}`} role="status">
          {toast.message}
        </div>
      )}

      <main className="qa-hub__main">
        <section className="qa-hub__panel" aria-labelledby="teams-heading">
          <h2 id="teams-heading">Teams</h2>
          <p className="qa-hub__hint">
            Synced in real time via Firebase. Add a team to share structure with
            teammates.
          </p>
          <ul className="qa-hub__list">
            {teams.length === 0 ? (
              <li className="qa-hub__empty">No teams yet.</li>
            ) : (
              teams.map((t) => (
                <li key={t.id} className="qa-hub__list-item">
                  <span>{t.name}</span>
                  <button
                    type="button"
                    className="qa-hub__btn qa-hub__btn--ghost"
                    onClick={() => void removeTeam(t.id)}
                  >
                    Remove
                  </button>
                </li>
              ))
            )}
          </ul>
          <button type="button" className="qa-hub__btn" onClick={addTeam}>
            Add team
          </button>
        </section>

        <section className="qa-hub__panel qa-hub__panel--muted" aria-labelledby="tc-heading">
          <h2 id="tc-heading">Test cases</h2>
          <p className="qa-hub__hint">
            Placeholder for suites, cases, and runs — extend this panel next.
          </p>
        </section>
      </main>
    </div>
  )
}
