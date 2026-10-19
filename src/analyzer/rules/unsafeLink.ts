
import ts from 'typescript';
import type { Finding } from '../finding.js';
import type { Rule } from '../rule.js';

export const unsafeLinkRule: Rule = (file) => {
  const findings: Finding[] = [];

  const sourceFile = ts.createSourceFile(
    file.path,
    file.content,
    ts.ScriptTarget.Latest,
    true,
    file.path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const dangerousVariables = new Set<string>();

  function collectDangerousVariables(node: ts.Node): void {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer) &&
      /^\s*javascript\s*:/i.test(node.initializer.text)
    ) {
      dangerousVariables.add(node.name.text);
    }

    ts.forEachChild(node, collectDangerousVariables);
  }

  collectDangerousVariables(sourceFile);

  function visit(node: ts.Node): void {
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText(sourceFile) === 'href' &&
      node.initializer
    ) {
      let isDangerous = false;

      if (ts.isStringLiteral(node.initializer)) {
        isDangerous = /^\s*javascript\s*:/i.test(
          node.initializer.text,
        );
      } else if (ts.isJsxExpression(node.initializer)) {
        const expression = node.initializer.expression;

        if (
          expression &&
          ts.isIdentifier(expression) &&
          dangerousVariables.has(expression.text)
        ) {
          isDangerous = true;
        }
      }

      if (isDangerous) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile),
        );

        findings.push({
          id: 'unsafe-link',
          category: 'security',
          severity: 'high',
          confidence: 1,
          file: file.path,
          line: line + 1,
          rule: 'unsafe-link',
          message:
            'JavaScript URLs in links can execute code when activated.',
          evidence: file.content.split('\n')[line]?.trim() ?? '',
          requiresAIReview: true,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
};
