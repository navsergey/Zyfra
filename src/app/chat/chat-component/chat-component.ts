import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {ChatMessage, Context, TurnResponse} from '../interface/interface';
import {SidebarComponent} from '../sidebar-component/sidebar-component';
import {ChatService} from '../../services/chat-service';

@Component({
  selector: 'app-chat-component',
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './chat-component.html',
  styleUrl: './chat-component.scss'
})
export class ChatComponent {
  chatService = inject(ChatService);
  chatHistory: ChatMessage[] = [];
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
    this.chatService.switchContexts(contextId).subscribe()

    this.selectedContextId = contextId;

    if (contextId) {
      this.loadDialog(contextId);
    } else {
      // Сброс к новому диалогу
      this.chatHistory = [];
      this.showWelcome = true;
      this.currentDialog = null;
    }
  }

  private loadDialog(contextId: string): void {
    this.chatService.getTurn(contextId).subscribe(response => {
      this.currentDialog = response;
      this.showWelcome = false;

      // Преобразуем turns в chatHistory
      this.chatHistory = [];
      if (response.turns && response.turns.length > 0) {
        response.turns.forEach(turn => {
          // Добавляем вопрос пользователя
          this.chatHistory.push({
            sender: 'user',
            text: turn.q,
            ts: turn.ts.toString()
          });

          // Добавляем ответ ассистента
          this.chatHistory.push({
            sender: 'assistant',
            text: turn.a,
            ts: turn.ts.toString()
          });
        });
      }

      // Прокручиваем к последнему сообщению
      setTimeout(() => {
        const container = document.getElementById('chatMessages');
        if (container) {
          container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
        }
      }, 100);
    });
  }

  private aiResponses: string[] = [
    'Для повышения эффективности производства рекомендую внедрить платформу ZIIoT. Она обеспечивает сбор данных с оборудования в режиме реального времени, что позволяет оперативно принимать решения и снижать простои на 25-30%.',
    'Цифра разработала комплексные решения для различных отраслей: горнодобывающей, нефтегазовой, металлургии, энергетики. Каждый дивизион специализируется на своей области, обеспечивая глубокую экспертизу.',
    'Роботизация предприятия начинается с аудита процессов и выявления операций с высоким риском для сотрудников. Дивизион "Цифра Роботикс" поможет разработать стратегию внедрения автоматизированных систем.',
    'Платформа ZIIoT Oil&Gas стала стандартом для промышленной автоматизации в нефтегазовой отрасли. Она интегрирует данные с месторождений, позволяет оптимизировать добычу и прогнозировать работу оборудования.',
  ];

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

  useSamplePrompt(promptText: string): void {
    this.userInput = promptText;
    this.submitMessage();
  }

  submitMessage(): void {
    const messageText = this.userInput.trim();

    if (!messageText) return;

    if (this.showWelcome) {
      this.showWelcome = false;
    }

    this.appendMessage('user', messageText, 0);
    this.userInput = '';

    // Сброс высоты textarea
    setTimeout(() => {
      const textarea = document.getElementById('userInput') as HTMLTextAreaElement;
      if (textarea) {
        textarea.style.height = 'auto';
      }
    }, 0);

    // Если выбран контекст, отправляем вопрос через API
    if (this.selectedContextId) {
      this.chatService.QuestContext(messageText, this.selectedContextId).subscribe({
        next: (response) => {
          console.log('Ответ получен:', response);
          this.appendMessage('assistant', response.question,0);
        },
        error: (error) => {
          console.error('Ошибка при отправке вопроса:', error);
          // Показываем сообщение об ошибке
          this.appendMessage('assistant', 'Извините, произошла ошибка при обработке вашего вопроса.', Date.now());
        }
      });
    } else {
      // Имитация ответа AI только для нового диалога
      setTimeout(() => {
        const randomReply = this.aiResponses[Math.floor(Math.random() * this.aiResponses.length)];
        this.appendMessage('assistant', randomReply,0);
      }, 1200);
    }
  }

  appendMessage(sender: 'user' | 'assistant', text: string, ts: number): void {
    this.chatHistory.push({ sender, text, ts: ts.toString() });

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

  formatTimestamp(timestamp: string): string {
    const date = new Date(parseInt(timestamp) * 1000); // Unix timestamp в миллисекундах
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
