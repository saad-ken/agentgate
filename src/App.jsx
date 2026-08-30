import { useEffect, useState } from 'react'
import { store } from './store'
import { registerAgentGateTools } from './webmcp'
import './App.css'

const KIND_LABELS = {
  bug_report: 'Bug report',
  code_change: 'Code change',
  test_result: 'Test result',
  other: 'Other',
}

function timeAgo(iso) {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function ProposalCard({ proposal, onApprove, onReject }) {
  const [note, setNote] = useState('')
  const isPending = proposal.status === 'pending'

  return (
    <article className={`card card--${proposal.status}`}>
      <div className="card-top">
        <span className={`badge badge--${proposal.kind}`}>{KIND_LABELS[proposal.kind] || proposal.kind}</span>
        <span className="muted">{timeAgo(proposal.createdAt)}</span>
        {!isPending && <span className={`status status--${proposal.status}`}>{proposal.status}</span>}
      </div>
      <p className="description">{proposal.description}</p>
      {proposal.payload && (
        <pre className="payload">{JSON.stringify(proposal.payload, null, 2)}</pre>
      )}
      {isPending ? (
        <div className="actions">
          <input
            type="text"
            placeholder="Optional note..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button className="approve" onClick={() => onApprove(proposal.id, note)}>
            Approve
          </button>
          <button className="reject" onClick={() => onReject(proposal.id, note)}>
            Reject
          </button>
        </div>
      ) : (
        proposal.note && <p className="note">"{proposal.note}"</p>
      )}
    </article>
  )
}

function SimulateForm({ onPropose }) {
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState('other')

  const submit = (e) => {
    e.preventDefault()
    if (!description.trim()) return
    onPropose({ description: description.trim(), kind })
    setDescription('')
  }

  return (
    <form className="simulate" onSubmit={submit}>
      <p className="simulate-label">
        Simulate an agent call (for local testing / demo — a real WebMCP agent calls the
        same <code>propose_action</code> tool directly):
      </p>
      <div className="simulate-row">
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          {Object.entries(KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="e.g. Delete the staging database backup from last week"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button type="submit">Propose</button>
      </div>
    </form>
  )
}

function App() {
  const [proposals, setProposals] = useState(store.getState())
  const [webMcpSupported, setWebMcpSupported] = useState(false)

  useEffect(() => {
    const unsubscribe = store.subscribe(setProposals)
    setWebMcpSupported(registerAgentGateTools())
    return unsubscribe
  }, [])

  const pending = proposals.filter((p) => p.status === 'pending')
  const history = proposals.filter((p) => p.status !== 'pending')

  return (
    <div className="app">
      <header className="topbar">
        <h1>AgentGate</h1>
        <p className="tagline">A human approval gate for AI agents, built on WebMCP.</p>
      </header>

      <div className={`support-banner ${webMcpSupported ? 'ok' : 'warn'}`}>
        {webMcpSupported
          ? 'WebMCP detected — propose_action, check_approval, and list_pending are registered and callable by any agent on this page.'
          : 'WebMCP not detected in this browser (document.modelContext is undefined). Enable it via chrome://flags/#enable-webmcp-testing on Chrome 149+, or via the WebMCP Origin Trial. The UI below still works using the simulate form.'}
      </div>

      <main>
        <section>
          <h2>Pending review ({pending.length})</h2>
          {pending.length === 0 ? (
            <p className="empty">Nothing waiting on you right now.</p>
          ) : (
            <div className="list">
              {pending.map((p) => (
                <ProposalCard key={p.id} proposal={p} onApprove={store.approve} onReject={store.reject} />
              ))}
            </div>
          )}
          <SimulateForm onPropose={store.proposeAction} />
        </section>

        {history.length > 0 && (
          <section>
            <h2>History</h2>
            <div className="list">
              {history.map((p) => (
                <ProposalCard key={p.id} proposal={p} onApprove={store.approve} onReject={store.reject} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
