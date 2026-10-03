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
};
