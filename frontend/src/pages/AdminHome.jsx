import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth-context'

export default function AdminHome() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const [papers, setPapers] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      setPapers(await api('/api/assessments'))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    api('/api/assessments')
      .then((data) => active && setPapers(data))
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  async function createPaper() {
    setCreating(true)
    setError('')
    try {
      const created = await api('/api/assessments', {
        method: 'POST',
        body: {
          title: 'Untitled paper',
          description: '',
          durationMinutes: 20,
          negativeMarking: { enabled: false, penalty: 1 },
          proctoring: { enabled: true, maxViolations: 5, requireFullscreen: true },
        },
      })
      nav(`/admin/papers/${created._id}`)
    } catch (e) {
      setError(e.message)
      setCreating(false)
    }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Admin</p>
          <strong>{user.name}</strong>
        </div>
        <button className="btn ghost" onClick={logout}>
          Log out
        </button>
      </header>

      <div className="row-between">
        <h1>Assessments</h1>
        <button className="btn primary" onClick={createPaper} disabled={creating}>
          {creating ? 'Creating…' : 'New paper'}
        </button>
      </div>
      {error && (
        <div className="error" role="alert">
          <p>{error}</p>
          <button className="btn" type="button" onClick={load}>Retry</button>
        </div>
      )}
      <div className="card-list">
        {loading && <p className="muted">Loading assessments…</p>}
        {!loading && !error && papers.length === 0 && <p className="muted">Nothing yet. Create a paper.</p>}
        {papers.map((p) => (
          <Link className="paper-card" key={p._id} to={`/admin/papers/${p._id}`}>
            <div>
              <h2>{p.title}</h2>
              <p className="muted">
                {p.durationMinutes} min · {p.status}
                {p.negativeMarking?.enabled ? ' · negative marking' : ''}
              </p>
            </div>
            <span className="chip">{p.status}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
