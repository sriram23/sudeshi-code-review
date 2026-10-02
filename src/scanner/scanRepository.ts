import { readdir } from 'node:fs/promises';
import path from 'node:path';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const IGNORED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  'coverage',
]);

export async function scanRepository(
  repositoryPath: string,
): Promise<string[]> {
  const files: string[] = [];

  function toRelativePath(repositoryPath: string, filePath: string): string {
    const relativePath = path.relative(repositoryPath, filePath);
    return relativePath.replaceAll(path.sep, '/');
  }
  async function scanDirectory(directoryPath: string): Promise<void> {
    const entries = await readdir(directoryPath, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      const entryPath = path.join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        if (IGNORED_DIRECTORIES.has(entry.name)) {
          continue;
        }
        await scanDirectory(entryPath);
        continue;
      }
      if (entry.isFile()) {
        const extension = path.extname(entry.name);
        if (!SOURCE_EXTENSIONS.has(extension)) {
          continue;
        }
        files.push(toRelativePath(repositoryPath, entryPath));
      }
    }
  }

  await scanDirectory(repositoryPath);

  return files.sort();
}
