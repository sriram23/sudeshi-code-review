import ts from 'typescript';
import type { Rule } from '../rule.js';
import { createSourceFile } from '../createSourceFile.js';

const SECRET_NAME_PATTERN =
  /^(apiKey|api_key|paymentApiKey|accessToken|access_token|internalToken|internal_token|databaseUrl|database_url|password|secret|clientSecret|client_secret|token)$/i;

type StaticSecretLiteral = ts.StringLiteral | ts.NoSubstitutionTemplateLiteral;

type SecretOccurrence = {
  line: number;
  literal: StaticSecretLiteral;
};

function isStaticSecretString(
  node: ts.Expression,
): node is StaticSecretLiteral {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

function getStaticPropertyName(name: ts.PropertyName): string | undefined {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNoSubstitutionTemplateLiteral(name)
  ) {
    return name.text;
  }

  if (
    ts.isComputedPropertyName(name) &&
    isStaticSecretString(name.expression)
  ) {
    return name.expression.text;
  }

  return undefined;
}

function isCredentialedDatabaseUrl(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\/[^/@:]+:[^/@]+@/i.test(value);
}

function shouldReportSecret(name: string, value: string): boolean {
  if (!value) {
    return false;
  }

  if (
    /^(databaseUrl|database_url)$/i.test(name) &&
    !isCredentialedDatabaseUrl(value)
  ) {
    return false;
  }

  return true;
}

export const hardcodedSecretRule: Rule = (file) => {
  const sourceFile = createSourceFile(file.path, file.content);
  const sourceLines = file.content.split(/\r?\n/);
  const occurrences: SecretOccurrence[] = [];
  const staticLiterals: SecretOccurrence[] = [];

  function getLine(node: ts.Node): number {
    return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
      .line;
  }

  function addOccurrence(literal: StaticSecretLiteral): void {
    occurrences.push({ line: getLine(literal), literal });
  }

  function visit(node: ts.Node): void {
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      node.text
    ) {
      staticLiterals.push({ line: getLine(node), literal: node });
    }

    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      SECRET_NAME_PATTERN.test(node.name.text) &&
      node.initializer &&
      isStaticSecretString(node.initializer) &&
      shouldReportSecret(node.name.text, node.initializer.text)
    ) {
      addOccurrence(node.initializer);
    }

    if (ts.isPropertyAssignment(node)) {
      const propertyName = getStaticPropertyName(node.name);

      if (
        propertyName &&
        SECRET_NAME_PATTERN.test(propertyName) &&
        isStaticSecretString(node.initializer) &&
        shouldReportSecret(propertyName, node.initializer.text)
      ) {
        addOccurrence(node.initializer);
      }
    }

    ts.forEachChild(node, visit);
  }

  function redactEvidence(line: number): string {
    let evidence = sourceLines[line] ?? '';

    const secretValues = new Set(
      occurrences
        .filter((occurrence) => occurrence.line === line)
        .map(({ literal }) => literal.text),
    );

    const literalsToRedact = staticLiterals
      .filter(
        (occurrence) =>
          occurrence.line === line && secretValues.has(occurrence.literal.text),
      )
      .sort(
        (left, right) =>
          right.literal.getStart(sourceFile) -
          left.literal.getStart(sourceFile),
      );

    const lineStart = sourceFile.getPositionOfLineAndCharacter(line, 0);
    const lineEnd = lineStart + evidence.length;

    for (const { literal } of literalsToRedact) {
      const literalStart = literal.getStart(sourceFile);
      const literalEnd = literal.getEnd();
      const start = Math.max(literalStart, lineStart) - lineStart;
      const end = Math.min(literalEnd, lineEnd) - lineStart;

      if (start >= end) {
        continue;
      }

      const quote = literal.getText(sourceFile)[0] ?? "'";
      evidence =
        evidence.slice(0, start) +
        `${quote}[REDACTED]${quote}` +
        evidence.slice(end);
    }

    return evidence.trim();
  }

  visit(sourceFile);

  return occurrences.map(({ line }) => ({
    id: 'hardcoded-secret',
    category: 'security',
    severity: 'high',
    confidence: 1,
    file: file.path,
    line: line + 1,
    rule: 'hardcoded-secret',
    message: 'A hardcoded secret may be present',
    evidence: redactEvidence(line),
    requiresAIReview: true,
  }));
};
