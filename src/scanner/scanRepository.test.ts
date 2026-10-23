import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

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
  it('ignores virtual environments and generated/dependency directories', async () => {
    const repositoryPath = await mkdtemp(path.join(tmpdir(), 'sudeshi-scan-'));

    try {
      const includedFiles = ['src/App.tsx', 'src/utils.ts'];
      const ignoredFiles = [
        '.venv/Lib/site-packages/pkg/index.js',
        'venv/lib/pkg/index.js',
        'env/lib/pkg/index.js',
        '.tox/pkg/index.js',
        '__pycache__/module.js',
        '.pytest_cache/cache.js',
        '.mypy_cache/cache.js',
        '.ruff_cache/cache.js',
        'node_modules/pkg/index.js',
        'dist/index.js',
        'build/index.js',
        '.next/static/chunk.js',
        'coverage/report.js',
        '.turbo/cache.js',
        '.output/server/index.js',
        'vendor/pkg/index.js',
      ];

      for (const file of [...includedFiles, ...ignoredFiles]) {
        const absolutePath = path.join(repositoryPath, file);
        await mkdir(path.dirname(absolutePath), { recursive: true });
        await writeFile(absolutePath, '// fixture');
      }

      const files = await scanRepository(repositoryPath);

      expect(files).toEqual(includedFiles);
    } finally {
      await rm(repositoryPath, { recursive: true, force: true });
    }
  });
});
