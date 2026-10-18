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

const SECRET_ASSIGNMENT_PATTERN = String.raw`\b(apiKey|api_key|password|secret|clientSecret|client_secret|token)\s*=\s*(['"])(.*?)\2`;

function createSecretAssignmentRegex(global = false): RegExp {
  return new RegExp(SECRET_ASSIGNMENT_PATTERN, global ? 'g' : undefined);
}

function extractSecretValue(evidence: string | undefined): string | undefined {
  return evidence?.match(createSecretAssignmentRegex())?.[3];
}

export class ReviewEngine {
  constructor(private readonly config: ReviewEngineConfig) {}

  private redactHardcodedSecret(source: string): string {
    return source.replace(
      createSecretAssignmentRegex(true),
      (_match, name: string, quote: string) =>
        `${name} = ${quote}{REDACTED}${quote}`,
    );
  }

  private redactSecretValue(source: string, finding: Finding): string {
    if (finding.rule !== 'hardcoded-secret') {
      return source;
    }

    const secret = extractSecretValue(finding.evidence);

    if (!secret) {
      return source;
    }

    return source.replaceAll(secret, '[REDACTED]');
  }

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

      if (
        finding.rule === 'hardcoded-secret' &&
        !extractSecretValue(finding.evidence)
      ) {
        continue;
      }

      const safeSourceFile = {
        ...sourceFile,
        content: this.redactSecretValue(
          this.redactHardcodedSecret(sourceFile.content),
          finding,
        ),
      };

      const safeFinding = {
        ...finding,
        ...(finding.evidence !== undefined && {
          evidence: this.redactHardcodedSecret(finding.evidence),
        }),
      };

      const context = buildContext(safeSourceFile, safeFinding);
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
