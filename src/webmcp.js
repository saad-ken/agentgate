// Registers AgentGate's tools with the browser's WebMCP implementation
// (document.modelContext), per https://developer.chrome.com/docs/ai/webmcp/imperative-api
//
// This is the actual answer to WebMCP spec issues #165 / #50 (no native
// confirmation primitive exists yet): an agent must call `propose_action`
// instead of acting directly, then poll `check_approval` until a human has
// reviewed it in the AgentGate UI. Implemented entirely at the application
// level since there's nothing built into WebMCP for this yet.

import { store } from './store'

export const isWebMcpSupported = () => typeof document.modelContext !== 'undefined'

let registered = false

export function registerAgentGateTools() {
  if (!isWebMcpSupported()) return false
  if (registered) return true
  registered = true

  document.modelContext.registerTool({
    name: 'propose_action',
    description:
      'Propose a sensitive action (e.g. filing a bug, requesting a code change, logging a test result) for a human to review before it happens. Returns a proposal id — call check_approval with that id to learn the outcome.',
    inputSchema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'A clear, specific description of the action being proposed.',
        },
        kind: {
          type: 'string',
          enum: ['bug_report', 'code_change', 'test_result', 'other'],
          description: 'What category of action this is.',
        },
        payload: {
          type: 'object',
          description: 'Optional structured details relevant to the action (e.g. file paths, test names).',
        },
      },
      required: ['description'],
    },
    execute: async ({ description, kind, payload }) => {
      const entry = store.proposeAction({ description, kind, payload })
      return `Proposal ${entry.id} submitted and is now pending human review in AgentGate. Call check_approval with id "${entry.id}" to learn the outcome.`
    },
  })

  document.modelContext.registerTool({
    name: 'check_approval',
    description: 'Check whether a human has approved or rejected a previously proposed action.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The proposal id returned by propose_action.' },
      },
      required: ['id'],
    },
    execute: async ({ id }) => {
      const entry = store.getById(id)
      if (!entry) return JSON.stringify({ error: `No proposal found with id "${id}".` })
      return JSON.stringify({
        id: entry.id,
        status: entry.status,
        note: entry.note,
        description: entry.description,
      })
    },
  })

  document.modelContext.registerTool({
    name: 'list_pending',
    description: 'List all actions currently awaiting human review in AgentGate.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const pending = store.listPending().map(({ id, description, kind, createdAt }) => ({
        id,
        description,
        kind,
        createdAt,
      }))
      return JSON.stringify(pending)
    },
  })

  return true
}
