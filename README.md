<img src="assets/icon.svg" width="64" height="64" alt="">

# google-chat-mcp

Local MCP server for reading and sending Google Chat messages.

It doesn't use the Google Chat API or OAuth. It drives the Chat web app (chat.google.com) in a separate Chrome profile that you sign in to once, so it keeps working when your Workspace admin blocks third-party OAuth apps. Your MCP client (for example, Claude) does the summarizing.

## Setup

Requires Node.js 22.18 or later (run `npm run build` after `npm install`) and Google Chrome.

```sh
npm install
```

The first time a tool needs Google Chat, it tells your agent to call `sign_in`, which opens a Chrome window for you to sign in. You can also sign in ahead of time with `npm run login`. The session is stored in `~/.google-chat-mcp/profile`; set `GCHAT_PROFILE` to use a different folder.

### Claude Code

Install it as a plugin. This repository is its own marketplace:

```sh
claude plugin marketplace add /absolute/path/to/google-chat-mcp
claude plugin install google-chat@google-chat-mcp
```

To try it without installing, start Claude Code with `claude --plugin-dir /absolute/path/to/google-chat-mcp`. To register only the MCP server, run `claude mcp add google-chat -- node /absolute/path/to/google-chat-mcp/dist/server.js`.

### Codex

```sh
codex plugin marketplace add /absolute/path/to/google-chat-mcp
codex plugin install google-chat@google-chat-mcp
```

Codex reads `.codex-plugin/plugin.json`, which allows tool calls up to 10 minutes, so long history reads and `sign_in` don't time out.

### Other MCP clients

Run `node /absolute/path/to/google-chat-mcp/dist/server.js` as a stdio server.

The server runs Chrome headless. To watch what it does, set `GCHAT_HEADED=1` in the server's environment.

## Tools

| Tool | What it does |
|------|--------------|
| `list_spaces` | Spaces, group chats and DMs from the sidebar, with their ids |
| `read_messages(space, limit = 50)` | Recent top-level messages, oldest first. Scrolls back to load older history when needed |
| `read_thread(space, thread)` | All messages in one thread |
| `search(query)` | Same as the "Search chat" box, across all your conversations. Returns the top ~20 results with space and thread ids |
| `send_message(space, text, thread?)` | Posts as you, either as a new message or as a reply in a thread |
| `sign_in` | Opens a visible Chrome window for signing in and waits up to 5 minutes for Google Chat to load |

The server also sends instructions to the agent: how the tools fit together, that summaries are written by the agent, and that it must confirm with you before sending.

## Things to know

- `~/.google-chat-mcp/profile` holds a live Google session, which gives full access to your account. Don't copy it or share it.
- Messages from `send_message` go out immediately. Keep your client's approval prompt on for that tool.
- `npm run login` can't run while the server is running, because they share the profile. Use the `sign_in` tool instead.
- Selectors are based on the Chat web UI (see the constants at the top of `server.ts`). When Google changes the UI, reads may come back empty or sending may time out, and the selectors need updating.
- Automating around an admin restriction may conflict with your company's acceptable-use policy. Check before relying on this.
