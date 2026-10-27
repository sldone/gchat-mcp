import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const [packed] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { encoding: 'utf8' }));
const files: string[] = packed.files.map((f: { path: string }) => f.path);

test('npx gchat-mcp runs the compiled server', () => {
  assert.equal(pkg.name, 'gchat-mcp');
  assert.equal(pkg.bin['gchat-mcp'], 'dist/server.js');
  assert.ok(files.includes('dist/server.js'));
  assert.match(readFileSync('dist/server.js', 'utf8'), /^#!\/usr\/bin\/env node\n/);
});

test('the package ships the license and docs, and nothing private or test-only', () => {
  for (const required of ['LICENSE', 'README.md', 'SECURITY.md', 'CHANGELOG.md']) assert.ok(files.includes(required), required);
  for (const path of files) assert.doesNotMatch(path, /^(src|test|\.claude|\.github|profile)\b/, path);
});

test('the package metadata points at the public repository', () => {
  assert.equal(pkg.license, 'MIT');
  assert.equal(pkg.repository.url, 'git+https://github.com/sldone/gchat-mcp.git');
  assert.equal(pkg.private, undefined);
});

test('the Claude Code and Codex plugins launch this package at the same version', () => {
  for (const manifest of ['.claude-plugin/plugin.json', '.codex-plugin/plugin.json']) {
    const plugin = JSON.parse(readFileSync(manifest, 'utf8'));
    assert.equal(plugin.version, pkg.version, `${manifest} version`);
    assert.deepEqual(plugin.mcpServers['google-chat'].args, ['-y', pkg.name], `${manifest} args`);
  }
});
