import { existsSync, statSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { scanRepository as defaultScanRepository } from './scanner/scanRepository.js';
import type { Finding } from './analyzer/finding.js';
import type { SourceFile } from './analyzer/sourceFile.js';
import { analyze as defaultAnalyze } from './analyzer/analyze.js';
import { dangerousHtmlRule } from './analyzer/rules/dangerousHtml.js';
import { hardcodedSecretRule } from './analyzer/rules/hardcodedSecret.js';
import { unsafeLinkRule } from './analyzer/rules/unsafeLink.js';
import type { ReviewEngine as ReviewEngineType } from './review/reviewEngine.js';
import { generateMarkdownReport } from './reporting/markdownReporter.js';
import { SarvamProvider } from './ai/sarvamProvider.js';
import { ReviewEngine } from './review/reviewEngine.js';
import { generateJsonReport } from './reporting/jsonReporter.js';

type CLIDependencies = {
  scanRepository: typeof defaultScanRepository;
  analyze: (files: SourceFile[]) => Finding[];
  reviewEngine?: Pick<ReviewEngineType, 'review'>;
};

export async function runCLI(
  args: string[],
  dependencies: CLIDependencies = {
    scanRepository: defaultScanRepository,
    analyze: (files) =>
      defaultAnalyze(files, [
        dangerousHtmlRule,
        hardcodedSecretRule,
        unsafeLinkRule,
      ]),
  },
): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(
      [
        'Sudeshi Code Review',
        '',
        'Usage:',
        '  sudeshi-code-review <repository-path>',
        '',
        'Options:',
        '  -h, --help       Show this help message',
        '  -v, --version    Show the installed version',
        '  --format <format>  Report format: markdown or json (default: markdown)',
        '  --output <path>    Save the report to a file instead of stdout',
        '',
        'Environment:',
        '  SARVAM_API_KEY   Optional API key for AI-assisted review',
        '',
      ].join('\n'),
    );
    return;
  }

  if (args.includes('--version') || args.includes('-v')) {
    const packageJson = JSON.parse(
      await readFile(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { version: string };

    process.stdout.write(`${packageJson.version}\n`);
    return;
  }

  const formatIndex = args.indexOf('--format');
  const format = formatIndex === -1 ? 'markdown' : args[formatIndex + 1];

  if (formatIndex !== -1 && (!format || format.startsWith('--'))) {
    process.stderr.write('Error: --format requires a value.\n');
    process.exit(1);
    return;
  }

  if (format !== 'markdown' && format !== 'json') {
    process.stderr.write('Error: --format must be either markdown or json.\n');
    process.exit(1);
    return;
  }

  const outputIndex = args.indexOf('--output');
  const outputPath = outputIndex === -1 ? undefined : args[outputIndex + 1];

  if (outputIndex !== -1 && (!outputPath || outputPath.startsWith('--'))) {
    process.stderr.write('Error: --output requires a file path.\n');
    process.exit(1);
    return;
  }

  if (formatIndex !== -1 && (!format || format.startsWith('--'))) {
    process.stderr.write('Error: --format requires a value.\n');
    process.exit(1);
    return;
  }

  const repositoryPath = args[0];

  if (!repositoryPath) {
    process.stderr.write('Error: repository path is required.\n');
    process.exit(1);
    return;
  }

  const absolutePath = resolve(repositoryPath);

  if (!existsSync(absolutePath)) {
    process.stderr.write('Error: repository path does not exist.\n');
    process.exit(1);
    return;
  }

  if (!statSync(absolutePath).isDirectory()) {
    process.stderr.write('Error: repository path must be a directory.\n');
    process.exit(1);
    return;
  }

  const filePaths = await dependencies.scanRepository(absolutePath);

  const files: SourceFile[] = await Promise.all(
    filePaths.map(async (filePath) => ({
      path: filePath,
      content: await readFile(resolve(absolutePath, filePath), 'utf8'),
    })),
  );

  const findings = dependencies.analyze(files);

  const apiKey = process.env.SARVAM_API_KEY;

  const reviewEngine =
    dependencies.reviewEngine ??
    (apiKey
      ? new ReviewEngine({
          provider: new SarvamProvider({ apiKey }),
        })
      : undefined);

  const result = reviewEngine
    ? await reviewEngine.review({ files, findings })
    : {
        findings,
        filesScanned: files.length,
        durationMs: 0,
      };

  const report =
    format === 'json'
      ? generateJsonReport(result)
      : generateMarkdownReport(result);

  if (outputPath) {
    await writeFile(resolve(outputPath), `${report}\n`, 'utf8');
  } else {
    process.stdout.write(`${report}\n`);
  }
}
