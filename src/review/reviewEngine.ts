import type { AIProvider } from '../ai/provider.js';
import type { Finding } from '../analyzer/finding.js';
import type { SourceFile } from '../analyzer/sourceFile.js';
import { buildContext } from '../context/buildContext.js';

export type ReviewResult = {
  findings: Finding[];
  filesScanned: number;
  durationMs: number;
};

type ReviewEngineConfig = {
  provider: AIProvider;
};

type ReviewInput = {
  files: SourceFile[];
  findings: Finding[];
};

export class ReviewEngine {
  constructor(private readonly config: ReviewEngineConfig) {}

  async review(input: ReviewInput): Promise<ReviewResult> {
    const startTime = performance.now();

    const findings = input.findings.map((finding) => ({ ...finding }));

    for (const finding of findings) {
      if (!finding.requiresAIReview) {
        continue;
      }

      const sourceFile = input.files.find((file) => file.path === finding.file);

      if (!sourceFile) {
        continue;
      }

      const context = buildContext(sourceFile, finding);
      const aiResult = await this.config.provider.analyze({
        ...context,
        finding: { ...context.finding },
      });

      finding.aiReview = {
        valid: aiResult.valid,
        ...(aiResult.severity !== undefined && { severity: aiResult.severity }),
        confidence: aiResult.confidence,
        reason: aiResult.reason,
        recommendation: aiResult.recommendation,
      };
    }

    return {
      findings,
      filesScanned: input.files.length,
      durationMs: performance.now() - startTime,
    };
  }
}
