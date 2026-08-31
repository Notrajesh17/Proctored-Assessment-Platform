import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'

export default function SubmissionDetail() {
  const { id } = useParams()
  const [attempt, setAttempt] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([api(`/api/attempts/${id}`), api(`/api/attempts/${id}/events`)])
      .then(([nextAttempt, nextEvents]) => {
        if (!active) return
        setAttempt(nextAttempt)
        setEvents(nextEvents)
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [id])

  if (loading) return <div className="shell">Loading submission…</div>
  if (error || !attempt) {
    return (
      <div className="shell">
        <p className="error" role="alert">{error || 'Submission could not be loaded.'}</p>
        <Link to="/admin">← Assessments</Link>
      </div>
    )
  }

  const byQ = Object.fromEntries(
    (attempt.answers || []).map((a) => [a.questionId, a]),
  )

  return (
    <div className="shell">
      <p>
        <Link to={`/admin/papers/${attempt.assessmentId}/submissions`}>
          ← Submissions
        </Link>
      </p>
      <h1>{attempt.title}</h1>
      <p className="muted">
        {attempt.status} · score {attempt.score ?? 0} / {attempt.maxObjectiveScore ?? 0} ·{' '}
        {attempt.violationCount ?? 0} violations
      </p>
      <p className="muted">
        Started {new Date(attempt.startedAt).toLocaleString()}
        {attempt.submittedAt ? ` · Finished ${new Date(attempt.submittedAt).toLocaleString()}` : ''}
      </p>

      {(attempt.questions || []).map((q, i) => {
        const ans = byQ[q.id]
        return (
          <div className="panel" key={q.id}>
            <strong>
              {i + 1}. {q.prompt}
            </strong>
            <p className="muted">{q.type} · {q.points} pts</p>
            {q.type === 'short_answer' ? (
              <p>{ans?.textAnswer || <em>no answer</em>}</p>
            ) : (
              <ul>
                {(q.options || []).map((o) => (
                  <li key={o.id}>
                    {o.text}
                    {ans?.selectedOptionIds?.includes(o.id) ? ' ← selected' : ''}
                    {q.correctOptionIds?.includes(o.id) ? ' (correct)' : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}

      <section className="panel">
        <h2>Proctoring timeline</h2>
        {events.length === 0 && <p className="muted">No events recorded.</p>}
        <ol className="timeline">
          {events.map((ev) => (
            <li key={ev._id}>
              <code>{ev.type}</code>{' '}
              <span className="muted">
                {new Date(ev.occurredAt).toLocaleString()}
              </span>
              {ev.meta && Object.keys(ev.meta).length > 0 && (
                <div className="muted event-meta">{JSON.stringify(ev.meta)}</div>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
