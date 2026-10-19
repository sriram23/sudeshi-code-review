import ts from 'typescript';
import type { Finding } from '../finding.js';
import type { Rule } from '../rule.js';

export const hardcodedSecretRule: Rule = (file) => {
  const findings: Finding[] = [];
  const sourceFile = ts.createSourceFile(
    file.path,
    file.content,
    ts.ScriptTarget.Latest,
    true,
    file.path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  function visit(node: ts.Node): void {
    const secretNamePattern =
      /^(apiKey|api_key|paymentApiKey|accessToken|access_token|internalToken|internal_token|databaseUrl|database_url|password|secret|clientSecret|client_secret|token)$/i;

    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      secretNamePattern.test(node.name.text) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer)
    ) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile),
      );
      const value = node.initializer.text;

      if (value) {
        findings.push({
          id: 'hardcoded-secret',
          category: 'security',
          severity: 'high',
          confidence: 1,
          file: file.path,
          line: line + 1,
          rule: 'hardcoded-secret',
          message: 'A hardcoded secret may be present',
          evidence: file.content.split('\n')[line]?.trim() ?? '',
          requiresAIReview: true,
        });
      }
    }

    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      secretNamePattern.test(node.name.text) &&
      ts.isStringLiteral(node.initializer)
    ) {
      const propertyName = node.name.text;
      const value = node.initializer.text;

      if (!value) {
        ts.forEachChild(node, visit);
        return;
      }

      if (
        /^(databaseUrl|database_url)$/i.test(propertyName) &&
        !/^[a-z][a-z0-9+.-]*:\/\/[^/@:]+:[^/@]+@/i.test(value)
      ) {
        ts.forEachChild(node, visit);
        return;
      }

      const { line } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile),
      );

      findings.push({
        id: 'hardcoded-secret',
        category: 'security',
        severity: 'high',
        confidence: 1,
        file: file.path,
        line: line + 1,
        rule: 'hardcoded-secret',
        message: 'A hardcoded secret may be present',
        evidence: file.content.split('\n')[line]?.trim() ?? '',
        requiresAIReview: true,
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
};
