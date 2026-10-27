# Security

gchat-mcp acts as you in Google Chat, so it holds something valuable: a signed-in Google session. This page explains where that session lives, what the server does and doesn't do with it, and how to report a problem.

## Where your session is stored

- **Only on your computer.** The session lives in a dedicated Chrome profile, `~/.gchat-mcp/profile` by default (configurable with `GCHAT_PROFILE`). Nothing is uploaded, synced or shared. Chrome sync is off in this profile.
- **Only your user can read it.** The server creates the folder with mode `0700`, and tightens it on every start if its permissions have been loosened.
- **Encrypted at rest.** Chrome encrypts the cookies with the operating system's credential store: the Keychain on macOS, DPAPI on Windows, and the Secret Service (GNOME Keyring or KWallet) on Linux. Browser automation tools normally replace this with a fixed, publicly known key; gchat-mcp turns that off. On Linux machines without a keyring, Chrome falls back to its weaker built-in key, so prefer a desktop session with a keyring, or full-disk encryption.
- **Separate from your everyday Chrome.** Your normal browser profile, passwords and extensions are never touched.

## What the server does not do

- It doesn't store credentials itself. It never reads, copies, logs or sends cookies, tokens or passwords. Chrome holds them, and only Chrome uses them, to load chat.google.com.
- It doesn't phone home or collect telemetry. The server makes no network requests of its own. All traffic is Chrome loading Google Chat, plus accounts.google.com when you sign in.
- It doesn't write message content to disk, beyond what Chrome caches in the profile.
- It doesn't run arbitrary code or open arbitrary URLs. Every page it opens is built from a fixed chat.google.com address plus ids that must match the characters Google Chat uses. Anything else is rejected before a browser starts.

## What leaves your computer

**Message content that the tools return goes to your AI agent**, and from there to the agent's model provider (Anthropic, OpenAI and so on), under that provider's data policy. Read only what you're comfortable sharing with that provider.

## Safe use of the tools

| Tool | Effect | Recommendation |
|------|--------|----------------|
| `list_spaces`, `read_messages`, `read_thread`, `search` | Read-only. Marked `readOnlyHint` | Safe to auto-approve if you accept the data flow above |
| `send_message` | Posts as you. Other people see it immediately | Keep your client's approval prompt on. The server also tells the agent to confirm the text with you first |
| `sign_in` | Opens a visible Chrome window for you to sign in | — |
| `sign_out` | Deletes the stored session. Marked `destructiveHint` | Use it when you stop using the server, or on a shared machine |

To end the session on Google's side too, remove it under **Google Account → Security → Your devices**.

## Threat model

gchat-mcp protects the session from other users on the same computer, and from the session leaking into logs, the repository or network traffic it controls. It can't protect you from:

- malware running as your user, which can read anything you can;
- an AI agent that you let call `send_message` without review;
- prompt injection: a malicious chat message can contain instructions aimed at your agent. Treat what the tools return as untrusted input, and review any action the agent proposes after reading chats.

## Workspace policy

gchat-mcp uses the Chat web app exactly as you would in a browser, but automating it may conflict with your organization's acceptable-use policy. Check with your administrator if you're unsure.

## Reporting a vulnerability

Please don't open a public issue. Report it privately through GitHub: [Security → Report a vulnerability](https://github.com/sldone/gchat-mcp/security/advisories/new). You can expect an acknowledgment within a week. Fixes are released as a new npm version and noted in the [changelog](CHANGELOG.md).

## Supported versions

Only the latest published version gets security fixes.
