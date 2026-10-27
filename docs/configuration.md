# Configuration

gchat-mcp is a stdio MCP server started with `npx -y gchat-mcp`. It needs Node.js 22 or later and Google Chrome.

## Clients

### Claude Code

As a plugin (recommended):

```sh
claude plugin marketplace add sldone/gchat-mcp
claude plugin install google-chat@gchat-mcp
```

As a plain MCP server:

```sh
claude mcp add google-chat -- npx -y gchat-mcp
```

The plugin's tools are named `mcp__plugin_google-chat_google-chat__<tool>`. Plain MCP servers use `mcp__google-chat__<tool>`. Use these names in permission rules. For example, to allow the read-only tools without a prompt while still asking before every send, add this to `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "mcp__google-chat__list_spaces",
      "mcp__google-chat__read_messages",
      "mcp__google-chat__read_thread",
      "mcp__google-chat__search"
    ]
  }
}
```

### Codex

As a plugin:

```sh
codex plugin marketplace add sldone/gchat-mcp
codex plugin install google-chat@gchat-mcp
```

As a plain MCP server, in `~/.codex/config.toml`:

```toml
[mcp_servers.google-chat]
command = "npx"
args = ["-y", "gchat-mcp"]
# Long history reads and sign-in can take longer than Codex's default tool timeout.
tool_timeout_sec = 600
```

### Claude Desktop, Cursor, VS Code and others

Most clients take the same JSON shape. Put it in the client's MCP config file, for example `claude_desktop_config.json` or `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "google-chat": {
      "command": "npx",
      "args": ["-y", "gchat-mcp"]
    }
  }
}
```

If your client has a per-tool timeout, allow at least 5 minutes for `sign_in`.

## Environment variables

Set these in the client's `env` block for the server.

| Variable | Default | What it does |
|----------|---------|--------------|
| `GCHAT_PROFILE` | `~/.gchat-mcp/profile` | Folder for the Chrome profile that holds your Google session. The server creates it, or tightens it, to mode `0700`. Point it at an empty or dedicated folder: `sign_out` deletes everything in it, and refuses to do so if the folder isn't a Chrome profile. |
| `GCHAT_HEADED` | unset | Set it to `1` to show the browser window while tools run. Useful when debugging selectors. |

For example:

```json
{
  "mcpServers": {
    "google-chat": {
      "command": "npx",
      "args": ["-y", "gchat-mcp"],
      "env": { "GCHAT_PROFILE": "/Users/me/.config/gchat-work" }
    }
  }
}
```

To use two Google accounts, register the server twice under different names, each with its own `GCHAT_PROFILE`.

## Command line

| Command | What it does |
|---------|--------------|
| `npx gchat-mcp` | Starts the MCP server on stdio. MCP clients run this for you. |
| `npx gchat-mcp login` | Opens Chrome so you can sign in, and closes it once Google Chat loads (up to 5 minutes). |
| `npx gchat-mcp logout` | Deletes the stored Google session. |

`login` and `logout` use the same profile as the server, so stop your MCP client first, or use the `sign_in` and `sign_out` tools instead.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Not signed in to Google Chat" | Let the agent call `sign_in`, or run `npx gchat-mcp login` while no client is running. |
| Chrome fails to start | Make sure Google Chrome is installed in its default location. The server uses your installed Chrome, not a bundled Chromium. |
| macOS asks for access to "Google Chrome Safe Storage" | Allow it. Chrome uses this keychain item to encrypt the session cookies. |
| Tools return empty lists, or sending times out | Google probably changed the Chat web UI. Run with `GCHAT_HEADED=1` to watch, and open an issue. |
| A tool rejects an id | Ids must come from `list_spaces`, `read_messages` or `search`, for example `space/AAAAwsXxIMY`, `dm/-qXUj4AAAAE` or thread `NIGRVKEYuRc`. |
