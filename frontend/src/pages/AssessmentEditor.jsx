import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'

function blankQuestion() {
  return {
    type: 'single_choice',
    prompt: '',
    points: 1,
    options: [
      { id: 'a', text: '' },
      { id: 'b', text: '' },
    ],
    correctOptionIds: ['a'],
  }
}

function questionBody(question) {
  const body = {
    type: question.type,
    prompt: question.prompt.trim(),
    points: Number(question.points),
  }
  if (body.prompt.length < 3) throw new Error('Write a question prompt (at least 3 characters).')
  if (body.type === 'short_answer') {
    return { ...body, options: [], correctOptionIds: [] }
  }
  const options = question.options
    .map((option) => ({ ...option, text: option.text.trim() }))
    .filter((option) => option.text)
  if (options.length < 2) throw new Error('Fill in at least two answer options.')
  const correctOptionIds = question.correctOptionIds.filter((optionId) =>
    options.some((option) => option.id === optionId),
  )
  if (!correctOptionIds.length) throw new Error('Mark at least one correct option.')
  if (body.type === 'single_choice' && correctOptionIds.length !== 1) {
    throw new Error('Single-choice questions need exactly one correct option.')
  }
  return { ...body, options, correctOptionIds }
}

function QuestionFields({ value, onChange }) {
  function updateOption(index, text) {
    const options = [...value.options]
    options[index] = { ...options[index], text }
    onChange({ ...value, options })
  }

  function setCorrect(optionId, checked) {
    if (value.type === 'single_choice') {
      onChange({ ...value, correctOptionIds: [optionId] })
      return
    }
    const selected = new Set(value.correctOptionIds)
    if (checked) selected.add(optionId)
    else selected.delete(optionId)
    onChange({ ...value, correctOptionIds: [...selected] })
  }

  return (
    <>
      <label>
        Type
        <select
          value={value.type}
          onChange={(event) => {
            const type = event.target.value
            onChange({
              ...value,
              type,
              correctOptionIds:
                type === 'short_answer'
                  ? []
                  : value.correctOptionIds.length
                    ? value.correctOptionIds
                    : [value.options[0]?.id],
            })
          }}
        >
          <option value="single_choice">Single choice</option>
          <option value="multiple_choice">Multiple choice</option>
          <option value="short_answer">Short answer</option>
        </select>
      </label>
      <label>
        Prompt
        <textarea
          required
          value={value.prompt}
          onChange={(event) => onChange({ ...value, prompt: event.target.value })}
        />
      </label>
      <label>
        Points
        <input
          type="number"
          min="0"
          required
          value={value.points}
          onChange={(event) => onChange({ ...value, points: event.target.value })}
        />
      </label>
      {value.type !== 'short_answer' && (
        <div className="option-editor">
          {value.options.map((option, index) => (
            <div className="opt-row" key={option.id}>
              <input
                required
                aria-label={`Option ${option.id}`}
                placeholder={`Option ${option.id}`}
                value={option.text}
                onChange={(event) => updateOption(index, event.target.value)}
              />
              <label className="check">
                <input
                  type={value.type === 'single_choice' ? 'radio' : 'checkbox'}
                  name={`correct-${value._id || 'new'}`}
                  checked={value.correctOptionIds.includes(option.id)}
                  onChange={(event) => setCorrect(option.id, event.target.checked)}
                />
                Correct
              </label>
            </div>
          ))}
          <button
            type="button"
            className="btn"
            onClick={() => {
              const id = String.fromCharCode(97 + value.options.length)
              onChange({ ...value, options: [...value.options, { id, text: '' }] })
            }}
          >
            Add option
          </button>
        </div>
      )}
    </>
  )
}

export default function AssessmentEditor() {
  const { id } = useParams()
  const nav = useNavigate()
  const [paper, setPaper] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [picked, setPicked] = useState([])
  const [draft, setDraft] = useState(blankQuestion)
  const [editing, setEditing] = useState(null)
  const [candidateDraft, setCandidateDraft] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  async function load() {
    const [nextPaper, users] = await Promise.all([
      api(`/api/assessments/${id}`),
      api('/api/users?role=candidate'),
    ])
    setPaper(nextPaper)
    setCandidates(users)
    return users
  }

  useEffect(() => {
    let active = true
    Promise.all([api(`/api/assessments/${id}`), api('/api/users?role=candidate')])
      .then(([nextPaper, users]) => {
        if (!active) return
        setPaper(nextPaper)
        setCandidates(users)
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [id])

  useEffect(() => {
    if (!msg) return undefined
    const timer = window.setTimeout(() => setMsg(''), 2000)
    return () => window.clearTimeout(timer)
  }, [msg])

  function startAction(name) {
    setBusy(name)
    setError('')
    setMsg('')
  }

  function patchPaper(extra = {}) {
    return api(`/api/assessments/${id}`, {
      method: 'PATCH',
      body: {
        title: paper.title,
        description: paper.description || '',
        durationMinutes: Number(paper.durationMinutes),
        status: paper.status,
        negativeMarking: paper.negativeMarking,
        proctoring: {
          enabled: !!paper.proctoring?.enabled,
          requireFullscreen: !!paper.proctoring?.requireFullscreen,
          maxViolations: Number(paper.proctoring?.maxViolations || 0),
        },
        ...extra,
      },
    })
  }

  async function saveMeta(event) {
    event.preventDefault()
    startAction('settings')
    try {
      const updated = await patchPaper()
      setPaper((current) => ({
        ...current,
        ...updated,
        questions: current.questions,
        locked: current.locked,
      }))
      setMsg('Assessment settings saved.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  async function publishPaper() {
    if (!paper.questions?.length) {
      setError('Add at least one question before publishing.')
      return
    }
    startAction('publish')
    try {
      await patchPaper({ status: 'published' })
      setMsg('Assessment published. It is ready to assign.')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  async function addQuestion(event) {
    event.preventDefault()
    startAction('add-question')
    try {
      const created = await api(`/api/assessments/${id}/questions`, {
        method: 'POST',
        body: questionBody(draft),
      })
      setPaper((current) => ({
        ...current,
        questions: [...(current.questions || []), created],
      }))
      setDraft(blankQuestion())
      setMsg('Question added.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  async function saveQuestion(event) {
    event.preventDefault()
    startAction(`question-${editing._id}`)
    try {
      await api(`/api/questions/${editing._id}`, {
        method: 'PATCH',
        body: questionBody(editing),
      })
      setEditing(null)
      setMsg('Question updated.')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  async function removeQuestion(question) {
    if (!window.confirm(`Delete “${question.prompt}”? This cannot be undone.`)) return
    startAction(`delete-${question._id}`)
    try {
      await api(`/api/questions/${question._id}`, { method: 'DELETE' })
      if (editing?._id === question._id) setEditing(null)
      setMsg('Question deleted.')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  async function removePaper() {
    if (!window.confirm(`Delete “${paper.title}” and its related data? This cannot be undone.`)) return
    startAction('delete-paper')
    try {
      await api(`/api/assessments/${id}`, { method: 'DELETE' })
      nav('/admin')
    } catch (err) {
      setError(err.message)
      setBusy('')
    }
  }

  async function createCandidate(event) {
    event.preventDefault()
    startAction('candidate')
    try {
      const created = await api('/api/users', { method: 'POST', body: candidateDraft })
      setCandidateDraft({ name: '', email: '', password: '' })
      const users = await load()
      const createdUser = users.find((candidate) => candidate.email === created.email)
      if (createdUser) {
        setPicked((current) =>
          current.includes(createdUser._id) ? current : [...current, createdUser._id],
        )
      }
      setMsg(
        `Candidate ${created.name} created${createdUser ? ' and selected' : ''}.`,
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  async function assign() {
    if (!picked.length) {
      setError('Select at least one candidate.')
      return
    }
    startAction('assign')
    try {
      const result = await api(`/api/assessments/${id}/assign`, {
        method: 'POST',
        body: { candidateIds: picked },
      })
      const skipped = picked.length - result.assigned
      setMsg(
        `Assigned ${result.assigned} candidate${result.assigned === 1 ? '' : 's'}.${
          skipped ? ` ${skipped} already assigned and skipped.` : ''
        }`,
      )
      setPicked([])
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  if (loading) return <div className="shell">Loading assessment…</div>
  if (!paper) {
    return (
      <div className="shell">
        <p className="error">{error || 'Assessment could not be loaded.'}</p>
        <Link to="/admin">← All assessments</Link>
      </div>
    )
  }
  const locked = !!(paper.lockedAt || paper.locked)

  return (
    <div className="shell editor">
      <p><Link to="/admin">← All assessments</Link></p>
      <div className="row-between">
        <h1>{paper.title}</h1>
        <Link className="btn" to={`/admin/papers/${id}/submissions`}>Submissions</Link>
      </div>
      {msg && <div className="toast-notice" role="status" aria-live="polite">{msg}</div>}
      {error && <p className="error" role="alert">{error}</p>}
      {locked && (
        <p className="notice">
          This assessment has been assigned. Timer, scoring, proctoring, status, and
          questions are locked to keep every candidate&apos;s assessment consistent.
        </p>
      )}
      <ol className="muted steps">
        <li>Configure and save the assessment.</li>
        <li>Add or edit questions, then publish.</li>
        <li>Create or select candidates and assign them.</li>
      </ol>

      <form className="panel" onSubmit={saveMeta}>
        <h2>Assessment settings</h2>
        <label>
          Title
          <input required minLength="3" value={paper.title} onChange={(event) => setPaper({ ...paper, title: event.target.value })} />
        </label>
        <label>
          Description
          <textarea value={paper.description || ''} onChange={(event) => setPaper({ ...paper, description: event.target.value })} />
        </label>
        <div className="grid-2">
          <label>
            Duration (minutes)
            <input disabled={locked} type="number" min="1" required value={paper.durationMinutes} onChange={(event) => setPaper({ ...paper, durationMinutes: event.target.value })} />
          </label>
          <label>
            Status
            <select disabled={locked} value={paper.status} onChange={(event) => setPaper({ ...paper, status: event.target.value })}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>
        </div>
        <label className="check">
          <input disabled={locked} type="checkbox" checked={!!paper.negativeMarking?.enabled} onChange={(event) => setPaper({ ...paper, negativeMarking: { ...paper.negativeMarking, enabled: event.target.checked } })} />
          Enable negative marking
        </label>
        {paper.negativeMarking?.enabled && (
          <label>
            Penalty per wrong objective answer
            <input disabled={locked} type="number" min="0" step="0.1" value={paper.negativeMarking.penalty ?? 0} onChange={(event) => setPaper({ ...paper, negativeMarking: { ...paper.negativeMarking, penalty: Number(event.target.value) } })} />
          </label>
        )}
        <fieldset>
          <legend>Proctoring</legend>
          <label className="check">
            <input disabled={locked} type="checkbox" checked={!!paper.proctoring?.enabled} onChange={(event) => setPaper({ ...paper, proctoring: { ...paper.proctoring, enabled: event.target.checked } })} />
            Capture proctoring events
          </label>
          <label className="check">
            <input disabled={locked} type="checkbox" checked={!!paper.proctoring?.requireFullscreen} onChange={(event) => setPaper({ ...paper, proctoring: { ...paper.proctoring, requireFullscreen: event.target.checked } })} />
            Require fullscreen
          </label>
          <label>
            Auto-submit after violations (0 = never)
            <input disabled={locked} type="number" min="0" value={paper.proctoring?.maxViolations ?? 0} onChange={(event) => setPaper({ ...paper, proctoring: { ...paper.proctoring, maxViolations: Number(event.target.value) } })} />
          </label>
        </fieldset>
        <div className="row actions">
          <button className="btn primary" type="submit" disabled={!!busy}>{busy === 'settings' ? 'Saving…' : 'Save settings'}</button>
          <button className="btn" type="button" onClick={publishPaper} disabled={!!busy || locked || paper.status === 'published'}>Publish</button>
          <button className="btn danger" type="button" onClick={removePaper} disabled={!!busy}>Delete assessment</button>
        </div>
        <p className="muted">After candidates are assigned, the backend may lock timer, scoring, proctoring, and question changes. Any lock reason appears above.</p>
      </form>

      <section className="panel">
        <h2>Questions ({paper.questions?.length || 0})</h2>
        {(paper.questions || []).map((question, index) => (
          <div className="question-block" key={question._id}>
            {editing?._id === question._id ? (
              <form onSubmit={saveQuestion}>
                <h3>Edit question {index + 1}</h3>
                <QuestionFields value={editing} onChange={setEditing} />
                <div className="row actions">
                  <button className="btn primary" disabled={!!busy}>{busy ? 'Saving…' : 'Save question'}</button>
                  <button className="btn" type="button" onClick={() => setEditing(null)} disabled={!!busy}>Cancel</button>
                </div>
              </form>
            ) : (
              <div className="q-row">
                <div>
                  <strong>{index + 1}. [{question.type}] {question.prompt}</strong>
                  <p className="muted">{question.points} pts</p>
                </div>
                <div className="row actions">
                  <button disabled={locked} className="btn" type="button" onClick={() => setEditing({ ...question, options: question.options || [], correctOptionIds: question.correctOptionIds || [] })}>Edit</button>
                  <button className="btn danger" type="button" disabled={locked || busy === `delete-${question._id}`} onClick={() => removeQuestion(question)}>Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {!paper.questions?.length && <p className="muted">No questions yet.</p>}

        {!locked && <form className="nested" onSubmit={addQuestion}>
          <h3>Add question</h3>
          <QuestionFields value={draft} onChange={setDraft} />
          <button className="btn primary" disabled={!!busy}>{busy === 'add-question' ? 'Adding…' : 'Add question'}</button>
        </form>}
      </section>

      <section className="panel">
        <h2>Candidates</h2>
        <form className="candidate-form grid-3" onSubmit={createCandidate}>
          <label>Name<input required minLength="2" value={candidateDraft.name} onChange={(event) => setCandidateDraft({ ...candidateDraft, name: event.target.value })} /></label>
          <label>Email<input required type="email" value={candidateDraft.email} onChange={(event) => setCandidateDraft({ ...candidateDraft, email: event.target.value })} /></label>
          <label>Temporary password<input required type="password" minLength="6" value={candidateDraft.password} onChange={(event) => setCandidateDraft({ ...candidateDraft, password: event.target.value })} /></label>
          <button className="btn" disabled={!!busy}>{busy === 'candidate' ? 'Creating…' : 'Create candidate'}</button>
        </form>
        <hr />
        <p className="muted">Select candidates to assign. The assessment must be published and contain a question.</p>
        <div className="candidate-list">
          {candidates.map((candidate) => (
            <label key={candidate._id} className="check candidate-row">
              <input type="checkbox" checked={picked.includes(candidate._id)} onChange={(event) => setPicked((current) => event.target.checked ? [...current, candidate._id] : current.filter((candidateId) => candidateId !== candidate._id))} />
              <span>{candidate.name} — {candidate.email}</span>
            </label>
          ))}
          {!candidates.length && <p className="muted">No candidates yet. Create one above.</p>}
        </div>
        <div className="row actions">
          <button className="btn primary" type="button" onClick={assign} disabled={!!busy || !picked.length}>{busy === 'assign' ? 'Assigning…' : `Assign selected${picked.length ? ` (${picked.length})` : ''}`}</button>
          {picked.length > 0 && <button className="btn ghost" type="button" onClick={() => setPicked([])}>Clear selection</button>}
        </div>
      </section>
    </div>
  )
}
