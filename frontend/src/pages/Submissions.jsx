import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'

export default function Submissions() {
  const { id } = useParams()
  const [rows, setRows] = useState([])
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      api(`/api/assessments/${id}`),
      api(`/api/assessments/${id}/submissions`),
    ])
      .then(([paper, submissions]) => {
        if (!active) return
        setTitle(paper.title)
        setRows(submissions)
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [id])

  return (
    <div className="shell">
      <p>
        <Link to={`/admin/papers/${id}`}>← {title || 'Paper'}</Link>
      </p>
      <h1>Submissions</h1>
      {loading && <p className="muted">Loading submissions…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {!loading && !error && <div className="table-wrap"><table className="table">
        <thead>
          <tr>
            <th>Candidate</th>
            <th>Status</th>
            <th>Score</th>
            <th>Violations</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r._id}>
              <td>
                {r.candidateId?.name}
                <div className="muted">{r.candidateId?.email}</div>
              </td>
              <td>{r.status}</td>
              <td>
                {r.status === 'in_progress'
                  ? '—'
                  : `${r.score ?? 0} / ${r.maxObjectiveScore ?? 0}`}
              </td>
              <td>{r.violationCount ?? 0}</td>
              <td>
                <Link to={`/admin/attempts/${r._id}`}>Review</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>}
      {!loading && !error && rows.length === 0 && <p className="muted">No attempts yet.</p>}
    </div>
  )
}
