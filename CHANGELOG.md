# Changelog

All notable changes to this project are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.1]

### Changed

- Example ids and names in tool descriptions, error messages and docs are generic placeholders. 0.1.0 is unpublished because its examples came from a real workspace.
- CI uses `actions/checkout` v7 and `actions/setup-node` v7. Development types use `@types/node` 26.

## [0.1.0]

### Added

- MCP tools `list_spaces`, `read_messages`, `read_thread`, `search`, `send_message`, `sign_in` and `sign_out`, which drive the Google Chat web app in a dedicated Chrome profile.
- `gchat-mcp login` and `gchat-mcp logout` commands.
- Claude Code and Codex plugin manifests.
- The session folder is kept at mode `0700`, cookies are encrypted with the OS keychain, and conversation and thread ids are validated before use.

[Unreleased]: https://github.com/sldone/gchat-mcp/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/sldone/gchat-mcp/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/sldone/gchat-mcp/releases/tag/v0.1.0
