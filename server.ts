// Google Chat MCP server that drives the Chat web UI in a local Chrome profile.
// No Google API or OAuth client: it reuses your own browser session, so admin OAuth blocks don't apply.
import { homedir } from 'node:os';
import { join } from 'node:path';
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { chromium, type Page } from 'playwright';
import * as z from 'zod/v4';

// Outside the code directory, so plugin reinstalls and updates keep the session.
const PROFILE = process.env.GCHAT_PROFILE ?? join(homedir(), '.google-chat-mcp', 'profile');
const BASE = 'https://chat.google.com';
// Selectors come from the Chat web UI and break when Google changes it. Re-probe the DOM if reads come back empty.
const COMPOSER = '[role=textbox][contenteditable=true]';
const SIDEBAR_ITEM = '[role=listitem][data-group-id]';
const SEARCH_RESULT = 'div[data-id][data-is-search-view=true]';
const MAIN_VIEW = 'c-wiz[data-topic-id][data-is-main-view=true]:not([data-is-detailed-thread-view=true])';
const threadView = (thread: string) => `c-wiz[data-topic-id="${thread}"][data-is-detailed-thread-view=true]`;

const launch = (headless: boolean) =>
  chromium.launchPersistentContext(PROFILE, {
    channel: 'chrome',
    headless,
    viewport: null,
    ignoreDefaultArgs: ['--enable-automation'],
  });

// Opens a visible Chrome window and waits until Google Chat has loaded for a signed-in user.
async function signIn() {
  const ctx = await launch(false);
  try {
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto(`https://accounts.google.com/ServiceLogin?continue=${encodeURIComponent(BASE + '/')}`);
    await page.locator(SIDEBAR_ITEM).first().waitFor({ timeout: 5 * 60_000 });
  } finally {
    await ctx.close();
  }
}

if (process.argv[2] === 'login') {
  console.error('Sign in to Google in the Chrome window. It closes by itself once Google Chat loads.');
  await signIn();
  process.exit(0);
}

let browserPage: Promise<Page> | undefined;

async function openBrowser() {
  const ctx = await launch(process.env.GCHAT_HEADED !== '1');
  ctx.on('close', () => (browserPage = undefined));
  return ctx.pages()[0] ?? ctx.newPage();
}

// ponytail: one shared tab, so tool calls run one at a time. Use a tab per call if parallel reads matter.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn);
  queue = run.catch(() => {});
  return run;
}

// Accepts ids from list_spaces ("space/AAAA…", "dm/xyz…") or bare ids.
const bareId = (space: string) => space.replace(/^(space|dm)\//, '');

// `ready` is an element that only renders once the page has loaded for a signed-in user.
async function open(path: string, ready = COMPOSER): Promise<Page> {
  browserPage ??= openBrowser().catch((e) => {
    browserPage = undefined;
    throw e;
  });
  const page = await browserPage;
  await page.goto(BASE + path);
  if (!page.url().startsWith(BASE + '/app')) {
    throw new Error('Not signed in to Google Chat. Call the sign_in tool, then retry.');
  }
  await page.locator(ready).first().waitFor();
  return page;
}

type Message = { space: string; thread: string; id: string; author: string; time: string; text: string; replies?: string };

// Runs in the browser, so it must stay self-contained. Message elements look the same in a conversation,
// a thread and search results, apart from where the author and the full text sit.
function scrape(messageSelector: string): Message[] {
  const textOf = (el: Element) => {
    const copy = el.cloneNode(true) as Element;
    copy.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
    copy.querySelectorAll('button').forEach((button) => button.remove()); // "Show more" / "Show less"
    return (copy.textContent ?? '').replace(/[ \t]+/g, ' ').trim();
  };
  return [...document.querySelectorAll<HTMLElement>(messageSelector)].flatMap((m) => {
    const ts = m.querySelector<HTMLElement>('[data-absolute-timestamp]');
    if (!ts || !m.checkVisibility()) return []; // reactions, and hidden copies of a thread
    // jsdata carries "<message id>,<thread id>,<space or dm id>".
    const [, id, thread, space] = m.getAttribute('jsdata')?.match(/([\w-]+),([\w-]+),((?:space|dm)\/[\w-]+)/) ?? [];
    const replies = [...(m.closest('[data-topic-id]')?.querySelectorAll('[role=button]') ?? [])]
      .map((b) => b.textContent ?? '')
      .find((s) => /\d+ repl/i.test(s));
    // Long messages render a snippet plus a hidden full copy (.AsINg).
    // Cards, meetings and attachments have no text body, so fall back to whatever they render.
    const body = m.querySelector('.AsINg') ?? m.querySelector('.CwZ22e') ?? m.querySelector('.DTp27d') ?? m;
    // Search results start .DTp27d with "Author:" (or "You:"); elsewhere the first .njhDLd is the author.
    const searchAuthor = m.dataset.isSearchView && m.querySelector('.DTp27d')?.firstChild?.textContent;
    const author = (searchAuthor || m.querySelector('.njhDLd')?.textContent || '').trim().replace(/:$/, '');
    let text = textOf(body);
    // Short search results keep the "Author:" prefix inside the body.
    if (searchAuthor && text.startsWith(author)) text = text.slice(author.length).replace(/^:\s*/, '');
    return [{
      space,
      thread,
      id,
      author,
      time: new Date(Number(ts.dataset.absoluteTimestamp)).toLocaleString('sv-SE'),
      text,
      ...(replies && { replies }),
    }];
  });
}

// Runs in the browser. Every page has the sidebar, so this works on any view.
function sidebar(itemSelector: string) {
  const names = new Map<string, string>();
  for (const item of document.querySelectorAll<HTMLElement>(itemSelector)) {
    const name = (item.querySelector('.njhDLd') ?? item.querySelector('bdi'))?.textContent?.trim();
    if (name && !names.has(item.dataset.groupId!)) names.set(item.dataset.groupId!, name);
  }
  return [...names].map(([id, name]) => ({ id, name }));
}

async function loadHistory(page: Page, limit: number) {
  const count = async () => (await page.evaluate(scrape, `${MAIN_VIEW} div[data-id]`)).length;
  for (let n = await count(); n < limit; ) {
    await page.evaluate((selector) => {
      let el = document.querySelector(selector);
      while (el && !(el.scrollHeight > el.clientHeight && /auto|scroll/.test(getComputedStyle(el).overflowY))) {
        el = el.parentElement;
      }
      el?.scrollTo(0, 0);
    }, MAIN_VIEW);
    await page.waitForTimeout(2000);
    const next = await count();
    if (next === n) break; // reached the start of the conversation
    n = next;
  }
}

const json = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value, null, 1) }] });

const MESSAGE_FIELDS =
  'Each message has space, thread and id, author ("You" for the user), time (local, "YYYY-MM-DD HH:MM:SS") and text.';
const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;

const server = new McpServer(
  { name: 'google-chat', version: '0.1.0' },
  {
    instructions: [
      "Reads and sends the user's Google Chat messages through their own signed-in Chrome session. No Google API is involved.",
      'Find conversation ids with list_spaces, or find messages with search. Read a conversation with read_messages, and open a thread with read_thread using a message\'s thread id.',
      'There is no summarize tool: to summarize, read the messages and write the summary yourself.',
      'If a tool says the user is not signed in, call sign_in and tell the user to finish signing in in the Chrome window that opens.',
      'send_message posts as the user right away. Confirm the exact text and the conversation with the user before calling it.',
    ].join('\n'),
  },
);

server.registerTool(
  'list_spaces',
  {
    title: 'List Google Chat conversations',
    description:
      'List every space, group chat and direct message in the Google Chat sidebar as { id, name }. Ids look like "space/AAAAbCdEfGh" or "dm/aBcDeFgAAAE" and are what the other tools take.',
    annotations: READ_ONLY,
  },
  () =>
    serial(async () => {
      const page = await open('/app/home', SIDEBAR_ITEM);
      // The sidebar keeps filling in for a second or two after the first item appears.
      for (let n = -1, next; (next = await page.locator(SIDEBAR_ITEM).count()) !== n; n = next) await page.waitForTimeout(1000);
      return json(await page.evaluate(sidebar, SIDEBAR_ITEM));
    }),
);

server.registerTool(
  'read_messages',
  {
    title: 'Read Google Chat messages',
    description: `Read the most recent top-level messages of a space or DM, oldest first. ${MESSAGE_FIELDS} Messages that start a thread also have replies (e.g. "3 replies, Last Reply 9:09 AM"); read those with read_thread. Larger limits scroll back through history and take longer.`,
    inputSchema: z.object({
      space: z.string().describe('Conversation id from list_spaces or search, e.g. "space/AAAAbCdEfGh" or "dm/aBcDeFgAAAE"'),
      limit: z.number().int().min(1).max(500).default(50).describe('How many of the latest messages to return'),
    }),
    annotations: READ_ONLY,
  },
  ({ space, limit }) =>
    serial(async () => {
      const page = await open(`/app/chat/${bareId(space)}`);
      await loadHistory(page, limit);
      return json((await page.evaluate(scrape, `${MAIN_VIEW} div[data-id]`)).slice(-limit));
    }),
);

server.registerTool(
  'read_thread',
  {
    title: 'Read a Google Chat thread',
    description: `Read every message in one thread, starting with the message that opened it. ${MESSAGE_FIELDS}`,
    inputSchema: z.object({
      space: z.string().describe('Conversation id the thread belongs to'),
      thread: z.string().describe('The "thread" field of a message from read_messages or search'),
    }),
    annotations: READ_ONLY,
  },
  ({ space, thread }) =>
    serial(async () => {
      const page = await open(`/app/chat/${bareId(space)}/topic/${thread}`);
      await page.locator(threadView(thread)).filter({ visible: true }).first().waitFor();
      // Every message in the thread view carries the thread's reply count; it adds nothing here.
      return json((await page.evaluate(scrape, `${threadView(thread)} div[data-id]`)).map(({ replies, ...m }) => m));
    }),
);

server.registerTool(
  'search',
  {
    title: 'Search Google Chat',
    description: `Search messages in all of the user's spaces and DMs, like the "Search chat" box. Returns the top ~20 matches in the order Chat shows them. ${MESSAGE_FIELDS} Each result also has space_name. Use read_thread for a result's full thread. Returns [] when nothing matches.`,
    inputSchema: z.object({ query: z.string().min(1).describe('Words to search for, as typed into the Chat search box') }),
    annotations: READ_ONLY,
  },
  ({ query }) =>
    serial(async () => {
      const page = await open(`/app/search?q=${encodeURIComponent(query)}&cmembership=1`, SIDEBAR_ITEM);
      // ponytail: first page of results only (about 20). Scroll the result list if more are needed.
      const found = await page.locator(SEARCH_RESULT).first().waitFor({ timeout: 10_000 }).then(() => true, () => false);
      if (!found) return json([]);
      const names = new Map((await page.evaluate(sidebar, SIDEBAR_ITEM)).map((s) => [s.id, s.name]));
      const results = await page.evaluate(scrape, SEARCH_RESULT);
      return json(results.map((m) => ({ ...m, space_name: names.get(m.space) })));
    }),
);

server.registerTool(
  'send_message',
  {
    title: 'Send a Google Chat message',
    description:
      'Send a message as the user, either as a new message in a space or DM or as a reply in a thread. It is posted immediately and other people see it, so confirm the text and conversation with the user first.',
    inputSchema: z.object({
      space: z.string().describe('Conversation id from list_spaces or search'),
      text: z.string().min(1).describe('Message text. Line breaks are kept.'),
      thread: z.string().optional().describe('Thread id to reply in. Omit to post a new top-level message.'),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  ({ space, text, thread }) =>
    serial(async () => {
      const page = await open(`/app/chat/${bareId(space)}${thread ? `/topic/${thread}` : ''}`);
      if (thread) {
        // The thread reply box is a placeholder until clicked; clicking swaps in the real editor and focuses it.
        await page.locator(`${threadView(thread)} [role=textbox]:not([contenteditable])`).filter({ visible: true }).first().click();
      } else {
        await page.locator(COMPOSER).filter({ visible: true }).first().click();
      }
      const box = page.locator(`${COMPOSER}:focus`);
      await box.waitFor();
      const lines = text.split('\n');
      for (const [i, line] of lines.entries()) {
        if (i) await page.keyboard.press('Shift+Enter');
        await page.keyboard.insertText(line);
      }
      await page.keyboard.press('Enter');
      // Chat clears the box once the message is accepted.
      await page.waitForFunction(() => !document.activeElement?.textContent?.trim(), undefined, { timeout: 10_000 });
      return json({ sent: true, space, thread: thread ?? null });
    }),
);

server.registerTool(
  'sign_in',
  {
    title: 'Sign in to Google Chat',
    description:
      'Open a visible Chrome window where the user signs in to their Google account. Call it when another tool reports that the user is not signed in. Waits up to 5 minutes and returns once Google Chat has loaded.',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  () =>
    serial(async () => {
      // The headless browser holds the profile lock, so close it before opening the visible one.
      await browserPage?.then((page) => page.context().close(), () => {});
      await signIn();
      return json({ signedIn: true });
    }),
);

await server.connect(new StdioServerTransport());
