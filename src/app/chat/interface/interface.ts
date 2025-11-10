export interface ChatMessage {
  sender: 'user' | 'assistant';
  text: string;
  ts: number;
  turn_index?: number; // Индекс сообщения в массиве turns (только для ассистента)
  context_id?: string; // ID контекста (только для ассистента)
  sources?: Source[]; // Источники для сообщений ассистента
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
  active_source: string[];
}

export interface QueryResponse {
  answer: string;
  context_id: string;
  sources: Source[];
}



// Базовый интерфейс для всех типов сообщений
export interface BaseStreamEvent {
  type: string;
}

// Сообщение со статусом
export interface StatusEvent extends BaseStreamEvent {
  type: 'status';
  message: string;
}

// Сообщение с токеном (частью текста)
export interface TokenEvent extends BaseStreamEvent {
  type: 'token';
  content: string;
}

// Полный ответ
export interface AnswerEvent extends BaseStreamEvent {
  type: 'answer';
  content: string;
}

// Сообщение о завершении генерации
export interface DoneEvent extends BaseStreamEvent {
  type: 'done';
  sources: Source[];
  context_id: string;
  reindexing_in_progress: boolean;
}

// Сообщение об ошибке
export interface ErrorEvent extends BaseStreamEvent {
  type: 'error';
  message: string;
  error_code?: string;
}

// Union Type для всех событий потока
export type StreamEvent = StatusEvent | TokenEvent | AnswerEvent | DoneEvent | ErrorEvent;

// Type guards для безопасной работы с событиями
export function isStatusEvent(event: BaseStreamEvent): event is StatusEvent {
  return event.type === 'status';
}

export function isTokenEvent(event: BaseStreamEvent): event is TokenEvent {
  return event.type === 'token';
}

export function isAnswerEvent(event: BaseStreamEvent): event is AnswerEvent {
  return event.type === 'answer';
}

export function isDoneEvent(event: BaseStreamEvent): event is DoneEvent {
  return event.type === 'done';
}

export function isErrorEvent(event: BaseStreamEvent): event is ErrorEvent {
  return event.type === 'error';
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


export interface FilterRulesResponse {
  success: boolean;
  message: string;
  filter_rules: {
    comment: string;
    default_active_sources: string[];
    button_rules: Record<string, ButtonRule>;
  };
}

export interface ButtonRule {
  display_name: string;
  category: 'docs' | 'support' | 'kb';
  has_button: boolean;
  always_active?: boolean;
  default_active?: boolean;
  excludes?: string[];
  includes?: string[];
}
