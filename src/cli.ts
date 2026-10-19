import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
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

  const report = generateMarkdownReport(result);
  process.stdout.write(`${report}\n`);
}
