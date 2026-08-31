import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'

export default function ExamResult() {
  const { id } = useParams()
  const [attempt, setAttempt] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api(`/api/attempts/${id}`)
      .then((data) => active && setAttempt(data))
      .catch((err) => active && setError(err.message))
    return () => {
      active = false
    }
  }, [id])

  if (error) {
    return (
      <div className="shell">
        <p className="error" role="alert">{error}</p>
        <Link to="/candidate">← My assessments</Link>
      </div>
    )
  }
  if (!attempt) return <div className="shell">Loading…</div>

  return (
    <div className="shell">
      <p>
        <Link to="/candidate">← My assessments</Link>
      </p>
      <h1>Submitted</h1>
      <p>
        Status: <strong>{attempt.status}</strong>
      </p>
      <p className="score-big">
        {attempt.score ?? 0} / {attempt.maxObjectiveScore ?? 0}
      </p>
      <p className="muted">
        Objective questions only. Short answers are stored for the admin to
        read; they are not auto-scored. Violations logged: {attempt.violationCount}.
      </p>
    </div>
  )
}
