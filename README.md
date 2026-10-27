<img src="assets/icon.svg" width="64" height="64" alt="">

# gchat-mcp

[![npm](https://img.shields.io/npm/v/gchat-mcp)](https://www.npmjs.com/package/gchat-mcp)
[![CI](https://github.com/sldone/gchat-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/sldone/gchat-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

An MCP server that lets Claude, Codex and other AI agents read, search and send your Google Chat messages.

It doesn't use the Google Chat API, so it needs no OAuth app and no Google Cloud project. Instead, it drives the Chat web app (chat.google.com) in a Chrome profile that you sign in to once. That means it works even when your Workspace admin blocks third-party OAuth apps. Your agent does the summarizing.

## Requirements

- Node.js 22 or later
- Google Chrome

## Quick start

### Claude Code

```sh
claude plugin marketplace add sldone/gchat-mcp
claude plugin install google-chat@gchat-mcp
```

### Codex

```sh
codex plugin marketplace add sldone/gchat-mcp
codex plugin install google-chat@gchat-mcp
```

### Other MCP clients

Add a stdio server that runs `npx -y gchat-mcp`. For example, in Claude Desktop's or Cursor's MCP config:

```json
{
  "mcpServers": {
    "google-chat": { "command": "npx", "args": ["-y", "gchat-mcp"] }
  }
}
```

See [docs/configuration.md](docs/configuration.md) for every client, setting and command.

### Sign in

The first time your agent uses Google Chat, the server reports that you're not signed in. The agent then calls `sign_in`, which opens a Chrome window where you sign in to Google as usual, with SSO and 2FA. The window closes by itself once Chat loads. You can also sign in ahead of time:

```sh
npx gchat-mcp login
```

## Tools

| Tool | What it does |
|------|--------------|
| `list_spaces` | Lists your spaces, group chats and DMs, with the ids the other tools take |
| `read_messages(space, limit = 50)` | Reads the latest top-level messages of a conversation, oldest first. Scrolls back through history for larger limits |
| `read_thread(space, thread)` | Reads every message in a thread |
| `search(query)` | Searches all your conversations like the "Search chat" box and returns the top ~20 matches |
| `send_message(space, text, thread?)` | Posts as you, as a new message or as a reply in a thread |
| `sign_in` | Opens a Chrome window to sign in and waits up to 5 minutes |
| `sign_out` | Deletes the Google session stored on this computer |

Messages come back as JSON with `space`, `thread`, `id`, `author` (`You` for you), `time` (local) and `text`. The server also sends your agent instructions on how the tools fit together, and tells it to confirm with you before sending anything.

Example prompts:

- "Summarize what happened in the Engineering space today."
- "Find the merge requests people asked me to review this week."
- "Reply in that thread that I'll look at it after lunch." The agent shows you the text before sending.

## Security and privacy

- **Your session stays on your computer.** It's stored only in the Chrome profile at `~/.gchat-mcp/profile`, which is readable only by your user. Chrome encrypts the cookies with your OS keychain. The server never reads, copies, logs or sends them anywhere.
- **Message content goes to your AI agent.** Whatever the tools read is passed to your MCP client, and from there to its model provider.
- **`send_message` posts as you.** Keep your client's approval prompt on for it.
- **`sign_out` deletes the local session.** Run it, or `npx gchat-mcp logout`, when you're done.

Details, the threat model, and how to report a vulnerability are in [SECURITY.md](SECURITY.md).

Automating around an admin restriction may conflict with your organization's acceptable-use policy. Check before you rely on this.

## Limitations

- It depends on the Chat web UI. When Google changes the page, reads can come back empty or sending can time out until the selectors in `src/server.ts` are updated.
- `search` returns only the first page of results (about 20).
- Unread status isn't reported.
- Very long threads return only the part Chat renders first.
- Tool calls run one at a time, because they share one browser tab.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Changes are listed in [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)
