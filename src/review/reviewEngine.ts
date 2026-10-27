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
    collectedSecretValues?: Set<string>,
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
    const secretValues = collectedSecretValues ?? new Set<string>();

    function collectSecretValueParts(valueNode: ts.Node): void {
      if (
        ts.isStringLiteral(valueNode) ||
        ts.isNoSubstitutionTemplateLiteral(valueNode)
      ) {
        if (valueNode.text && valueNode.text !== '[REDACTED]') {
          secretValues.add(valueNode.text);
        }

        const rawValue = valueNode.getText(sourceFile).slice(1, -1);
        if (rawValue && rawValue !== '[REDACTED]') {
          secretValues.add(rawValue);
        }
      }

      // Recursing also finds hardcoded literals inside template expressions.
      ts.forEachChild(valueNode, collectSecretValueParts);
    }

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
        collectSecretValueParts(initializer);
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    const redactionToken = '\u0000SUDESHI_SECRET_REDACTED\u0000';
    let redactedSource = source;

    for (const edit of edits.sort((a, b) => b.start - a.start)) {
      redactedSource =
        redactedSource.slice(0, edit.start) +
        "'" +
        redactionToken +
        "'" +
        redactedSource.slice(edit.end);
    }

    // The rule's evidence may already contain [REDACTED]. Collect literal
    // values from the source so duplicate occurrences cannot bypass redaction.
    const valuesToRedact = [...secretValues]
      .filter((value) => value.length >= 4)
      .sort((a, b) => b.length - a.length);

    for (const value of valuesToRedact) {
      redactedSource = redactedSource
        .split(redactionToken)
        .map((segment) => segment.replaceAll(value, redactionToken))
        .join(redactionToken);
    }

    return redactedSource.replaceAll(redactionToken, '[REDACTED]');
  }

  private redactKnownSecretValues(
    value: string,
    secretValues: Set<string>,
  ): string {
    let redactedValue = value;

    const valuesToRedact = [...secretValues]
      .filter((secret) => secret.length >= 4 && secret !== '[REDACTED]')
      .sort((a, b) => b.length - a.length);

    for (const secret of valuesToRedact) {
      redactedValue = redactedValue.replaceAll(secret, '[REDACTED]');
    }

    return redactedValue;
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

      const secretValues = new Set<string>();

      const safeSourceFile = {
        ...sourceFile,
        content: this.redactSecretValue(
          this.redactHardcodedSecret(
            sourceFile.content,
            sourceFile.path,
            secretValues,
          ),
          finding,
        ),
      };

      const safeFinding = {
        ...finding,
        message: this.redactKnownSecretValues(finding.message, secretValues),
        ...(finding.evidence !== undefined && {
          evidence: this.redactKnownSecretValues(
            this.redactSecretValue(
              this.redactHardcodedSecret(
                finding.evidence,
                sourceFile.path,
                secretValues,
              ),
              finding,
            ),
            secretValues,
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
