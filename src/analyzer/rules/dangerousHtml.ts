import ts from 'typescript';
import type { Finding } from '../finding.js';
import type { SourceFile } from '../sourceFile.js';
import type { Rule } from '../rule.js';
import { createSourceFile } from '../createSourceFile.js';

export const dangerousHtmlRule: Rule = (file: SourceFile) => {
  const lines = file.content.split('\n');
  const findings: Finding[] = [];
  const sourceFile = createSourceFile(file.path, file.content);

  function bindingPatternContainsName(
    bindingName: ts.BindingName,
    name: string,
  ): boolean {
    if (ts.isIdentifier(bindingName)) {
      return bindingName.text === name;
    }

    return bindingName.elements.some(
      (element) =>
        ts.isBindingElement(element) &&
        bindingPatternContainsName(element.name, name),
    );
  }

  type FunctionLikeNode =
    | ts.FunctionDeclaration
    | ts.FunctionExpression
    | ts.ArrowFunction
    | ts.MethodDeclaration
    | ts.ConstructorDeclaration
    | ts.GetAccessorDeclaration
    | ts.SetAccessorDeclaration;

  function isFunctionLikeNode(node: ts.Node): node is FunctionLikeNode {
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

  function findFunctionScopedVarDeclaration(
    body: ts.Block,
    name: string,
  ): ts.VariableDeclaration | undefined {
    let result: ts.VariableDeclaration | undefined;

    function visit(node: ts.Node): void {
      if (result) {
        return;
      }

      // Nested functions and classes have their own scopes.
      if (
        node !== body &&
        (isFunctionLikeNode(node) ||
          ts.isClassDeclaration(node) ||
          ts.isClassExpression(node))
      ) {
        return;
      }

      if (
        ts.isVariableDeclaration(node) &&
        ts.isVariableDeclarationList(node.parent) &&
        (node.parent.flags & ts.NodeFlags.BlockScoped) === 0 &&
        bindingPatternContainsName(node.name, name)
      ) {
        result = node;
        return;
      }

      ts.forEachChild(node, visit);
    }

    visit(body);

    return result;
  }

  function findDeclarationInScope(
    node: ts.Node,
    name: string,
  ): ts.VariableDeclaration | undefined {
    let current: ts.Node | undefined = node.parent;

    while (current) {
      // Function parameters shadow declarations outside their function.
      if (
        ts.isBlock(current) &&
        isFunctionLikeNode(current.parent) &&
        current.parent.body === current &&
        current.parent.parameters.some((parameter) =>
          bindingPatternContainsName(parameter.name, name),
        )
      ) {
        return undefined;
      }

      // Check loop-scoped declarations.
      if (
        ts.isForStatement(current) ||
        ts.isForInStatement(current) ||
        ts.isForOfStatement(current)
      ) {
        const initializer = current.initializer;

        if (initializer && ts.isVariableDeclarationList(initializer)) {
          for (const declaration of initializer.declarations) {
            if (bindingPatternContainsName(declaration.name, name)) {
              return declaration;
            }
          }
        }
      }

      // Catch parameters shadow declarations outside the catch clause.
      if (
        ts.isCatchClause(current) &&
        current.variableDeclaration &&
        bindingPatternContainsName(current.variableDeclaration.name, name)
      ) {
        return undefined;
      }

      // Declarations in switch clauses share the switch statement's scope.
      if (ts.isCaseBlock(current)) {
        for (const clause of current.clauses) {
          for (const statement of clause.statements) {
            if (!ts.isVariableStatement(statement)) {
              continue;
            }

            for (const declaration of statement.declarationList.declarations) {
              if (bindingPatternContainsName(declaration.name, name)) {
                return declaration;
              }
            }
          }
        }
      }

      // Resolve declarations in the current block or module.
      if (ts.isBlock(current) || ts.isSourceFile(current)) {
        for (const statement of current.statements) {
          if (!ts.isVariableStatement(statement)) {
            continue;
          }

          for (const declaration of statement.declarationList.declarations) {
            if (bindingPatternContainsName(declaration.name, name)) {
              return declaration;
            }
          }
        }
      }

      if (isFunctionLikeNode(current)) {
        const isShadowedByParameter = current.parameters.some((parameter) =>
          bindingPatternContainsName(parameter.name, name),
        );

        if (isShadowedByParameter) {
          return undefined;
        }

        if (current.body && ts.isBlock(current.body)) {
          const declaration = findFunctionScopedVarDeclaration(
            current.body,
            name,
          );

          if (declaration) {
            return declaration;
          }
        }
      }

      // Continue outward to support closures and module-level declarations.
      current = current.parent;
    }

    return undefined;
  }

  function getAccessRootIdentifier(
    expression: ts.Expression,
  ): ts.Identifier | undefined {
    if (ts.isIdentifier(expression)) {
      return expression;
    }

    if (
      ts.isPropertyAccessExpression(expression) ||
      ts.isElementAccessExpression(expression) ||
      ts.isParenthesizedExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isTypeAssertionExpression(expression) ||
      ts.isNonNullExpression(expression)
    ) {
      return getAccessRootIdentifier(expression.expression);
    }

    return undefined;
  }

  function hasMutationOfDeclaration(
    declaration: ts.VariableDeclaration,
    name: string,
  ): boolean {
    let mutated = false;

    function referencesDeclaration(expression: ts.Expression): boolean {
      const root = getAccessRootIdentifier(expression);

      return Boolean(
        root &&
        root.text === name &&
        findDeclarationInScope(root, name) === declaration,
      );
    }

    function visit(node: ts.Node): void {
      if (mutated) {
        return;
      }

      // Assignment and compound assignment.
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
        referencesDeclaration(node.left)
      ) {
        mutated = true;
        return;
      }

      // Increment and decrement.
      if (
        (ts.isPrefixUnaryExpression(node) ||
          ts.isPostfixUnaryExpression(node)) &&
        (node.operator === ts.SyntaxKind.PlusPlusToken ||
          node.operator === ts.SyntaxKind.MinusMinusToken) &&
        referencesDeclaration(node.operand)
      ) {
        mutated = true;
        return;
      }

      // Property deletion.
      if (
        ts.isDeleteExpression(node) &&
        referencesDeclaration(node.expression)
      ) {
        mutated = true;
        return;
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    return mutated;
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

    // A destructured binding cannot be treated as the original static object.
    if (!declaration || !ts.isIdentifier(declaration.name)) {
      return false;
    }

    // Only trust const declarations for static JSON-LD.
    const declarationList = declaration.parent;

    if (
      !ts.isVariableDeclarationList(declarationList) ||
      (declarationList.flags & ts.NodeFlags.Const) === 0
    ) {
      return false;
    }

    // A const object can still have mutable properties.
    if (hasMutationOfDeclaration(declaration, argument.text)) {
      return false;
    }

    return Boolean(
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
        message:
          'dangerouslySetInnerHTML can introduce HTML injection when used with untrusted content. Prefer rendering content as React text, or sanitize HTML before inserting it into the DOM.',
        evidence: lines[line]?.trim() ?? '',
        requiresAIReview: true,
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
};
