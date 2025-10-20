export interface ChatMessage {
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export interface Context {
  "context_id": string;
  "title": string;
  "created_at": string;
  "last_activity": string;
  "turn_count": number;
  "is_active": boolean
}

export interface ContextsResponse {
  contexts: Context[];
  total_count: number;
}

