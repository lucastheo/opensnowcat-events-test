import { afterEach, describe, expect, it, vi } from 'vitest';

const config = { port: 1234, host: '1.2.3.4', corsOrigin: '*', csvFilePath: '/x.csv', logLevel: 'silent' };

async function load(listen: () => Promise<string>) {
  vi.resetModules();
  const log = { info: vi.fn(), error: vi.fn() };
  const app = { listen: vi.fn(listen), log };
  const buildApp = vi.fn(async () => app);
  vi.doMock('../../src/config/env.js', () => ({ loadConfig: () => config }));
  vi.doMock('../../src/app.js', () => ({ buildApp }));
  await import('../../src/index.js');
  await new Promise((r) => setTimeout(r, 10));
  return { app, buildApp, log };
}

describe('index entrypoint', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock('../../src/config/env.js');
    vi.doUnmock('../../src/app.js');
  });

  it('builds the app and listens on configured host/port', async () => {
    const { app, buildApp, log } = await load(async () => 'http://1.2.3.4:1234');
    expect(buildApp).toHaveBeenCalledWith(config);
    expect(app.listen).toHaveBeenCalledWith({ port: 1234, host: '1.2.3.4' });
    expect(log.info).toHaveBeenCalledTimes(2);
  });

  it('logs and exits(1) when listen fails', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const err = new Error('in use');
    const { log } = await load(async () => { throw err; });
    expect(log.error).toHaveBeenCalledWith(err);
    expect(exit).toHaveBeenCalledWith(1);
  });
});
