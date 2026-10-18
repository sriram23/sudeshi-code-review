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
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      /^(apiKey|api_key|password|secret|clientSecret|client_secret|token)$/i.test(
        node.name.text,
      ) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer)
    ) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile),
      );
      const value = node.initializer.text;

      if (!value) return;

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
