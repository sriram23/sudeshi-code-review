import { describe, it, expect } from 'vitest';

import type { AIProvider } from './provider.js';

describe('AIProvider', () => {
  it('represents an AI provider', () => {
    const provider: AIProvider = {
      analyze: async () => ({
        valid: true,
        confidence: 0.9,
        reason: 'The finding is valid.',
        recommendation: 'Review the flagged code.',
      }),
    };

    expect(provider.analyze).toBeTypeOf('function');
  });
  it('analyzes a review context and returns a result', async () => {
    const context = {
      finding: {
        id: 'dangerous-html',
        category: 'security' as const,
        severity: 'high' as const,
        confidence: 1,
        file: 'src/Comment.tsx',
        line: 6,
        rule: 'dangerous-html',
        message: 'dangerouslySetInnerHTML is used',
        evidence: 'dangerouslySetInnerHTML',
        requiresAIReview: true,
      },
      code: 'return <div dangerouslySetInnerHTML={{ __html: html }} />;',
      startLine: 6,
      endLine: 6,
      imports: ["import React from 'react';"],
    };

    const provider: AIProvider = {
      analyze: async (receivedContext) => {
        expect(receivedContext).toEqual(context);

        return {
          valid: false,
          severity: 'high',
          confidence: 0.95,
          reason: 'Unsanitized HTML may lead to XSS.',
          recommendation: 'Sanitize the HTML before rendering it.',
        };
      },
    };

    const result = await provider.analyze(context);

    expect(result).toEqual({
      valid: false,
      severity: 'high',
      confidence: 0.95,
      reason: 'Unsanitized HTML may lead to XSS.',
      recommendation: 'Sanitize the HTML before rendering it.',
    });
  });
});
