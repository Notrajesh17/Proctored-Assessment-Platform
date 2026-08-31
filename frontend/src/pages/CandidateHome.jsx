import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth-context'

export default function CandidateHome() {
  const { user, logout } = useAuth()
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  function load() {
    setLoading(true)
    setError('')
    api('/api/me/assignments')
      .then(setRows)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let active = true
    api('/api/me/assignments')
      .then((data) => active && setRows(data))
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Candidate</p>
          <strong>{user.name}</strong>
        </div>
        <button className="btn ghost" onClick={logout}>
          Log out
        </button>
      </header>
      <h1>Assigned assessments</h1>
      {loading && <p className="muted">Loading assignments…</p>}
      {error && (
        <div className="error" role="alert">
          <p>{error}</p>
          <button className="btn" type="button" onClick={load}>Retry</button>
        </div>
      )}
      <div className="card-list">
        {!loading && !error && rows.length === 0 && (
          <p className="muted">Nothing assigned to you yet.</p>
        )}
        {rows.map((r) => (
          <div className="paper-card" key={r.id}>
            <div>
              <h2>{r.title}</h2>
              {r.description && <p className="paper-description">{r.description}</p>}
              <p className="muted">
                {r.durationMinutes} minutes
                {r.attempt ? ` · ${r.attempt.status}` : ''}
                {r.assignedAt ? ` · assigned ${new Date(r.assignedAt).toLocaleDateString()}` : ''}
              </p>
            </div>
            {r.attempt?.status === 'in_progress' && (
              <Link className="btn primary" to={`/exam/${r.id}`}>
                Resume
              </Link>
            )}
            {!r.attempt && (
              <Link className="btn primary" to={`/exam/${r.id}`}>
                Start
              </Link>
            )}
            {r.attempt && r.attempt.status !== 'in_progress' && (
              <Link className="btn" to={`/result/${r.attempt.id}`}>
                Score {r.attempt.score}/{r.attempt.maxObjectiveScore}
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
