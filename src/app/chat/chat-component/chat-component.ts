import { Component, inject, signal } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ChatMessage,
  Context,
  TurnResponse,
  Source,
  FilterRulesResponse,
  StreamEvent,
  isTokenEvent,
  isAnswerEvent,
  isDoneEvent,
  isStatusEvent,
  isErrorEvent
} from '../interface/interface';
import {SidebarComponent} from '../sidebar-component/sidebar-component';
import {ChatService} from '../../services/chat-service';
import {toObservable} from '@angular/core/rxjs-interop';
import {TextFormatterService} from '../../format-text/text-formatter.service';
import {tap} from 'rxjs';
import { trigger, transition, style, animate } from '@angular/animations';
import {OfferSourceComponent} from '../../offer-source/offer-source-component/offer-source-component';

@Component({
  selector: 'app-chat-component',
  imports: [CommonModule, FormsModule, SidebarComponent, AsyncPipe, OfferSourceComponent],
  templateUrl: './chat-component.html',
  styleUrl: './chat-component.scss',
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('300ms ease-in', style({ opacity: 0, transform: 'translateY(-10px)' }))
      ])
    ])
  ]
})
export class ChatComponent {
  chatService = inject(ChatService);
  textFormatter = inject(TextFormatterService);
  chatHistory = signal<ChatMessage[]>([]);
  chatHistory$ = toObservable(this.chatHistory);
  userInput: string = '';
  showWelcome: boolean = true;
  contexts: Context[] = [];
  filters: FilterRulesResponse | null = null;
  selectedContextId: string = '';
  currentDialog: TurnResponse | null = null;
  isRequestPending: boolean = false;
  pendingRequestContextIds = new Set<string>(); // Set контекстов, для которых выполняются запросы
  userTextFlag: boolean = false;
  healthStatus: string = 'unknown'; // Статус здоровья системы
  selectedVersion: string = 'ZIOT_DOCS_220'; // По умолчанию ЗИОТ 2.20
  filterSearch: string[] = []; // Массив includes из выбранной версии
  showOfferSourceModal: boolean = false; // Показать модальное окно предложения источника

  constructor() {
    this.loadContexts();
    this.checkHealth();
  }

  private loadContexts(): void {
    this.chatService.getContexts().subscribe( val => {
      this.contexts = val;
    });

    this.chatService.getFilterRules().subscribe( val => {
      this.filters = val;
      // Инициализируем filterSearch значением по умолчанию (ZIOT_DOCS_220)
      this.updateFilterSearch();
    });
  }

  private checkHealth(): void {
    this.chatService.getHealth().subscribe(health => {
      this.healthStatus = health.status;
      console.log('Health status:', this.healthStatus);
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
    if (this.isRequestPending) {
      return;
    }
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
        response.turns.forEach((turn, index) => {
          // Добавляем вопрос пользователя
          messages.push({
            sender: 'user',
            text: turn.q,
            ts: turn.ts,
          });

          // Добавляем ответ ассистента с turn_index и sources
          // Фильтруем источники, оставляя только те, у которых есть pages
          const sourcesWithPages = turn.sources?.filter(source => source.pages && source.pages.length > 0) || [];

          messages.push({
            sender: 'assistant',
            text: turn.a,
            ts: turn.ts,
            turn_index: index, // Индекс в массиве turns
            context_id: contextId,
            sources: sourcesWithPages.length > 0 ? sourcesWithPages : undefined
          });
        });
      }
      this.chatHistory.set(messages);

      // Проверяем, есть ли сохраненное сообщение в localStorage (ожидающее ответа)
      const pendingMessage = localStorage.getItem(contextId);
      if (pendingMessage && pendingMessage.trim()) {
        // Восстанавливаем сообщение пользователя, если он вернулся во время ожидания ответа
        this.chatHistory.update(currentMessages => [
          ...currentMessages,
          {
            sender: 'user',
            text: pendingMessage,
            ts: Date.now()
          }
        ]);
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

  adjustHeight(event: Event): void {
    const elem = event.target as HTMLTextAreaElement;
    elem.style.height = 'auto';
    elem.style.height = elem.scrollHeight + 'px';
  }

  checkEnter(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      // Не отправляем, если для текущего контекста уже выполняется запрос
      if (this.selectedContextId && this.hasActiveRequest(this.selectedContextId)) {
        return;
      }
      this.submitMessage();
    }
  }



  submitMessage(promptText?: string): void {
    const messageText = promptText ? promptText.trim() : this.userInput.trim();
    if (!messageText) return;

    // Проверяем, нет ли уже активного запроса для текущего контекста
    if (this.selectedContextId && this.hasActiveRequest(this.selectedContextId)) {
      console.log('Запрос уже выполняется для этого контекста');
      return;
    }

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
      // Сохраняем contextId в момент отправки запроса
      const requestContextId = this.selectedContextId;

      this.isRequestPending = true;
      this.pendingRequestContextIds.add(requestContextId); // Добавляем контекст в список активных запросов
      this.scrollToBottom(); // Прокручиваем к индикатору загрузки

      if (!this.userTextFlag) {
        localStorage.setItem(`${requestContextId}`, messageText);
      }

      // Переменная для накопления текста при потоковом получении
      let accumulatedText = '';
      let firstTokenReceived = false;

      this.chatService.QuestStreamContext(messageText, requestContextId, this.filterSearch)
        .pipe(
          tap(() => {
            // Устанавливаем флаг сразу после отправки запроса
            this.userTextFlag = true;
          })
        )
        .subscribe({
          next: (event: StreamEvent) => {
            // Проверяем, что пользователь всё ещё находится в том же контексте
            if (this.selectedContextId !== requestContextId) {
              return;
            }

            if (isTokenEvent(event)) {
              // При получении первого токена убираем индикатор загрузки
              if (!firstTokenReceived) {
                firstTokenReceived = true;
                this.pendingRequestContextIds.delete(requestContextId);
                this.isRequestPending = this.pendingRequestContextIds.size > 0;
              }

              // Постепенно добавляем токены к ответу
              accumulatedText += event.content;
              this.updateLastAssistantMessage(accumulatedText, requestContextId);

            } else if (isAnswerEvent(event)) {
              // При получении полного ответа убираем индикатор загрузки
              if (!firstTokenReceived) {
                firstTokenReceived = true;
                this.pendingRequestContextIds.delete(requestContextId);
                this.isRequestPending = this.pendingRequestContextIds.size > 0;
              }

              // Получили полный ответ сразу
              accumulatedText = event.content;
              this.updateLastAssistantMessage(accumulatedText, requestContextId);

            } else if (isDoneEvent(event)) {
              // Завершение - добавляем источники
              this.finalizeLastAssistantMessage(event.sources, event.context_id);

            } else if (isStatusEvent(event)) {
              // Статусное сообщение
              console.log('Status:', event.message);

            }
          },
          error: (error) => {
            // Проверяем контекст даже при ошибке
            if (this.selectedContextId !== requestContextId) {
              return;
            }
            console.error('Ошибка при отправке вопроса:', error);
            this.appendMessage('assistant', 'Извините, произошла ошибка при обработке вашего вопроса.', Date.now());
            // Убираем индикатор загрузки при ошибке
            this.pendingRequestContextIds.delete(requestContextId);
            this.isRequestPending = this.pendingRequestContextIds.size > 0;
          },
          complete: () => {
            // На случай если firstTokenReceived не сработал (например, только done без токенов)
            this.pendingRequestContextIds.delete(requestContextId);
            this.isRequestPending = this.pendingRequestContextIds.size > 0;
            this.loadContexts();
            this.userTextFlag = false;
            localStorage.removeItem(requestContextId);
          }
        });
    } else  {
      this.showWelcome = false

      // Создаем новый контекст, переключаемся на него, скрываем welcome и отправляем вопрос
      this.isRequestPending = true;
      this.scrollToBottom(); // Прокручиваем к индикатору загрузки
      this.chatService.createContext().subscribe({
        next: (newContextId: string) => {
          this.loadContexts();
          this.selectedContextId = newContextId;
          this.pendingRequestContextIds.add(newContextId); // Добавляем контекст в список активных запросов

          const switchContexts$ = this.chatService.switchContexts(newContextId);
          switchContexts$
            .pipe(
              tap((response) => {
                const storedMessage = localStorage.getItem(newContextId);
              })
            )
            .subscribe({
            next: (response) => {
              this.showWelcome = false;


              // Сохраняем contextId в момент отправки запроса
              const requestContextId = newContextId;

              // Сохраняем сообщение в localStorage перед отправкой запроса
              localStorage.setItem(`${requestContextId}`, messageText);

              // Переменная для накопления текста при потоковом получении
              let accumulatedText = '';
              let firstTokenReceived = false;

              this.chatService.QuestStreamContext(messageText, requestContextId, this.filterSearch)
                .subscribe({
                  next: (event: StreamEvent) => {
                    // Проверяем, что пользователь всё ещё находится в том же контексте
                    if (this.selectedContextId !== requestContextId) {
                      return;
                    }

                    if (isTokenEvent(event)) {
                      // При получении первого токена убираем индикатор загрузки
                      if (!firstTokenReceived) {
                        firstTokenReceived = true;
                        this.pendingRequestContextIds.delete(requestContextId);
                        this.isRequestPending = this.pendingRequestContextIds.size > 0;
                      }

                      // Постепенно добавляем токены к ответу
                      accumulatedText += event.content;
                      this.updateLastAssistantMessage(accumulatedText, requestContextId);

                    } else if (isAnswerEvent(event)) {
                      // При получении полного ответа убираем индикатор загрузки
                      if (!firstTokenReceived) {
                        firstTokenReceived = true;
                        this.pendingRequestContextIds.delete(requestContextId);
                        this.isRequestPending = this.pendingRequestContextIds.size > 0;
                      }

                      // Получили полный ответ сразу
                      accumulatedText = event.content;
                      this.updateLastAssistantMessage(accumulatedText, requestContextId);

                    } else if (isDoneEvent(event)) {
                      // Завершение - добавляем источники
                      this.finalizeLastAssistantMessage(event.sources, event.context_id);

                    } else if (isStatusEvent(event)) {
                      // Статусное сообщение
                      console.log('Status:', event.message);

                    }
                  },
                  error: (error) => {
                    // Проверяем контекст даже при ошибке
                    if (this.selectedContextId !== requestContextId) {
                      return;
                    }
                    console.error('Ошибка при отправке вопроса:', error);
                    this.appendMessage('assistant', 'Извините, произошла ошибка при обработке вашего вопроса.', Date.now());
                    // Убираем индикатор загрузки при ошибке
                    this.pendingRequestContextIds.delete(requestContextId);
                    this.isRequestPending = this.pendingRequestContextIds.size > 0;
                  },
                  complete: () => {
                    // На случай если firstTokenReceived не сработал (например, только done без токенов)
                    this.pendingRequestContextIds.delete(requestContextId);
                    this.isRequestPending = this.pendingRequestContextIds.size > 0;
                    this.loadContexts();
                    localStorage.removeItem(requestContextId);
                  }
                });
            },
            error: (error) => {
              console.error('Ошибка при переключении контекста:', error);
              this.appendMessage('assistant', 'Ошибка при создании нового диалога.', Date.now());
              const newContextId = this.selectedContextId;
              this.pendingRequestContextIds.delete(newContextId); // Удаляем контекст из списка активных запросов
              this.isRequestPending = this.pendingRequestContextIds.size > 0;
            }
          });
        },
        error: (error) => {
          console.error('Ошибка при создании контекста:', error);
          this.appendMessage('assistant', 'Ошибка при создании нового диалога.', Date.now());
          const newContextId = this.selectedContextId;
          if (newContextId) {
            this.pendingRequestContextIds.delete(newContextId); // Удаляем контекст из списка активных запросов
          }
          this.isRequestPending = this.pendingRequestContextIds.size > 0;
        }
      });
    }
  }

  appendMessage(sender: 'user' | 'assistant', text: string, ts: number, sources?: Source[]): void {
    // Фильтруем источники, оставляя только те, у которых есть pages
    const sourcesWithPages = sources?.filter(source => source.pages && source.pages.length > 0);

    // Обновляем signal с новым сообщением
    this.chatHistory.update(messages => [...messages, {
      sender: sender,
      text: text,
      ts: ts,
      sources: sourcesWithPages && sourcesWithPages.length > 0 ? sourcesWithPages : undefined
    }]);

    // Автоматическая прокрутка вниз
    this.scrollToBottom();
  }

  // Обновление последнего сообщения ассистента (для потокового ответа)
  private updateLastAssistantMessage(text: string, contextId?: string): void {
    this.chatHistory.update(messages => {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.sender === 'assistant') {
        // Обновляем существующее сообщение
        lastMessage.text = text;
        // Устанавливаем context_id если передан
        if (contextId && !lastMessage.context_id) {
          lastMessage.context_id = contextId;
        }
        return [...messages];
      } else {
        // Если нет сообщения ассистента, создаем новое
        return [...messages, {
          sender: 'assistant',
          text: text,
          ts: Date.now(),
          context_id: contextId // Сразу устанавливаем context_id
        }];
      }
    });
    this.scrollToBottom();
  }

  // Финализация последнего сообщения (добавление источников, context_id и turn_index)
  private finalizeLastAssistantMessage(sources: Source[], contextId: string): void {
    const sourcesWithPages = sources?.filter(source => source.pages && source.pages.length > 0);

    this.chatHistory.update(messages => {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.sender === 'assistant') {
        lastMessage.sources = sourcesWithPages && sourcesWithPages.length > 0 ? sourcesWithPages : undefined;
        lastMessage.context_id = contextId;
        
        // Вычисляем turn_index: это количество ответов ассистента в истории минус 1 (текущее сообщение)
        const assistantMessagesCount = messages.filter(m => m.sender === 'assistant').length;
        lastMessage.turn_index = assistantMessagesCount - 1;
      }
      return [...messages];
    });
  }

  private scrollToBottom(): void {
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
    return this.textFormatter.formatTimestamp(timestamp);
  }

  formatMessageText(text: string): string {
    return this.textFormatter.formatMessageText(text);
  }

  formatPages(text: number[]): string {
    return this.textFormatter.formatPages(text);
  }

  // Проверяет, есть ли активный запрос для данного контекста
  hasActiveRequest(contextId: string): boolean {
    return this.pendingRequestContextIds.has(contextId);
  }

  // Отправка обратной связи (Like/Dislike)
  sendFeedback(contextId: string, turn_index: number, feedback_type: string): void {
    console.log(`Отправка обратной связи: contextId=${contextId}, turn_index=${turn_index}, type=${feedback_type}`);

    this.chatService.Feedback(contextId, turn_index, feedback_type).subscribe({
      next: (response) => {
        console.log('Обратная связь отправлена успешно:', response);
      },
      error: (error) => {
        console.error('Ошибка при отправке обратной связи:', error);
      }
    });
  }

  // Копирование сообщения в буфер обмена
  copyMessage(text: string): void {
    // Очищаем текст от HTML тегов для копирования
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = text;
    const cleanText = tempDiv.textContent || tempDiv.innerText || '';

    navigator.clipboard.writeText(cleanText).then(() => {
      console.log('Текст скопирован в буфер обмена');
      // Можно добавить визуальное подтверждение (toast notification)
    }).catch(err => {
      console.error('Ошибка при копировании текста:', err);
    });
  }

  // Обработчик изменения выбора версии ЗИОТ
  onVersionChange(): void {
    this.updateFilterSearch();
  }

  // Обновление filterSearch на основе выбранной версии
  private updateFilterSearch(): void {
    if (!this.filters || !this.filters.filter_rules || !this.filters.filter_rules.button_rules) {
      this.filterSearch = [];
      return;
    }

    const buttonRule = this.filters.filter_rules.button_rules[this.selectedVersion];
    if (buttonRule && buttonRule.includes) {
      this.filterSearch = [...buttonRule.includes];
      console.log(`Версия ${this.selectedVersion} выбрана. filterSearch:`, this.filterSearch);
    } else {
      this.filterSearch = [];
      console.warn(`Правило для ${this.selectedVersion} не найдено или не содержит includes`);
    }
  }

  // Открыть модальное окно предложения источника
  openOfferSourceModal(): void {
    this.showOfferSourceModal = true;
  }

  // Закрыть модальное окно предложения источника
  closeOfferSourceModal(): void {
    this.showOfferSourceModal = false;
  }

}
