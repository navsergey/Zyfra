export interface ChatMessage {
  sender: 'user' | 'assistant';
  text: string;
  ts: number;
  turn_index?: number; // Индекс сообщения в массиве turns (только для ассистента)
  context_id?: string; // ID контекста (только для ассистента)
}

export interface Context {
  context_id: string;
  title: string;
  created_at: string;
  last_activity: string;
  turn_count: number;
  is_active: boolean
}

export interface ContextsResponse {
  contexts: Context[];
  total_count: number;
}





export interface TurnResponse {
  context_id: string;
  title: string;
  created_at: string;
  last_activity: string;
  turn_count: number;
  is_active: boolean
  turns: AddProp[]
}

export interface Source {
  filename: string;
  url: string;
  pages: number[];
}

export interface AddProp{
  q: string;
  a: string;
  sources: Source[];
  ts: number;
}

export interface SwitchContext{
  context_id: string;
}

export interface QueryRequest {
  context_id: string;
  question: string;
}

export interface QueryResponse {
  answer: string;
  context_id: string;
  sources: Source[];
}

export interface CreateContext {
  success: boolean;
  message: string;
  context_id: string;
}

export interface  Health{
  status: string,
  documents_loaded: number,
  vector_db_initialized: boolean
}

export interface FeedbackRequest {
  context_id: string;
  turn_index: number;
  feedback_type: string;
}