
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

  function isDangerousString(node: ts.Expression): boolean {
    return (
      (ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node)) &&
      /^\s*javascript\s*:/i.test(node.text)
    );
  }
function findVisibleDeclaration(
  reference: ts.Identifier,
): ts.VariableDeclaration | undefined {
  let current: ts.Node | undefined = reference.parent;

  while (current) {
    if (ts.isBlock(current) || ts.isSourceFile(current)) {
      for (const statement of current.statements) {
        if (!ts.isVariableStatement(statement)) continue;

        for (const declaration of statement.declarationList.declarations) {
          if (
            ts.isIdentifier(declaration.name) &&
            declaration.name.text === reference.text &&
            declaration.initializer &&
            declaration.getStart(sourceFile) < reference.getStart(sourceFile)
          ) {
            return declaration;
          }
        }
      }
    }

    current = current.parent;
  }

  return undefined;
}


  function visit(node: ts.Node): void {
    if (
      ts.isJsxAttribute(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'href' &&
      node.initializer
    ) {
      let dangerous = false;

      if (ts.isStringLiteral(node.initializer)) {
        dangerous = /^\s*javascript\s*:/i.test(node.initializer.text);
      } else if (ts.isJsxExpression(node.initializer)) {
        const expression = node.initializer.expression;

        if (expression && ts.isIdentifier(expression)) {
          const declaration = findVisibleDeclaration(expression);

          dangerous = Boolean(
            declaration?.initializer &&
              isDangerousString(declaration.initializer),
          );
        }
      }

      if (dangerous) {
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
          message: 'JavaScript URLs in links can execute code when activated.',
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
