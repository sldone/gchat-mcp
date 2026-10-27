// Minimal MCP stdio client for tests: spawns the built server and speaks JSON-RPC to it.
import { spawn } from 'node:child_process';
import { once } from 'node:events';

export type Server = {
  instructions: string;
  request(method: string, params?: unknown): Promise<any>;
  callTool(name: string, args?: Record<string, unknown>): Promise<any>;
  close(): Promise<void>;
};

export async function startServer(env: Record<string, string> = {}): Promise<Server> {
  const child = spawn(process.execPath, ['dist/server.js'], {
    env: { ...process.env, ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const pending = new Map<number, (message: any) => void>();
  let buffer = '';
  let nextId = 0;
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
    buffer += chunk;
    for (let i; (i = buffer.indexOf('\n')) >= 0; buffer = buffer.slice(i + 1)) {
      const message = JSON.parse(buffer.slice(0, i));
      pending.get(message.id)?.(message);
    }
  });
  const exited = once(child, 'exit');
  const request = (method: string, params?: unknown) =>
    new Promise<any>((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, (message) => (message.error ? reject(new Error(message.error.message)) : resolve(message.result)));
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      exited.then(() => reject(new Error('server exited')));
    });
  const init = await request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  return {
    instructions: init.instructions ?? '',
    request,
    callTool: (name, args = {}) => request('tools/call', { name, arguments: args }),
    async close() {
      child.kill();
      await exited;
    },
  };
}
