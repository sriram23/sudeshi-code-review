import ts from 'typescript';
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

const SECRET_ASSIGNMENT_PATTERN = String.raw`\b([\w$]*(?:api[_-]?key|password|secret|client[_-]?secret|token|database[_-]?url))\s*(=|:)\s*(?:(['"])((?:\\.|[^\\])*?)\3|(\`)((?:\\.|(?!\$\{)[^\\])*?)\5)`;

function createSecretAssignmentRegex(global = false): RegExp {
  return new RegExp(SECRET_ASSIGNMENT_PATTERN, global ? 'gi' : 'i');
}

function extractSecretValue(evidence: string | undefined): string | undefined {
  const match = evidence?.match(createSecretAssignmentRegex());
  return match?.[4] ?? match?.[6];
}

export class ReviewEngine {
  constructor(private readonly config: ReviewEngineConfig) {}

  private redactHardcodedSecret(
    source: string,
    filePath = 'source.ts',
  ): string {
    const scriptKind = filePath.endsWith('.tsx')
      ? ts.ScriptKind.TSX
      : filePath.endsWith('.jsx')
        ? ts.ScriptKind.JSX
        : filePath.endsWith('.js')
          ? ts.ScriptKind.JS
          : ts.ScriptKind.TS;

    const sourceFile = ts.createSourceFile(
      filePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      scriptKind,
    );

    const secretNamePattern =
      /(?:api[_-]?key|password|secret|client[_-]?secret|token|database[_-]?url)/i;

    const edits: Array<{ start: number; end: number }> = [];

    function visit(node: ts.Node): void {
      let name: string | undefined;
      let initializer: ts.Expression | undefined;

      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
        name = node.name.text;
        initializer = node.initializer;
      } else if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name)) {
        name = node.name.text;
        initializer = node.initializer;
      }

      if (
        name &&
        secretNamePattern.test(name) &&
        initializer &&
        (ts.isStringLiteral(initializer) ||
          ts.isNoSubstitutionTemplateLiteral(initializer) ||
          ts.isTemplateExpression(initializer))
      ) {
        edits.push({
          start: initializer.getStart(sourceFile),
          end: initializer.getEnd(),
        });
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    let redactedSource = source;

    for (const edit of edits.sort((a, b) => b.start - a.start)) {
      redactedSource =
        redactedSource.slice(0, edit.start) +
        "'[REDACTED]'" +
        redactedSource.slice(edit.end);
    }

    return redactedSource;
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
          this.redactHardcodedSecret(sourceFile.content, sourceFile.path),
          finding,
        ),
      };

      const safeFinding = {
        ...finding,
        ...(finding.evidence !== undefined && {
          evidence: this.redactSecretValue(
            this.redactHardcodedSecret(finding.evidence, sourceFile.path),
            finding,
          ),
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
