import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { startServer, type Server } from './mcp-client.ts';

let server: Server;
before(async () => (server = await startServer()));
after(() => server?.close());

test('every tool tells an agent what it does, what it takes and whether it changes anything', async () => {
  const { tools } = await server.request('tools/list');
  assert.deepEqual(tools.map((t: any) => t.name).sort(), [
    'list_spaces', 'read_messages', 'read_thread', 'search', 'send_message', 'sign_in', 'sign_out',
  ]);
  for (const tool of tools) {
    assert.ok(tool.title, `${tool.name} has a title`);
    assert.ok(tool.description?.length > 40, `${tool.name} has a real description`);
    assert.equal(typeof tool.annotations?.readOnlyHint, 'boolean', `${tool.name} says whether it is read-only`);
    for (const [param, schema] of Object.entries<any>(tool.inputSchema.properties ?? {})) {
      assert.ok(schema.description, `${tool.name}.${param} has a description`);
    }
  }
});

test('the server explains the workflow to the agent, including confirming before sending', () => {
  assert.match(server.instructions, /list_spaces/);
  assert.match(server.instructions, /send_message.*[Cc]onfirm/);
});
