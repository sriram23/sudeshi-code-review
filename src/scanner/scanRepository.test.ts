import { describe, it, expect } from 'vitest';

import { scanRepository } from './scanRepository.js';

describe('scanRepository', () => {
  it('returns Typescript files from the repository', async () => {
    const files = await scanRepository('test-fixtures/basic');

    expect(files).toEqual(['src/App.tsx', 'src/index.ts', 'src/utils.js']);
  });
  it('throws when the repository path does not exist', async () => {
    await expect(
      scanRepository('test-fixtures/does-not-exist'),
    ).rejects.toThrow();
  });
  it('throws when the repository path is a file', async () => {
    await expect(
      scanRepository('test-fixtures/basic/src/index.ts'),
    ).rejects.toThrow();
  });
});
