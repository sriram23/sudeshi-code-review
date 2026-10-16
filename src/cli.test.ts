import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { Finding } from './analyzer/finding.js';

describe('CLI', () => {
  it('requires a repository path', async () => {
    const writeError = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);

    try {
      const { runCLI } = await import('./cli.js');

      await expect(() => runCLI([])).rejects.toThrow('process.exit called');
      expect(writeError).toHaveBeenCalledWith(
        expect.stringContaining('repository path'),
      );
      expect(exit).toHaveBeenCalledWith(1);
    } finally {
      writeError.mockRestore();
      exit.mockRestore();
    }
  });
  it('accepts a repository path', async () => {
    const repositoryPath = mkdtempSync(join(tmpdir(), 'sudeshi-review-'));

    const writeError = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);

    try {
      const { runCLI } = await import('./cli.js');

      await expect(runCLI([repositoryPath])).resolves.toBeUndefined();
      expect(writeError).not.toHaveBeenCalled();
      expect(exit).not.toHaveBeenCalled();
    } finally {
      writeError.mockRestore();
      exit.mockRestore();
      rmSync(repositoryPath, { recursive: true, force: true });
    }
  });
  it('reports an error when the repository path does not exist', async () => {
    const writeError = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);

    try {
      const { runCLI } = await import('./cli.js');

      await expect(() =>
        runCLI(['./this-path-should-not-exist-12345']),
      ).rejects.toThrow('process.exit called');
      expect(writeError).toHaveBeenCalledWith(
        expect.stringContaining('does not exist'),
      );
      expect(exit).toHaveBeenCalledWith(1);
    } finally {
      writeError.mockRestore();
      exit.mockRestore();
    }
  });
  it('rejects a file path instead of a directory', async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');

    const repositoryPath = mkdtempSync(join(tmpdir(), 'sudeshi-review-'));
    const filePath = join(repositoryPath, 'package.json');
    writeFileSync(filePath, '{}');

    const writeError = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);

    try {
      const { runCLI } = await import('./cli.js');

      await expect(() => runCLI([filePath])).rejects.toThrow(
        'process.exit called',
      );
      expect(writeError).toHaveBeenCalledWith(
        expect.stringContaining('must be a directory'),
      );
      expect(exit).toHaveBeenCalledWith(1);
    } finally {
      writeError.mockRestore();
      exit.mockRestore();
      rmSync(repositoryPath, { recursive: true, force: true });
    }
  });
  it('scans the repository when given a valid directory', async () => {
    const { mkdtempSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');

    const repositoryPath = mkdtempSync(join(tmpdir(), 'sudeshi-review-'));
    const scanRepository = vi.fn().mockReturnValue([]);
    const analyze = vi.fn().mockReturnValue([]);

    try {
      const { runCLI } = await import('./cli.js');

      runCLI([repositoryPath], {
        scanRepository,
        analyze,
      });

      expect(scanRepository).toHaveBeenCalledWith(resolve(repositoryPath));
      // expect(scanRepository).toHaveBeenCalledWith(repositoryPath);
    } finally {
      rmSync(repositoryPath, { recursive: true, force: true });
    }
  });
  it('analyzes the files returned by the scanner', async () => {
    const { mkdtempSync, mkdirSync, rmSync, writeFileSync } =
      await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');

    const repositoryPath = mkdtempSync(join(tmpdir(), 'sudeshi-review-'));
    const sourceContent = 'const value = 1;';

    mkdirSync(join(repositoryPath, 'src'));
    writeFileSync(join(repositoryPath, 'src', 'example.ts'), sourceContent);

    const files = [
      {
        path: 'src/example.ts',
        content: sourceContent,
      },
    ];

    const scanRepository = vi.fn().mockResolvedValue(['src/example.ts']);
    const analyze = vi.fn().mockReturnValue([]);

    try {
      const { runCLI } = await import('./cli.js');

      await runCLI([repositoryPath], { scanRepository, analyze });

      expect(analyze).toHaveBeenCalledWith(files);
    } finally {
      rmSync(repositoryPath, { recursive: true, force: true });
    }
  });
  it('passes the analyzer findings to the ReviewEngine', async () => {
    const { mkdtempSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');

    const repositoryPath = mkdtempSync(join(tmpdir(), 'sudeshi-review-'));
    // const finding = {
    //   ruleId: 'dangerous-html',
    //   file: 'src/example.ts',
    //   message: 'Potentially dangerous HTML',
    //   severity: 'high',
    //   line: 1,
    //   requiresAIReview: false,
    // } as Finding;

    const finding: Finding = {
      id: 'finding-1',
      category: 'security',
      severity: 'high',
      confidence: 1,
      file: 'src/example.ts',
      line: 1,
      rule: 'dangerous-html',
      message: 'Potentially dangerous HTML',
      requiresAIReview: false,
    };

    const scanRepository = vi.fn().mockResolvedValue([]);
    const analyze = vi.fn().mockReturnValue([finding]);
    const review = vi.fn().mockResolvedValue({
      findings: [finding],
      filesScanned: 0,
      durationMs: 1,
    });

    try {
      const { runCLI } = await import('./cli.js');

      await runCLI([repositoryPath], {
        scanRepository,
        analyze,
        reviewEngine: { review },
      });

      expect(review).toHaveBeenCalledWith({
        files: [],
        findings: [finding],
      });
    } finally {
      rmSync(repositoryPath, { recursive: true, force: true });
    }
  });
  it('writes the Markdown report to stdout after review', async () => {
    const { mkdtempSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');

    const repositoryPath = mkdtempSync(join(tmpdir(), 'sudeshi-review-'));
    const writeOutput = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    const scanRepository = vi.fn().mockResolvedValue([]);
    const analyze = vi.fn().mockReturnValue([]);
    const reviewEngine = {
      review: vi.fn().mockResolvedValue({
        findings: [],
        filesScanned: 0,
        durationMs: 1,
      }),
    };

    try {
      const { runCLI } = await import('./cli.js');

      await runCLI([repositoryPath], {
        scanRepository,
        analyze,
        reviewEngine,
      });

      expect(writeOutput).toHaveBeenCalledWith(
        expect.stringContaining('# Sudeshi Code Review'),
      );
    } finally {
      writeOutput.mockRestore();
      rmSync(repositoryPath, { recursive: true, force: true });
    }
  });
});
