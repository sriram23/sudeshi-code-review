import type { ReviewResult } from '../review/reviewEngine.js';

export function generateJsonReport(result: ReviewResult): string {
  return JSON.stringify(result, null, 2);
}
