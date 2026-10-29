import { beforeEach } from 'vitest';

/**
 * A turn of the event loop before every test. The game's tests are synchronous loops, and a file of them (the fuzzer's
 * is near a minute) runs from one to the next on microtasks alone, so the worker never reads its message port: the
 * replies to its progress reports to the main thread wait there, and once a file has run for the sixty seconds of
 * Vitest's remote-call timeout the worker throws "Timeout calling onTaskUpdate" as an unhandled error, with every test
 * green. On this machine at a load of sixteen the fuzzer's file crossed the minute, and the unit tests failed with
 * nothing wrong. A macrotask between tests lets the port be read.
 */
beforeEach(() => new Promise<void>((resolve) => setImmediate(resolve)));
