import { useState, useEffect, useCallback, useRef } from 'react'
import { storageAPI } from './storage'

const STORAGE_KEY = 'qa-hub/teams'

export function TeamsBoard() {
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
      const r = await storageAPI.get(STORAGE_KEY)
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
    const unsubscribe = storageAPI.subscribe(STORAGE_KEY, (r) => {
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
    await storageAPI.set(STORAGE_KEY, JSON.stringify(next))
  }

  function addTeam() {
    const name = window.prompt('Team name?')
    if (!name?.trim()) return
    void persistTeams([...teams, { id: crypto.randomUUID(), name: name.trim() }])
  }

  return (
    <section className="teams-board">
      {toast && (
        <div className={`toast toast-${toast.type}`} role="status">
          {toast.message}
        </div>
      )}
      <h2>Teams</h2>
      <ul>
        {teams.map((t) => (
          <li key={t.id}>{t.name}</li>
        ))}
      </ul>
      <button type="button" onClick={addTeam}>
        Add team
      </button>
    </section>
  )
}
