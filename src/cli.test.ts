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
  it('writes a Markdown report without a ReviewEngine', async () => {
    const { mkdtempSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');

    const repositoryPath = mkdtempSync(join(tmpdir(), 'sudeshi-review-'));
    const writeOutput = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    const scanRepository = vi.fn().mockResolvedValue([]);
    const analyze = vi.fn().mockReturnValue([]);

    try {
      const { runCLI } = await import('./cli.js');

      await runCLI([repositoryPath], { scanRepository, analyze });

      expect(writeOutput).toHaveBeenCalledWith(
        expect.stringContaining('# Sudeshi Code Review'),
      );
    } finally {
      writeOutput.mockRestore();
      rmSync(repositoryPath, { recursive: true, force: true });
    }
  });

  it('uses AI review when SARVAM_API_KEY is configured', async () => {
    const { mkdtempSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');

    const repositoryPath = mkdtempSync(join(tmpdir(), 'sudeshi-review-'));
    const writeOutput = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    const originalApiKey = process.env.SARVAM_API_KEY;
    process.env.SARVAM_API_KEY = 'test-api-key';

    try {
      const { runCLI } = await import('./cli.js');

      const review = vi.fn().mockResolvedValue({
        findings: [],
        filesScanned: 0,
        durationMs: 1,
      });

      await runCLI([repositoryPath], {
        scanRepository: vi.fn().mockResolvedValue([]),
        analyze: vi.fn().mockReturnValue([]),
        reviewEngine: { review },
      });

      expect(review).toHaveBeenCalled();
    } finally {
      if (originalApiKey === undefined) {
        delete process.env.SARVAM_API_KEY;
      } else {
        process.env.SARVAM_API_KEY = originalApiKey;
      }

      writeOutput.mockRestore();
      rmSync(repositoryPath, { recursive: true, force: true });
    }
  });

  it('uses Sarvam AI when SARVAM_API_KEY is configured', async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');

    const repositoryPath = mkdtempSync(join(tmpdir(), 'sudeshi-review-'));
    writeFileSync(
      join(repositoryPath, 'config.ts'),
      "const apiKey = 'test-source-secret';",
    );

    const originalApiKey = process.env.SARVAM_API_KEY;
    process.env.SARVAM_API_KEY = 'test-sarvam-key';

    const response = {
      valid: true,
      severity: 'low',
      confidence: 0.9,
      reason: 'Reviewed the finding.',
      recommendation: 'Use an environment variable.',
    };

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        [
          `data: ${JSON.stringify({
            choices: [
              {
                delta: {
                  content: JSON.stringify(response),
                },
              },
            ],
          })}`,
          '',
          'data: [DONE]',
          '',
        ].join('\n'),
        {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
          },
        },
      ),
    );

    vi.stubGlobal('fetch', fetchMock);

    try {
      const { runCLI } = await import('./cli.js');

      await runCLI([repositoryPath]);

      expect(fetchMock).toHaveBeenCalledOnce();

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];

      expect(new Headers(options.headers).get('api-subscription-key')).toBe(
        'test-sarvam-key',
      );
    } finally {
      if (originalApiKey === undefined) {
        delete process.env.SARVAM_API_KEY;
      } else {
        process.env.SARVAM_API_KEY = originalApiKey;
      }

      vi.unstubAllGlobals();
      rmSync(repositoryPath, { recursive: true, force: true });
    }
  });
  it('does not call Sarvam AI when SARVAM_API_KEY is absent', async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');

    const repositoryPath = mkdtempSync(join(tmpdir(), 'sudeshi-review-'));

    const originalApiKey = process.env.SARVAM_API_KEY;
    delete process.env.SARVAM_API_KEY;

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    try {
      writeFileSync(
        join(repositoryPath, 'config.ts'),
        "const apiKey = 'test-source-secret';",
      );

      const { runCLI } = await import('./cli.js');
      await runCLI([repositoryPath]);

      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      if (originalApiKey === undefined) {
        delete process.env.SARVAM_API_KEY;
      } else {
        process.env.SARVAM_API_KEY = originalApiKey;
      }

      vi.unstubAllGlobals();
      rmSync(repositoryPath, { recursive: true, force: true });
    }
  });
  it('propagates Sarvam HTTP errors when AI review is configured', async () => {
    const { mkdtempSync, rmSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');

    const repositoryPath = mkdtempSync(join(tmpdir(), 'sudeshi-review-'));

    const originalApiKey = process.env.SARVAM_API_KEY;
    process.env.SARVAM_API_KEY = 'test-sarvam-key';

    const fetchMock = vi.fn().mockResolvedValue(
      new Response('Unauthorized', {
        status: 401,
        statusText: 'Unauthorized',
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    try {
      writeFileSync(
        join(repositoryPath, 'config.ts'),
        "const apiKey = 'test-source-secret';",
      );

      const { runCLI } = await import('./cli.js');

      await expect(runCLI([repositoryPath])).rejects.toThrow();

      expect(fetchMock).toHaveBeenCalledOnce();
    } finally {
      if (originalApiKey === undefined) {
        delete process.env.SARVAM_API_KEY;
      } else {
        process.env.SARVAM_API_KEY = originalApiKey;
      }

      vi.unstubAllGlobals();
      rmSync(repositoryPath, { recursive: true, force: true });
    }
  });
});
