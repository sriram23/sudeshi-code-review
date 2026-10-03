import type { Finding } from './finding.js';
import type { SourceFile } from './sourceFile.js';

export type Rule = (file: SourceFile) => Finding[];
