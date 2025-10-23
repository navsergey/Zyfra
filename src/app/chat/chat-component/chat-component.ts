import { Component, inject, signal } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {ChatMessage, Context, TurnResponse} from '../interface/interface';
import {SidebarComponent} from '../sidebar-component/sidebar-component';
import {ChatService} from '../../services/chat-service';
import {toObservable} from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-chat-component',
  imports: [CommonModule, FormsModule, SidebarComponent, AsyncPipe],
  templateUrl: './chat-component.html',
  styleUrl: './chat-component.scss'
})
export class ChatComponent {
  chatService = inject(ChatService);
  chatHistory = signal<ChatMessage[]>([]);
  chatHistory$ = toObservable(this.chatHistory);
  userInput: string = '';
  showWelcome: boolean = true;
  contexts: Context[] = [];
  selectedContextId: string = '';
  currentDialog: TurnResponse | null = null;

  constructor() {
    this.loadContexts();
  }

  private loadContexts(): void {
    this.chatService.getContexts().subscribe( val => {
      this.contexts = val;
    });
  }

  onContextSelected(contextId: string): void {
    // Если пустой ID — создаем новый контекст, обновляем историю и переключаемся на него
    if (!contextId) {
      this.chatService.createContext().subscribe({
        next: (newContextId: string) => {
          // Обновляем список контекстов (ререндер history-section)
          this.loadContexts();

          // Сохраняем и активируем новый контекст
          this.selectedContextId = newContextId;
          this.chatService.switchContexts(newContextId).subscribe();

          // Загружаем диалог для нового контекста
          this.loadDialog(newContextId);
        },
        error: () => {
          // В случае ошибки создания — возвращаемся к экрану приветствия
          this.chatHistory.set([]);
          this.showWelcome = true;
          this.currentDialog = null;
        }
      });
      return;
    }

    // Переключение на существующий контекст
    this.chatService.switchContexts(contextId).subscribe();
    this.selectedContextId = contextId;
    this.loadDialog(contextId);
  }

  onContextDeleted(contextId: string): void {
    this.chatService.deleteContext(contextId).subscribe({
      next: () => {
        // Если удаляемый контекст был активным, сбрасываем состояние
        if (this.selectedContextId === contextId) {
          this.chatHistory.set([]);
          this.showWelcome = true;
          this.currentDialog = null;
          this.selectedContextId = '';
        }

        // Обновляем список контекстов (ререндер history-section)
        this.loadContexts();
      },
      error: (error) => {
        console.error('Ошибка при удалении контекста:', error);
      }
    });
  }

  private loadDialog(contextId: string): void {
    this.chatService.getTurn(contextId).subscribe(response => {
      this.currentDialog = response;
      this.showWelcome = false;

      // Преобразуем turns в chatHistory
      const messages: ChatMessage[] = [];
      if (response.turns && response.turns.length > 0) {
        response.turns.forEach(turn => {
          // Добавляем вопрос пользователя
          messages.push({
            sender: 'user',
            text: turn.q,
            ts: turn.ts
          });

          // Добавляем ответ ассистента
          messages.push({
            sender: 'assistant',
            text: turn.a,
            ts: turn.ts
          });
        });
      }
      this.chatHistory.set(messages);

      // Прокручиваем к последнему сообщению
      setTimeout(() => {
        const container = document.getElementById('chatMessages');
        if (container) {
          container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        }
      }, 100);
    });
  }

  adjustHeight(event: Event): void {
    const elem = event.target as HTMLTextAreaElement;
    elem.style.height = 'auto';
    elem.style.height = elem.scrollHeight + 'px';
  }

  checkEnter(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.submitMessage();
    }
  }

  

  submitMessage(): void {
    const messageText = this.userInput.trim();
    if (!messageText) return;

    // Используйте строку для временной метки
    this.appendMessage('user', messageText, 0);
    this.userInput = '';

    // Сброс высоты textarea
    setTimeout(() => {
      const textarea = document.getElementById('userInput') as HTMLTextAreaElement;
      if (textarea) {
        textarea.style.height = 'auto';
      }
    }, 0);

    if (this.selectedContextId) {
      this.chatService.QuestContext(messageText, this.selectedContextId).subscribe({
          next: (response) => {
            // Используем response.answer вместо response.question
            if (response && response.answer) {
              this.appendMessage('assistant', response.answer, Date.now());
            } else {
              console.error('Некорректный ответ от сервера:', response);
              this.appendMessage('assistant', 'Получен некорректный ответ от сервера', Date.now());
            }
          },
        error: (error) => {
          console.error('Ошибка при отправке вопроса:', error);
          this.appendMessage('assistant', 'Извините, произошла ошибка при обработке вашего вопроса.', Date.now());
        }
      });
    } else if (this.showWelcome) {
      // Создаем новый контекст, переключаемся на него, скрываем welcome и отправляем вопрос
      this.chatService.createContext().subscribe({
        next: (newContextId: string) => {
          this.loadContexts();
          this.selectedContextId = newContextId;
          this.chatService.switchContexts(newContextId).subscribe({
            next: () => {
              this.showWelcome = false;
              this.chatService.QuestContext(messageText, newContextId).subscribe({
                next: (response) => {
                  if (response && response.answer) {
                    this.appendMessage('assistant', response.answer, Date.now());
                  } else {
                    console.error('Некорректный ответ от сервера:', response);
                    this.appendMessage('assistant', 'Получен некорректный ответ от сервера', Date.now());
                  }
                },
                error: (error) => {
                  console.error('Ошибка при отправке вопроса:', error);
                  this.appendMessage('assistant', 'Извините, произошла ошибка при обработке вашего вопроса.', Date.now());
                }
              });
            },
            error: (error) => {
              console.error('Ошибка при переключении контекста:', error);
              this.appendMessage('assistant', 'Ошибка при создании нового диалога.', Date.now());
            }
          });
        },
        error: (error) => {
          console.error('Ошибка при создании контекста:', error);
          this.appendMessage('assistant', 'Ошибка при создании нового диалога.', Date.now());
        }
      });
    }
  }

  appendMessage(sender: 'user' | 'assistant', text: string, ts: number): void {
    // Обновляем signal с новым сообщением
    this.chatHistory.update(messages => [...messages, { sender:sender, text:text, ts: ts }]);

    // Автоматическая прокрутка вниз
    setTimeout(() => {
      const container = document.getElementById('chatMessages');
      if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      }
    }, 100);
  }


  getMessageIcon(sender: 'user' | 'assistant'): string {
    return sender === 'user' ? 'Вы' : 'AI';
  }

  formatTimestamp(timestamp: number): string {
    try {
      // Нормализуем timestamp
      let normalizedTimestamp: number;

      if (!timestamp || timestamp === 0) {
        normalizedTimestamp = Date.now();
      } else if (timestamp < 1000000000000) {
        // Если timestamp в секундах (меньше 13 знаков)
        normalizedTimestamp = timestamp * 1000;
      } else {
        // Если уже в миллисекундах
        normalizedTimestamp = timestamp;
      }

      const date = new Date(normalizedTimestamp);

      if (isNaN(date.getTime())) {
        return 'Некорректная дата';
      }

      return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit' // Добавим секунды для отладки
      });

    } catch (error) {
      console.error('Ошибка форматирования timestamp:', timestamp, error);
      return 'Ошибка даты';
    }
  }
}
