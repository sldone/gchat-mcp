# Contributing

Thanks for helping. Bug reports, selector fixes for Chat UI changes, and new tools are all welcome.

## Setup

You need Node.js 22.18 or later (the tests run TypeScript directly) and Google Chrome.

```sh
git clone https://github.com/sldone/gchat-mcp.git
cd gchat-mcp
npm install
npm test
```

| Script | What it does |
|--------|--------------|
| `npm run build` | Compiles `src/server.ts` to `dist/server.js` |
| `npm run typecheck` | Type-checks the source and the tests |
| `npm test` | Builds, then runs the tests in `test/` |
| `npm run login` / `npm run logout` | Signs in to, or deletes, the local Google session |

## How the code is organized

Everything lives in `src/server.ts`:

- **Selectors** at the top describe the Chat web UI. They are the part most likely to break.
- **`scrape`** runs inside the page and turns message elements into JSON. It must stay self-contained, because Playwright serializes it into the browser.
- **Tools** are registered at the bottom. Each one has a title, a description, input descriptions and annotations, because agents choose tools from these. `test/tools.test.ts` enforces this.

## Tests

The tests start the built server over stdio, the way an MCP client does. They don't need a Google account or a browser. They check the tool contract, session-folder security and id validation, and the npm package contents.

Reading and sending real messages can't be tested in CI. When you change selectors or a tool's behavior, try it against a real account:

```sh
npm run build
npm run login
GCHAT_HEADED=1 claude --mcp-config '{"mcpServers":{"google-chat":{"command":"node","args":["dist/server.js"]}}}'
```

Say in your pull request what you tried. Never paste real message content, ids, or anything from your profile folder into issues or pull requests.

### When Google changes the UI

Run with `GCHAT_HEADED=1`, open DevTools in that window, and find the new attributes for the element that stopped matching. Prefer `data-*` attributes and ARIA roles over obfuscated class names, which change more often.

## Pull requests

- Keep each pull request to one change, and include a test when the behavior can be tested without Google.
- Explain in the commit message why the change is needed, what changed, and how you checked it.
- Add a line under `[Unreleased]` in `CHANGELOG.md`.
- Security problems go through [private reporting](SECURITY.md#reporting-a-vulnerability), not public issues.

## Releasing

Releases are published to npm by `.github/workflows/publish.yml` when a `v*` tag is pushed. It uses npm trusted publishing, so there is no npm token in the repository.

One-time setup:

1. On npmjs.com, open the `gchat-mcp` package's **Settings → Trusted publishing**, and add GitHub Actions with organization or user `sldone`, repository `gchat-mcp`, workflow `publish.yml`, and environment `npm`.
2. In the GitHub repository's **Settings → Environments**, create an environment named `npm`. Add required reviewers if you want to approve each release.
3. If npm doesn't let you add a trusted publisher before the package exists, publish the first version by hand with `npm publish --access public`, then do step 1.

For each release:

1. Move the `[Unreleased]` notes in `CHANGELOG.md` under a new version heading.
2. Run `npm version <patch|minor|major> --no-git-tag-version`, and set the same version in `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json`. `npm test` fails if they differ.
3. Commit, then tag and push: `git tag v<version> && git push origin main v<version>`.
4. The workflow checks that the tag matches `package.json`, runs the tests, and publishes with provenance.
