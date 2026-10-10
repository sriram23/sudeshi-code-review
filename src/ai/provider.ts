import type { ReviewContext } from '../context/buildContext.js';

export type AIResult = {
  valid: boolean;
  severity?: 'low' | 'medium' | 'high';
  confidence: number;
  reason: string;
  recommendation: string;
};

export interface AIProvider {
  analyze(context: ReviewContext): Promise<AIResult>;
}
