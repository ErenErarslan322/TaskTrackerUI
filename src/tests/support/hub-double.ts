import { HubConnection, HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr';
import { vi } from 'vitest';

export function mockHub({ deferStart = false } = {}) {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  let reconnect: (() => void | Promise<void>) | undefined;
  const connection = {
    state: HubConnectionState.Connected,
    start: vi.fn(() => deferStart ? new Promise<void>(() => {}) : Promise.resolve()),
    invoke: vi.fn(async (_method: string, ..._args: unknown[]) => {}),
    stop: vi.fn(async () => {}),
    on: (event: string, handler: (...args: unknown[]) => void) => handlers.set(event, handler),
    onreconnected: (handler: () => void | Promise<void>) => { reconnect = handler; }
  };
  const build = vi.spyOn(HubConnectionBuilder.prototype, 'build')
    .mockReturnValue(connection as unknown as HubConnection);

  return {
    connection,
    build,
    emit(event: string, ...args: unknown[]) {
      const handler = handlers.get(event);
      if (!handler) throw new Error(`No handler registered for ${event}`);
      handler(...args);
    },
    reconnect: () => reconnect?.(),
    restore: () => build.mockRestore()
  };
}
