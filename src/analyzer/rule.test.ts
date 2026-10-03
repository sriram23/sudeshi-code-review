import { describe, expect, it } from 'vitest';

import type { Rule } from './rule.js';

describe('Rule', () => {
  it('represents an analysis rule', () => {
    const rule: Rule = () => {
      return [];
    };

    expect(rule).toBeTypeOf('function');
  });
});
