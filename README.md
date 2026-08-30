# AgentGate

A human approval gate for AI agents, built on [WebMCP](https://developer.chrome.com/docs/ai/webmcp).

**Theme fit:** WebMCP lets a page register tools (`document.modelContext.registerTool()`) that an AI agent can call directly — no clicking, no form-filling, just a direct function call. That's powerful, but it also means an agent can trigger a real, consequential action the instant it calls a tool, with no human in the loop by default. WebMCP's own spec repository has this flagged as an open, unresolved question ([webmachinelearning/webmcp#165](https://github.com/webmachinelearning/webmcp/issues/165), [#50](https://github.com/webmachinelearning/webmcp/issues/50)) — there's no built-in primitive for "pause and ask a human first." AgentGate is a working, opinionated answer to that gap, built entirely at the application level on top of the real WebMCP API.

## What it does

Instead of registering a tool that performs a sensitive action directly, a site registers `propose_action`. When an agent calls it, nothing happens immediately — the request is queued and shown to a human in AgentGate's approval inbox. The agent calls `check_approval` to find out what the human decided, and only proceeds with the real action once it sees `"approved"`.

### Tools registered via `document.modelContext.registerTool()`

- **`propose_action`** — an agent proposes a sensitive action (`description`, `kind`, optional `payload`). Returns a proposal id immediately; the action itself does not happen yet.
- **`check_approval`** — an agent polls with a proposal id to learn its current status: `pending`, `approved`, or `rejected`, plus any note the human left.
- **`list_pending`** — lets an agent introspect what's currently queued for human review.

All three are real, standard WebMCP tools — discoverable via `document.modelContext.getTools()`, callable via `document.modelContext.executeTool()`, same as any other WebMCP tool on the page.

## How it's built

- React + Vite front end (`src/App.jsx`, `src/App.css`)
- `src/webmcp.js` — registers the three tools against `document.modelContext`. Registration is guarded to run once per page load (the real API has no `unregisterTool`, so without the guard, React StrictMode's double-invoke in dev throws "Duplicate tool name" errors)
- `src/store.js` — a small observable store holding proposals, persisted to `localStorage` so history survives reloads
- No backend — everything runs client-side, which is enough for a working demo of the pattern

## Running it locally

```bash
npm install
npm run dev
```

Opens on `http://localhost:5173`.

### Testing with real WebMCP

WebMCP is an experimental, gated feature — a page only gets it in a normal, unmodified Chrome window if it carries a valid **Origin Trial** token in a `<meta http-equiv="origin-trial">` tag scoped to that exact origin (or the browser has it enabled some other way, e.g. Chrome's `#enable-webmcp-testing` flag, or an agent-native browser like ChatGPT's in-app browser that supports it natively).

This repo's `index.html` ships with a token scoped to `http://localhost:5173` — running the dev server as above is enough to get a real `document.modelContext` in Chrome 149+, no flags required. The support banner at the top of the page tells you directly whether it detected the real API.

To exercise the tools exactly as an agent would, open DevTools console on the running page and run:

```js
const tools = await document.modelContext.getTools();
const propose = tools.find(t => t.name === 'propose_action');
const result = await document.modelContext.executeTool(
  propose,
  JSON.stringify({ description: 'Delete the old staging branch', kind: 'code_change' })
);
console.log(result); // contains the proposal id
```

Approve or reject it in the UI, then check the outcome the same way an agent would:

```js
const checkTool = (await document.modelContext.getTools()).find(t => t.name === 'check_approval');
await document.modelContext.executeTool(checkTool, JSON.stringify({ id: 'PASTE_ID_HERE' }));
```

There's also a "Simulate an agent call" form directly in the UI, for exercising the same underlying flow without touching DevTools — useful when WebMCP isn't available in the current browser (the banner falls back to a clear message in that case, and the form still works either way).

## Testing & verification

This wasn't just built and assumed to work — it was verified against the real, gated WebMCP API (not a mock or simulation):

- Registered for Chrome's WebMCP Origin Trial and confirmed `document.modelContext` is genuinely defined on this page (not polyfilled).
- Called `propose_action` through the real `document.modelContext.executeTool()` — no clicking, a direct tool call — and confirmed a pending entry appeared in the UI.
- Approved it as a human in the UI, then called `check_approval` through the real API and confirmed it correctly returned `"status":"approved"`.
- In the process, found that the real API differs from a naive reading of the docs — `getTools()` and `registerTool()` are both asynchronous, and `executeTool()` takes the tool object plus a JSON string of arguments, not a name and a plain object.
- Found and fixed a real bug this testing surfaced: React StrictMode's double-invoke in development was calling `registerTool()` twice per tool, and since the real API exposes no `unregisterTool`, this threw "Duplicate tool name" errors. Fixed with an idempotency guard in `src/webmcp.js`.

Anyone reviewing this project — human or automated — is welcome to repeat this verification directly: run it locally per the instructions above, open DevTools, and call the tools yourself. The banner at the top of the page will tell you plainly whether the real API is present.

## License

MIT — see [LICENSE](./LICENSE).
