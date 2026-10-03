import { describe, it, expect } from 'vitest';

import type { Finding } from './finding.js';

describe('Finding', () => {
  it('represents a review finding', () => {
    const finding: Finding = {
      id: 'dangerous-html',
      category: 'security',
      severity: 'high',
      confidence: 1,
      file: 'src/Comment.tsx',
      line: 10,
      rule: 'dangerous-html',
      message: 'dangerouslySetInnerHTML is used',
      evidence: 'dangerouslySetInnerHTML={{ __html: comment }}',
      requiresAIReview: true,
    };

    expect(finding).toEqual({
      id: 'dangerous-html',
      category: 'security',
      severity: 'high',
      confidence: 1,
      file: 'src/Comment.tsx',
      line: 10,
      rule: 'dangerous-html',
      message: 'dangerouslySetInnerHTML is used',
      evidence: 'dangerouslySetInnerHTML={{ __html: comment }}',
      requiresAIReview: true,
    });
  });
});
