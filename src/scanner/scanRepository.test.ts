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
  it('excludes test files from the repository scan', async () => {
    const files = await scanRepository('test-fixtures/basic');

    expect(files).not.toContain('src/analyzer/rules/dangerousHtml.test.ts');
  });
  it('excludes test files while keeping regular source files', async () => {
    const files = await scanRepository('test-fixtures/exclude-tests');

    expect(files).toEqual(['src/App.tsx']);
  });
});
