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
const MINIMUM_GLOBAL_REDACTION_LENGTH = 4;
const REDACTION_SENTINEL = '\u0000SUDESHI_SECRET_REDACTION_SENTINEL_7F3A\u0000';

function createSecretAssignmentRegex(global = false): RegExp {
  return new RegExp(SECRET_ASSIGNMENT_PATTERN, global ? 'gi' : 'i');
}

function extractSecretValue(evidence: string | undefined): string | undefined {
  const match = evidence?.match(createSecretAssignmentRegex());
  return match?.[4] ?? match?.[6];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasStandaloneSecret(value: string, secret: string): boolean {
  if (!/^[\w$]+$/.test(secret)) {
    return value === secret;
  }

  const pattern = new RegExp(`(?<![\\w$])${escapeRegExp(secret)}(?![\\w$])`);

  return pattern.test(value);
}

function redactStandaloneSecret(value: string, secret: string): string {
  if (!/^[\w$]+$/.test(secret)) {
    return value === secret ? '[REDACTED]' : value;
  }

  if (secret.length === 1) {
    // A single character is too ambiguous to replace throughout prose/comments.
    return value === secret ? '[REDACTED]' : value;
  }

  const pattern = new RegExp(
    `(?<![\\w$])${escapeRegExp(secret)}(?![\\w$])`,
    'g',
  );

  return value
    .split(REDACTION_SENTINEL)
    .map((segment) => segment.replace(pattern, REDACTION_SENTINEL))
    .join(REDACTION_SENTINEL);
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

        // Keep both decoded and source spellings (e.g. escaped quotes).
        const rawValue = valueNode.getText(sourceFile).slice(1, -1);
        if (rawValue && rawValue !== '[REDACTED]') {
          secretValues.add(rawValue);
        }
      } else if (
        ts.isTemplateHead(valueNode) ||
        ts.isTemplateMiddle(valueNode) ||
        ts.isTemplateTail(valueNode)
      ) {
        // Static fragments inside interpolated templates can also be copied
        // into comments, messages, or other source locations.
        if (valueNode.text && valueNode.text !== '[REDACTED]') {
          secretValues.add(valueNode.text);
        }
      }

      // This also visits string literals nested inside template expressions.
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

    let redactedSource = source;

    // Replace the complete initializer, regardless of its length or syntax.
    for (const edit of edits.sort((a, b) => b.start - a.start)) {
      redactedSource =
        redactedSource.slice(0, edit.start) +
        "'" +
        REDACTION_SENTINEL +
        "'" +
        redactedSource.slice(edit.end);
    }

    // The detector's evidence may already be redacted. Preserve known literal
    // values and remove longer repeated occurrences elsewhere in AI-bound text.
    // Short values are handled separately with literal- and token-aware matching.
    const valuesToRedact = [...secretValues]
      .filter((value) => value.length >= MINIMUM_GLOBAL_REDACTION_LENGTH)
      .sort((a, b) => b.length - a.length);

    for (const value of valuesToRedact) {
      redactedSource = redactedSource
        .split(REDACTION_SENTINEL)
        .map((segment) => segment.replaceAll(value, REDACTION_SENTINEL))
        .join(REDACTION_SENTINEL);
    }

    // Short values need narrower handling: redact matching string literals and
    // bounded comment tokens instead of replacing arbitrary substrings in code.
    const shortValues = [...secretValues]
      .filter(
        (value) =>
          value.length > 0 && value.length < MINIMUM_GLOBAL_REDACTION_LENGTH,
      )
      .sort((a, b) => b.length - a.length);

    for (const value of shortValues) {
      redactedSource = this.redactShortSecretOccurrences(
        redactedSource,
        value,
        filePath,
      );
    }

    return redactedSource.replaceAll(REDACTION_SENTINEL, '[REDACTED]');
  }

  private redactShortSecretOccurrences(
    source: string,
    secret: string,
    filePath: string,
  ): string {
    const scriptKind = filePath.endsWith('.tsx')
      ? ts.ScriptKind.TSX
      : filePath.endsWith('.jsx')
        ? ts.ScriptKind.JSX
        : filePath.endsWith('.js')
          ? ts.ScriptKind.JS
          : ts.ScriptKind.TS;
    const languageVariant =
      scriptKind === ts.ScriptKind.TSX || scriptKind === ts.ScriptKind.JSX
        ? ts.LanguageVariant.JSX
        : ts.LanguageVariant.Standard;
    const sourceFile = ts.createSourceFile(
      filePath,
      source,
      ts.ScriptTarget.Latest,
      true,
      scriptKind,
    );
    const edits: Array<{
      start: number;
      end: number;
      replacement: string;
    }> = [];

    function visit(node: ts.Node): void {
      if (
        (ts.isStringLiteral(node) ||
          ts.isNoSubstitutionTemplateLiteral(node)) &&
        !node.text.includes(REDACTION_SENTINEL) &&
        hasStandaloneSecret(node.text, secret)
      ) {
        const raw = node.getText(sourceFile);
        const quote = raw[0] ?? "'";
        edits.push({
          start: node.getStart(sourceFile),
          end: node.getEnd(),
          replacement: `${quote}${REDACTION_SENTINEL}${quote}`,
        });
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    // Comments are trivia rather than AST nodes, so scan them separately. For
    // single-character values, skip comment-wide replacement to avoid erasing
    // ordinary prose; exact matching string literals are still handled above.
    if (secret.length >= 2 && /^[\w$]+$/.test(secret)) {
      const scanner = ts.createScanner(
        ts.ScriptTarget.Latest,
        false,
        languageVariant,
        source,
      );

      while (true) {
        const token = scanner.scan();
        if (token === ts.SyntaxKind.EndOfFileToken) {
          break;
        }

        if (
          token !== ts.SyntaxKind.SingleLineCommentTrivia &&
          token !== ts.SyntaxKind.MultiLineCommentTrivia
        ) {
          continue;
        }

        const comment = scanner.getTokenText();
        const redactedComment = redactStandaloneSecret(comment, secret);
        if (redactedComment !== comment) {
          edits.push({
            start: scanner.getTokenPos(),
            end: scanner.getTextPos(),
            replacement: redactedComment,
          });
        }
      }
    }

    let redactedSource = source;
    for (const edit of edits.sort((a, b) => b.start - a.start)) {
      redactedSource =
        redactedSource.slice(0, edit.start) +
        edit.replacement +
        redactedSource.slice(edit.end);
    }

    return redactedSource;
  }

  private redactKnownSecretValues(
    value: string,
    secretValues: Set<string>,
  ): string {
    let redactedValue = value;

    const valuesToRedact = [...secretValues]
      .filter((secret) => secret.length > 0)
      .sort((a, b) => b.length - a.length);

    for (const secret of valuesToRedact) {
      if (secret.length >= MINIMUM_GLOBAL_REDACTION_LENGTH) {
        redactedValue = redactedValue.replaceAll(secret, '[REDACTED]');
      } else if (secret.length >= 2 && /^[\w$]+$/.test(secret)) {
        const pattern = new RegExp(
          `(?<![\\w$])${escapeRegExp(secret)}(?![\\w$])`,
          'g',
        );
        redactedValue = redactedValue.replace(pattern, '[REDACTED]');
      } else if (redactedValue === secret) {
        // For one-character or punctuation-only values, only redact an exact
        // field match; broad replacement would have excessive false positives.
        redactedValue = '[REDACTED]';
      }
    }

    return redactedValue;
  }

  private redactSecretValue(source: string, finding: Finding): string {
    if (finding.rule !== 'hardcoded-secret') {
      return source;
    }

    const secret = extractSecretValue(finding.evidence);

    if (
      !secret ||
      secret === '[REDACTED]' ||
      secret.length < MINIMUM_GLOBAL_REDACTION_LENGTH
    ) {
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
      const secretFromEvidence = extractSecretValue(finding.evidence);

      if (secretFromEvidence && secretFromEvidence !== '[REDACTED]') {
        secretValues.add(secretFromEvidence);
      }

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
        file: this.redactKnownSecretValues(finding.file, secretValues),
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
        ...(finding.aiReview && {
          aiReview: {
            ...finding.aiReview,
            reason: this.redactKnownSecretValues(
              finding.aiReview.reason,
              secretValues,
            ),
            recommendation: this.redactKnownSecretValues(
              finding.aiReview.recommendation,
              secretValues,
            ),
          },
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
