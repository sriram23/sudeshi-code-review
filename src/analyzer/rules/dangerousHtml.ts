import ts from 'typescript';
import type { Finding } from '../finding.js';
import type { SourceFile } from '../sourceFile.js';
import type { Rule } from '../rule.js';

export const dangerousHtmlRule: Rule = (file: SourceFile) => {
  const lines = file.content.split('\n');
  const findings: Finding[] = [];
  const sourceFile = ts.createSourceFile(
    file.path,
    file.content,
    ts.ScriptTarget.Latest,
    true,
    file.path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  function findDeclarationInScope(
    node: ts.Node,
    name: string,
  ): ts.VariableDeclaration | undefined {
    let current: ts.Node | undefined = node.parent;

    while (current) {
      if (ts.isBlock(current) || ts.isSourceFile(current)) {
        for (const statement of current.statements) {
          if (!ts.isVariableStatement(statement)) {
            continue;
          }

          for (const declaration of statement.declarationList.declarations) {
            if (
              ts.isIdentifier(declaration.name) &&
              declaration.name.text === name
            ) {
              return declaration;
            }
          }
        }
      }

      if (
        ts.isFunctionDeclaration(current) ||
        ts.isFunctionExpression(current) ||
        ts.isArrowFunction(current) ||
        ts.isMethodDeclaration(current)
      ) {
        // Inspect this function's body before crossing its scope boundary.
        if (current.body && ts.isBlock(current.body)) {
          for (const statement of current.body.statements) {
            if (!ts.isVariableStatement(statement)) {
              continue;
            }

            for (const declaration of statement.declarationList.declarations) {
              if (
                ts.isIdentifier(declaration.name) &&
                declaration.name.text === name
              ) {
                return declaration;
              }
            }
          }
        }

        return undefined;
      }

      current = current.parent;
    }

    return undefined;
  }

  function isStaticJsonLd(node: ts.JsxAttribute): boolean {
    const element = node.parent.parent;

    if (
      !ts.isJsxOpeningElement(element) &&
      !ts.isJsxSelfClosingElement(element)
    ) {
      return false;
    }

    if (
      !ts.isIdentifier(element.tagName) ||
      element.tagName.text !== 'script'
    ) {
      return false;
    }

    const typeAttribute = element.attributes.properties.find(
      (attribute): attribute is ts.JsxAttribute =>
        ts.isJsxAttribute(attribute) &&
        ts.isIdentifier(attribute.name) &&
        attribute.name.text === 'type',
    );

    if (
      !typeAttribute ||
      !typeAttribute.initializer ||
      !ts.isStringLiteral(typeAttribute.initializer) ||
      typeAttribute.initializer.text !== 'application/ld+json'
    ) {
      return false;
    }

    const initializer = node.initializer;

    if (
      !initializer ||
      !ts.isJsxExpression(initializer) ||
      !initializer.expression
    ) {
      return false;
    }

    const expression = initializer.expression;

    if (!ts.isObjectLiteralExpression(expression)) {
      return false;
    }

    const htmlProperty = expression.properties.find(
      (property): property is ts.PropertyAssignment =>
        ts.isPropertyAssignment(property) &&
        ((ts.isIdentifier(property.name) && property.name.text === '__html') ||
          (ts.isStringLiteral(property.name) &&
            property.name.text === '__html')),
    );

    if (!htmlProperty || !ts.isCallExpression(htmlProperty.initializer)) {
      return false;
    }

    const call = htmlProperty.initializer;

    if (
      !ts.isPropertyAccessExpression(call.expression) ||
      call.expression.name.text !== 'stringify' ||
      !ts.isIdentifier(call.expression.expression) ||
      call.expression.expression.text !== 'JSON' ||
      call.arguments.length !== 1
    ) {
      return false;
    }

    const argument = call.arguments[0];

    if (!argument || !ts.isIdentifier(argument)) {
      return false;
    }

    const declaration = findDeclarationInScope(node, argument.text);

    return Boolean(
      declaration &&
      declaration.initializer &&
      ts.isObjectLiteralExpression(declaration.initializer) &&
      declaration.initializer.properties.every(
        (property) =>
          ts.isPropertyAssignment(property) &&
          (ts.isStringLiteral(property.initializer)
            ? !/<\/script/i.test(property.initializer.text)
            : ts.isNumericLiteral(property.initializer) ||
              property.initializer.kind === ts.SyntaxKind.TrueKeyword ||
              property.initializer.kind === ts.SyntaxKind.FalseKeyword ||
              property.initializer.kind === ts.SyntaxKind.NullKeyword),
      ),
    );
  }

  function visit(node: ts.Node): void {
    if (
      ts.isJsxAttribute(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'dangerouslySetInnerHTML' &&
      !isStaticJsonLd(node)
    ) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(
        node.getStart(sourceFile),
      );

      findings.push({
        id: 'dangerous-html',
        category: 'security',
        severity: 'high',
        confidence: 1,
        file: file.path,
        line: line + 1,
        rule: 'dangerous-html',
        message: 'dangerouslySetInnerHTML is used',
        evidence: lines[line]?.trim() ?? '',
        requiresAIReview: true,
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
};
