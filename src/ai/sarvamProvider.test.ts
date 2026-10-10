import { describe, expect, it, vi } from 'vitest';

import type { AIProvider } from './provider.js';

describe('sarvamProvider', () => {
  it('implements the AIProvider contract', async () => {
    const { SarvamProvider } = await import('./sarvamProvider.js');

    const provider: AIProvider = new SarvamProvider({
      apiKey: 'test-api-key',
    });

    expect(provider.analyze).toBeTypeOf('function');
  });
  it('sends the review context to the Sarvam API', async () => {
    const { SarvamProvider } = await import('./sarvamProvider.js');

    const ssePayload = [
      `data: ${JSON.stringify({
        choices: [
          {
            delta: {
              content: JSON.stringify({
                valid: true,
                severity: 'low',
                confidence: 0.9,
                reason: 'The code is adequately sanitized.',
                recommendation: 'Keep the sanitization in place.',
              }),
            },
          },
        ],
      })}`,
      '',
      'data: [DONE]',
      '',
    ].join('\n');

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(ssePayload, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
        },
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    const provider = new SarvamProvider({
      apiKey: 'test-api-key',
    });

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
      imports: ["import sanitizeHTML from 'sanitize-html';"],
    };

    try {
      await provider.analyze(context);

      expect(fetchMock).toHaveBeenCalledOnce();

      const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('api.sarvam.ai');
      expect(options.method).toBe('POST');
      expect(new Headers(options.headers).get('api-subscription-key')).toBe(
        'test-api-key',
      );

      const body = JSON.parse(options.body as string);
      expect(JSON.stringify(body)).toContain(context.code);
      expect(JSON.stringify(body)).toContain(context.finding.message);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('handles an SSE event split across network chunks', async () => {
    const { SarvamProvider } = await import('./sarvamProvider.js');

    const expectedResult = {
      valid: true,
      severity: 'low',
      confidence: 0.9,
      reason: 'The code is adequately sanitized.',
      recommendation: 'Keep the sanitization in place.',
    };

    const event = `data: ${JSON.stringify({
      choices: [
        {
          delta: {
            content: JSON.stringify(expectedResult),
          },
        },
      ],
    })}\n\n`;

    const splitAt = Math.floor(event.length / 2);

    const chunks = [
      event.slice(0, splitAt),
      event.slice(splitAt),
      'data: [DONE]\n\n',
    ];

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            for (const chunk of chunks) {
              controller.enqueue(new TextEncoder().encode(chunk));
            }

            controller.close();
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
          },
        },
      ),
    );

    vi.stubGlobal('fetch', fetchMock);

    try {
      const provider = new SarvamProvider({
        apiKey: 'test-api-key',
      });

      const result = await provider.analyze({
        finding: {
          id: 'dangerous-html',
          category: 'security',
          severity: 'high',
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
        imports: ["import sanitizeHTML from 'sanitize-html';"],
      });

      expect(result).toEqual(expectedResult);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('throws when the Sarvam API returns an HTTP error', async () => {
    const { SarvamProvider } = await import('./sarvamProvider.js');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('Unauthorized', {
        status: 401,
        statusText: 'Unauthorized',
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    try {
      const provider = new SarvamProvider({
        apiKey: 'invalid-api-key',
      });

      await expect(
        provider.analyze({
          finding: {
            id: 'dangerous-html',
            category: 'security',
            severity: 'high',
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
          imports: [],
        }),
      ).rejects.toThrow('Sarvam API request failed: 401 Unauthorized');

      expect(fetchMock).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('throws when Sarvam returns malformed SSE JSON', async () => {
    const { SarvamProvider } = await import('./sarvamProvider.js');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('data: {invalid-json}\n\ndata: [DONE]\n\n', {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
        },
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    try {
      const provider = new SarvamProvider({
        apiKey: 'test-api-key',
      });

      await expect(
        provider.analyze({
          finding: {
            id: 'dangerous-html',
            category: 'security',
            severity: 'high',
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
          imports: [],
        }),
      ).rejects.toThrow('Sarvam API returned malformed SSE JSON');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('throws when the stream ends without a DONE marker', async () => {
    const { SarvamProvider } = await import('./sarvamProvider.js');
    const partialResult = {
      valid: true,
      severity: 'low',
      confidence: 0.9,
      reason: 'The code is adequately sanitized.',
      recommendation: 'Keep the sanitization in place.',
    };

    const event = `data: ${JSON.stringify({
      choices: [
        {
          delta: {
            content: JSON.stringify(partialResult),
          },
        },
      ],
    })}\n\n`;

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(event, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
        },
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    try {
      const provider = new SarvamProvider({
        apiKey: 'test-api-key',
      });

      await expect(
        provider.analyze({
          finding: {
            id: 'dangerous-html',
            category: 'security',
            severity: 'high',
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
          imports: [],
        }),
      ).rejects.toThrow('Sarvam SSE stream ended without a [DONE] marker');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('handles CRLF-delimited SSE events', async () => {
    const { SarvamProvider } = await import('./sarvamProvider.js');
    const expectedResult = {
      valid: true,
      severity: 'low',
      confidence: 0.9,
      reason: 'The code is adequately sanitized.',
      recommendation: 'Keep the sanitization in place.',
    };

    const chunks = [
      `data: ${JSON.stringify({
        choices: [
          {
            delta: {
              content: JSON.stringify(expectedResult),
            },
          },
        ],
      })}\r\n\r\n`,
      'data: [DONE]\r\n\r\n',
    ];

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(chunks.join(''), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

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
      imports: ["import sanitizeHTML from 'sanitize-html';"],
    };

    try {
      const provider = new SarvamProvider({ apiKey: 'test-api-key' });

      const result = await provider.analyze(context);

      expect(result).toEqual(expectedResult);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('rejects an AI result with confidence outside the valid range', async () => {
    const { SarvamProvider } = await import('./sarvamProvider.js');
    const invalidResult = {
      valid: true,
      severity: 'low',
      confidence: 1.5,
      reason: 'Looks fine.',
      recommendation: 'Keep the code.',
    };

    const ssePayload = [
      `data: ${JSON.stringify({
        choices: [
          {
            delta: {
              content: JSON.stringify(invalidResult),
            },
          },
        ],
      })}`,
      '',
      'data: [DONE]',
      '',
    ].join('\n');

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(ssePayload, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
        },
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    try {
      const provider = new SarvamProvider({
        apiKey: 'test-api-key',
      });

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
        imports: ["import sanitizeHTML from 'sanitize-html';"],
      };

      await expect(provider.analyze(context)).rejects.toThrow(
        'Sarvam returned an invalid AIResult',
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('rejects an AI result with an invalid severity', async () => {
    const { SarvamProvider } = await import('./sarvamProvider.js');
    const invalidResult = {
      valid: true,
      severity: 'critical',
      confidence: 0.9,
      reason: 'Looks fine.',
      recommendation: 'Keep the code.',
    };

    const ssePayload = [
      `data: ${JSON.stringify({
        choices: [
          {
            delta: {
              content: JSON.stringify(invalidResult),
            },
          },
        ],
      })}`,
      '',
      'data: [DONE]',
      '',
    ].join('\n');

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(ssePayload, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
        },
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    try {
      const provider = new SarvamProvider({
        apiKey: 'test-api-key',
      });

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
        imports: ["import sanitizeHTML from 'sanitize-html';"],
      };

      await expect(provider.analyze(context)).rejects.toThrow(
        'Sarvam returned an invalid AIResult',
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('cancels the stream when SSE parsing fails', async () => {
    const { SarvamProvider } = await import('./sarvamProvider.js');
    let cancelSpy: (reason?: unknown) => void;

    const fetchMock = vi.fn().mockImplementation(async () => {
      cancelSpy = vi.fn();

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode('data: {invalid-json}\n\n'),
          );
        },
        cancel: cancelSpy,
      });

      return new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
        },
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    try {
      const provider = new SarvamProvider({
        apiKey: 'test-api-key',
      });

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
        imports: [],
      };

      await expect(provider.analyze(context)).rejects.toThrow(
        'Sarvam API returned malformed SSE JSON',
      );

      expect(cancelSpy!).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
