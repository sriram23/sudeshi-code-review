import { afterEach, describe, expect, it, vi } from 'vitest';

describe('CLI entry point', () => {
  afterEach(() => {
    vi.doUnmock('./cli.js');
    vi.resetModules();
  });

  it('invokes runCLI with the process arguments', async () => {
    const runCLI = vi.fn().mockResolvedValue(undefined);

    vi.doMock('./cli.js', () => ({ runCLI }));

    await import('./index.js');

    expect(runCLI).toHaveBeenCalledWith(process.argv.slice(2));
  });
});
