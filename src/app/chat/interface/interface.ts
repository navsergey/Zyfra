export interface ChatMessage {
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}
