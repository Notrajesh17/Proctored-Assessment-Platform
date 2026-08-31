const TOKEN_KEY = 'assess.token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem('assess.user', JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem('assess.user')
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem('assess.user') || 'null')
  } catch {
    return null
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { message: text }
  }

  if (!res.ok) {
    if (res.status === 401 && token) {
      clearSession()
      window.dispatchEvent(new Event('assess:session-expired'))
    }
    const msg = Array.isArray(data?.message)
      ? data.message.join(', ')
      : data?.message || `Request failed (${res.status})`
    const err = new Error(msg)
    err.status = res.status
    err.data = data
    throw err
  }
  return data
}
