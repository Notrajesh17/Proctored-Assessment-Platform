import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth-context'

export default function Login() {
  const { user, login } = useAuth()
  const [email, setEmail] = useState('admin@assess.local')
  const [password, setPassword] = useState('Password1!')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (user?.role === 'admin') return <Navigate to="/admin" replace />
  if (user?.role === 'candidate') return <Navigate to="/candidate" replace />

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <p className="eyebrow">Hall monitor</p>
        <h1>Sign in to take or run an assessment</h1>
        <form onSubmit={onSubmit}>
          <label>
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn primary" disabled={busy} type="submit">
            {busy ? 'Checking…' : 'Continue'}
          </button>
        </form>
        <div className="hint">
          <p>Seeded logins (password for all: <code>Password1!</code>)</p>
          <ul>
            <li>admin@assess.local — admin</li>
            <li>ravi@assess.local — candidate</li>
            <li>anika@assess.local — candidate</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
