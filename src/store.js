// Shared state for proposed actions. Read/written both by the WebMCP tool
// handlers (imperative, outside the React tree) and by the React UI —
// this is a plain observable store rather than React state so both sides
// can touch the same data.

const STORAGE_KEY = 'agentgate:proposals'

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function save(proposals) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(proposals))
  } catch {
    // localStorage unavailable (private mode, quota, etc.) — state just
    // won't persist across reloads, the app still works for the session.
  }
}

let proposals = load()
const listeners = new Set()

function notify() {
  for (const fn of listeners) fn(proposals)
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function getState() {
  return proposals
}

function proposeAction({ description, kind, payload }) {
  const entry = {
    id: crypto.randomUUID(),
    description,
    kind: kind || 'other',
    payload: payload || null,
    status: 'pending',
    note: null,
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  }
  proposals = [entry, ...proposals]
  save(proposals)
  notify()
  return entry
}

function getById(id) {
  return proposals.find((p) => p.id === id) || null
}

function resolve(id, status, note) {
  const entry = getById(id)
  if (!entry) return null
  entry.status = status
  entry.note = note || null
  entry.resolvedAt = new Date().toISOString()
  proposals = [...proposals]
  save(proposals)
  notify()
  return entry
}

const approve = (id, note) => resolve(id, 'approved', note)
const reject = (id, note) => resolve(id, 'rejected', note)

const listPending = () => proposals.filter((p) => p.status === 'pending')

export const store = {
  subscribe,
  getState,
  proposeAction,
  getById,
  approve,
  reject,
  listPending,
}
