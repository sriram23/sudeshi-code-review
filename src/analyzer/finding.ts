export type Finding = {
  id: string;
  category: 'security' | 'correctness' | 'performance';
  severity: 'low' | 'medium' | 'high';
  confidence: number;
  file: string;
  line: number;
  rule: string;
  message: string;
  evidence?: string;
  requiresAIReview: boolean;
  aiReview?: {
    valid: boolean;
    severity?: 'low' | 'medium' | 'high';
    confidence: number;
    reason: string;
    recommendation: string;
  };
};
