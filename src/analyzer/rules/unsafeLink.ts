import ts from 'typescript';
import type { Finding } from '../finding.js';
import type { Rule } from '../rule.js';
import { createSourceFile } from '../createSourceFile.js';

export const unsafeLinkRule: Rule = (file) => {
  const findings: Finding[] = [];
  const sourceFile = createSourceFile(file.path, file.content);

  function unwrapParentheses(node: ts.Expression): ts.Expression {
    let expression = node;

    while (ts.isParenthesizedExpression(expression)) {
      expression = expression.expression;
    }

    return expression;
  }

  function isDangerousString(node: ts.Expression): boolean {
    const expression = unwrapParentheses(node);

    if (
      !ts.isStringLiteral(expression) &&
      !ts.isNoSubstitutionTemplateLiteral(expression)
    ) {
      return false;
    }

    // The URL parser removes ASCII tabs and newlines before scheme parsing,
    // but an ordinary space inside the scheme makes it a different URL.
    const normalizedValue = expression.text.replace(/[\t\n\r]/g, '');

    return /^\s*javascript:/i.test(normalizedValue);
  }

  function bindingContainsName(
    bindingName: ts.BindingName,
    name: string,
  ): boolean {
    if (ts.isIdentifier(bindingName)) {
      return bindingName.text === name;
    }

    return bindingName.elements.some(
      (element) =>
        ts.isBindingElement(element) && bindingContainsName(element.name, name),
    );
  }

  function isFunctionLike(
    node: ts.Node,
  ): node is
    | ts.FunctionDeclaration
    | ts.FunctionExpression
    | ts.ArrowFunction
    | ts.MethodDeclaration
    | ts.ConstructorDeclaration
    | ts.GetAccessorDeclaration
    | ts.SetAccessorDeclaration {
    return (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isConstructorDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node)
    );
  }

  function findVisibleDeclaration(
    reference: ts.Identifier,
  ): ts.VariableDeclaration | undefined {
    let current: ts.Node | undefined = reference.parent;

    while (current) {
      if (ts.isBlock(current) || ts.isSourceFile(current)) {
        const declarations = current.statements.flatMap((statement) => {
          if (!ts.isVariableStatement(statement)) {
            return [];
          }

          return statement.declarationList.declarations.filter(
            (declaration) =>
              ts.isIdentifier(declaration.name) &&
              declaration.name.text === reference.text,
          );
        });

        if (declarations.length > 0) {
          const precedingDeclaration = declarations
            .filter(
              (declaration) =>
                declaration.getStart(sourceFile) <
                reference.getStart(sourceFile),
            )
            .at(-1);

          // A later declaration still shadows outer bindings in this scope.
          return precedingDeclaration;
        }
      }

      if (
        isFunctionLike(current) &&
        current.parameters.some((parameter) =>
          bindingContainsName(parameter.name, reference.text),
        )
      ) {
        // A parameter shadows same-named declarations in outer scopes.
        return undefined;
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
        dangerous = isDangerousString(node.initializer);
      } else if (
        ts.isJsxExpression(node.initializer) &&
        node.initializer.expression
      ) {
        const expression = unwrapParentheses(node.initializer.expression);

        if (isDangerousString(expression)) {
          dangerous = true;
        } else if (ts.isIdentifier(expression)) {
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
          evidence: file.content.split(/\r?\n/)[line]?.trim() ?? '',
          requiresAIReview: true,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
};
