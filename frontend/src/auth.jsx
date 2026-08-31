import { useEffect, useMemo, useState } from 'react'
import { api, clearSession, getUser, setSession } from './api'
import { AuthCtx } from './auth-context'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getUser())

  useEffect(() => {
    const expire = () => setUser(null)
    window.addEventListener('assess:session-expired', expire)
    return () => window.removeEventListener('assess:session-expired', expire)
  }, [])

  const value = useMemo(
    () => ({
      user,
      async login(email, password) {
        const data = await api('/api/auth/login', {
          method: 'POST',
          body: { email, password },
        })
        setSession(data.accessToken, data.user)
        setUser(data.user)
        return data.user
      },
      logout() {
        clearSession()
        setUser(null)
      },
    }),
    [user],
  )

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}
