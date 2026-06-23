export interface User {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  isSmsVerified: boolean;
  isPremium: boolean;
  createdAt: string;
}

export interface HumanizeHistoryItem {
  id: string;
  userId: string;
  originalText: string;
  humanizedText: string;
  wordCount: number;
  originalWordCount: number;
  humanityScore: number;
  createdAt: string;
}

export interface HumanityMetrics {
  originalScore: number;
  humanizedScore: number;
  readabilityLevel: string;
  changesMade: string[];
}
