import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'

function formatTime(seconds) {
  const safe = Math.max(0, seconds)
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

export default function Exam() {
  const { assignmentId } = useParams()
  const nav = useNavigate()
  const [attempt, setAttempt] = useState(null)
  const [answers, setAnswers] = useState({})
  const [remaining, setRemaining] = useState(0)
  const [saveState, setSaveState] = useState('saved')
  const [violationCount, setViolationCount] = useState(0)
  const [fullscreenNeeded, setFullscreenNeeded] = useState(false)
  const [error, setError] = useState('')
  const [proctorError, setProctorError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const saveTimer = useRef(null)
  const answersRef = useRef({})
  const attemptId = useRef(null)
  const finishing = useRef(false)
  const requestedVersion = useRef(0)
  const savedVersion = useRef(0)
  const inFlightSave = useRef(null)
  const awayEpisode = useRef(false)

  const goToResult = useCallback(
    (id = attemptId.current) => {
      if (id) nav(`/result/${id}`, { replace: true })
    },
    [nav],
  )

  const findExistingResult = useCallback(async () => {
    try {
      const rows = await api('/api/me/assignments')
      const row = rows.find((item) => item.id === assignmentId)
      if (row?.attempt?.id) {
        goToResult(row.attempt.id)
        return true
      }
    } catch {
      // Keep the original start error when lookup is unavailable.
    }
    return false
  }, [assignmentId, goToResult])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const data = await api(`/api/assignments/${assignmentId}/start`, { method: 'POST' })
        if (!active) return
        attemptId.current = data.id
        if (data.status !== 'in_progress') {
          goToResult(data.id)
          return
        }
        const mapped = {}
        for (const answer of data.answers || []) {
          mapped[answer.questionId] = {
            selectedOptionIds: answer.selectedOptionIds || [],
            textAnswer: answer.textAnswer || '',
          }
        }
        answersRef.current = mapped
        setAnswers(mapped)
        setAttempt(data)
        setRemaining(data.remainingSeconds)
        setViolationCount(data.violationCount || 0)
        const needsFullscreen = !!data.proctoring?.requireFullscreen
        setFullscreenNeeded(needsFullscreen && !document.fullscreenElement)
        if (needsFullscreen && !document.fullscreenElement) {
          document.documentElement.requestFullscreen?.().catch(() => setFullscreenNeeded(true))
        }
      } catch (err) {
        if (!active) return
        if (err.status === 409 && (await findExistingResult())) return
        setError(err.status === 409 ? 'This assessment has already been submitted.' : err.message)
      }
    })()
    return () => {
      active = false
      clearTimeout(saveTimer.current)
    }
  }, [assignmentId, findExistingResult, goToResult])

  useEffect(() => {
    if (!attempt) return undefined
    const tick = window.setInterval(() => {
      setRemaining((current) => Math.max(0, current - 1))
    }, 1000)
    const sync = window.setInterval(async () => {
      if (!attemptId.current || finishing.current) return
      try {
        const fresh = await api(`/api/attempts/${attemptId.current}`)
        setRemaining(fresh.remainingSeconds)
        setViolationCount(fresh.violationCount || 0)
        if (fresh.status !== 'in_progress') goToResult(fresh.id)
      } catch (err) {
        if (err.status === 409) goToResult()
      }
    }, 20000)
    return () => {
      clearInterval(tick)
      clearInterval(sync)
    }
  }, [attempt, goToResult])

  const saveOnce = useCallback(async () => {
    if (!attemptId.current || savedVersion.current >= requestedVersion.current) return
    if (inFlightSave.current) return inFlightSave.current

    const version = requestedVersion.current
    const payload = Object.entries(answersRef.current).map(([questionId, value]) => ({
      questionId,
      selectedOptionIds: value.selectedOptionIds || [],
      textAnswer: value.textAnswer || '',
    }))
    setSaveState('saving')
    const request = api(`/api/attempts/${attemptId.current}/answers`, {
      method: 'PATCH',
      body: { answers: payload },
    })
      .then((result) => {
        savedVersion.current = Math.max(savedVersion.current, version)
        if (typeof result?.remainingSeconds === 'number') setRemaining(result.remainingSeconds)
        setSaveState(savedVersion.current < requestedVersion.current ? 'dirty' : 'saved')
      })
      .catch((err) => {
        setSaveState('error')
        if (err.status === 409) goToResult()
        throw err
      })
      .finally(() => {
        inFlightSave.current = null
      })
    inFlightSave.current = request
    return request
  }, [goToResult])

  const flushSaves = useCallback(async () => {
    clearTimeout(saveTimer.current)
    while (savedVersion.current < requestedVersion.current) {
      if (inFlightSave.current) await inFlightSave.current
      else await saveOnce()
    }
  }, [saveOnce])

  function queueSave(next) {
    answersRef.current = next
    setAnswers(next)
    requestedVersion.current += 1
    setSaveState('dirty')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      flushSaves().catch((err) => setError(`Answers could not be saved: ${err.message}`))
    }, 1200)
  }

  useEffect(() => {
    function warnOnUnload(event) {
      if (savedVersion.current >= requestedVersion.current || finishing.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnOnUnload)
    return () => window.removeEventListener('beforeunload', warnOnUnload)
  }, [])

  useEffect(() => {
    if (!attempt?.proctoring?.enabled) return undefined
    const id = attempt.id

    async function send(type, meta = {}) {
      if (finishing.current) return
      setProctorError('')
      try {
        await flushSaves()
      } catch (err) {
        setError(`Answers could not be saved before recording the event: ${err.message}`)
        if (err.status === 409) {
          goToResult(id)
        }
        return
      }
      try {
        const result = await api(`/api/attempts/${id}/events`, {
          method: 'POST',
          body: { type, meta },
        })
        if (typeof result.violationCount === 'number') setViolationCount(result.violationCount)
        if (typeof result.remainingSeconds === 'number') setRemaining(result.remainingSeconds)
        if (result.autoSubmitted || result.recorded === false) goToResult(id)
      } catch (err) {
        setProctorError(`A proctoring event could not be recorded: ${err.message}`)
        if (err.status === 409) goToResult(id)
      }
    }

    function onVisibility() {
      if (document.hidden) {
        if (!awayEpisode.current) send('tab_switch')
        awayEpisode.current = true
      } else if (document.hasFocus()) {
        awayEpisode.current = false
      }
    }
    function onBlur() {
      if (!awayEpisode.current) send('window_blur')
      awayEpisode.current = true
    }
    function onFocus() {
      if (!document.hidden) awayEpisode.current = false
    }
    function onFullscreen() {
      const needed = !!attempt.proctoring?.requireFullscreen && !document.fullscreenElement
      setFullscreenNeeded(needed)
      if (needed && !finishing.current) send('fullscreen_exit')
    }
    function blockAndSend(type) {
      return (event) => {
        event.preventDefault()
        send(type)
      }
    }
    const onCopy = blockAndSend('copy')
    const onPaste = blockAndSend('paste')
    const onContext = blockAndSend('right_click')

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    document.addEventListener('fullscreenchange', onFullscreen)
    document.addEventListener('copy', onCopy)
    document.addEventListener('paste', onPaste)
    document.addEventListener('contextmenu', onContext)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('fullscreenchange', onFullscreen)
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('paste', onPaste)
      document.removeEventListener('contextmenu', onContext)
    }
  }, [attempt, flushSaves, goToResult])

  async function enterFullscreen() {
    setProctorError('')
    try {
      await document.documentElement.requestFullscreen()
      setFullscreenNeeded(false)
    } catch {
      setFullscreenNeeded(true)
      setProctorError('Fullscreen was not enabled. Allow fullscreen in your browser and try again.')
    }
  }

  const finish = useCallback(async (manual = true) => {
    if (finishing.current || !attemptId.current) return
    if (manual && !window.confirm('Submit your assessment now? You cannot change answers afterward.')) return
    finishing.current = true
    setSubmitting(true)
    setError('')
    try {
      await flushSaves()
      await api(`/api/attempts/${attemptId.current}/submit`, { method: 'POST' })
      if (document.fullscreenElement) await document.exitFullscreen?.().catch(() => {})
      goToResult()
    } catch (err) {
      if (err.status === 409) {
        goToResult()
        return
      }
      finishing.current = false
      setSubmitting(false)
      setError(`Submission failed: ${err.message}. Your saved answers are still available; please retry.`)
    }
  }, [flushSaves, goToResult])

  useEffect(() => {
    if (attempt && remaining === 0 && !finishing.current) finish(false)
  }, [remaining, attempt, finish])

  function setChoice(questionId, optionId, multiple) {
    const current = answersRef.current[questionId] || { selectedOptionIds: [], textAnswer: '' }
    let selectedOptionIds
    if (multiple) {
      const selected = new Set(current.selectedOptionIds)
      if (selected.has(optionId)) selected.delete(optionId)
      else selected.add(optionId)
      selectedOptionIds = [...selected]
    } else {
      selectedOptionIds = [optionId]
    }
    queueSave({
      ...answersRef.current,
      [questionId]: { ...current, selectedOptionIds },
    })
  }

  if (error && !attempt) {
    return <div className="shell"><p className="error" role="alert">{error}</p></div>
  }
  if (!attempt) return <div className="shell">Starting assessment…</div>

  const maxViolations = attempt.proctoring?.maxViolations || 0
  const saveLabel = {
    saved: 'All answers saved',
    saving: 'Saving answers…',
    dirty: 'Changes waiting to save',
    error: 'Save failed — retrying on next change',
  }[saveState]

  return (
    <div className="exam">
      <header className="exam-bar">
        <div className="exam-title">
          <p className="eyebrow">In progress</p>
          <strong>{attempt.title}</strong>
        </div>
        <div className="timer-block" aria-live="polite">
          <span className={remaining < 60 ? 'timer danger' : 'timer'}>{formatTime(remaining)}</span>
          <span className={`save-pill ${saveState}`}>{saveLabel}</span>
          {attempt.proctoring?.enabled && (
            <span className="violation-pill">
              Violations: {violationCount}{maxViolations > 0 ? ` / ${maxViolations}` : ''}
            </span>
          )}
        </div>
        <button className="btn primary" onClick={() => finish(true)} disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit'}
        </button>
      </header>

      <main className="exam-content">
        {fullscreenNeeded && (
          <div className="fullscreen-notice" role="alert">
            <span>This assessment requires fullscreen. Stay in fullscreen until you submit.</span>
            <button className="btn primary" type="button" onClick={enterFullscreen}>Enter fullscreen</button>
          </div>
        )}
        {error && <p className="error panel" role="alert">{error}</p>}
        {proctorError && <p className="error panel" role="status">{proctorError}</p>}
        {attempt.description && <p className="exam-description">{attempt.description}</p>}

        <ol className="exam-qs">
          {attempt.questions.map((question, index) => {
            const answer = answers[question.id] || { selectedOptionIds: [], textAnswer: '' }
            return (
              <li key={question.id} className="panel">
                <p>
                  <strong>{index + 1}. {question.prompt}</strong>
                  <span className="muted"> · {question.points} pts</span>
                </p>
                {question.type === 'short_answer' ? (
                  <textarea
                    value={answer.textAnswer}
                    onChange={(event) => queueSave({
                      ...answersRef.current,
                      [question.id]: { ...answer, textAnswer: event.target.value },
                    })}
                  />
                ) : (
                  <div className="options">
                    {question.options.map((option) => (
                      <label key={option.id} className="check answer-option">
                        <input
                          type={question.type === 'single_choice' ? 'radio' : 'checkbox'}
                          name={question.id}
                          checked={answer.selectedOptionIds.includes(option.id)}
                          onChange={() => setChoice(question.id, option.id, question.type === 'multiple_choice')}
                        />
                        <span>{option.text}</span>
                      </label>
                    ))}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      </main>
    </div>
  )
}
