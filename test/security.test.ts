import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { startServer } from './mcp-client.ts';

const freshProfile = () => join(mkdtempSync(join(tmpdir(), 'gchat-mcp-')), 'profile');
const mode = (path: string) => statSync(path).mode & 0o777;

test('creates the session folder readable only by the user', async () => {
  const profile = freshProfile();
  const server = await startServer({ GCHAT_PROFILE: profile });
  await server.close();
  assert.equal(mode(profile), 0o700);
});

test('tightens an existing session folder that others can read', async () => {
  const profile = freshProfile();
  mkdirSync(profile, { mode: 0o755 });
  const server = await startServer({ GCHAT_PROFILE: profile });
  await server.close();
  assert.equal(mode(profile), 0o700);
});

test('rejects ids that could steer the browser or the page selectors, without opening a browser', async () => {
  const profile = freshProfile();
  const server = await startServer({ GCHAT_PROFILE: profile });
  try {
    for (const [tool, args] of [
      ['read_messages', { space: '../../accounts.google.com/x' }],
      ['read_messages', { space: 'https://evil.example' }],
      ['read_thread', { space: 'space/AAAAwsXxIMY', thread: 'x"], body, [a="' }],
      ['send_message', { space: 'space/AAAA?x=1', text: 'hi' }],
      ['send_message', { space: 'space/AAAAwsXxIMY', thread: '../x', text: 'hi' }],
    ] as const) {
      assert.match(await server.toolError(tool, args), /id/i, `${tool} ${JSON.stringify(args)}`);
    }
  } finally {
    await server.close();
  }
  assert.deepEqual(readdirSync(profile), [], 'no browser was started');
});

test('sign_out deletes the stored Google session', async () => {
  const profile = freshProfile();
  mkdirSync(join(profile, 'Default'), { recursive: true });
  writeFileSync(join(profile, 'Local State'), '{}');
  writeFileSync(join(profile, 'Default', 'Cookies'), 'secret');
  const server = await startServer({ GCHAT_PROFILE: profile });
  try {
    await server.callTool('sign_out');
  } finally {
    await server.close();
  }
  assert.equal(existsSync(join(profile, 'Default', 'Cookies')), false);
  assert.equal(existsSync(join(profile, 'Local State')), false);
});

test('sign_out refuses to delete a folder that is not a Chrome profile', async () => {
  const profile = freshProfile();
  mkdirSync(profile);
  writeFileSync(join(profile, 'thesis.docx'), 'important');
  const server = await startServer({ GCHAT_PROFILE: profile });
  try {
    assert.match(await server.toolError('sign_out'), /not a Chrome profile/);
  } finally {
    await server.close();
  }
  assert.equal(existsSync(join(profile, 'thesis.docx')), true);
});
