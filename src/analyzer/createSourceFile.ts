import ts from 'typescript';

/**
 * Create an AST using the language variant appropriate for the input file.
 *
 * JavaScript files use JSX parsing so React code that keeps JSX in `.js` files
 * is analyzed as well. TypeScript's JSX variant is reserved for `.tsx`.
 */
export function createSourceFile(
  filePath: string,
  content: string,
): ts.SourceFile {
  const extension = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();

  const scriptKind =
    extension === '.tsx'
      ? ts.ScriptKind.TSX
      : extension === '.jsx' || extension === '.js'
        ? ts.ScriptKind.JSX
        : ts.ScriptKind.TS;

  return ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
}
