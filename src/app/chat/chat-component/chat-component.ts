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
  isErrorEvent,
  isSessionIdEvent
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
  loadingIndicatorContextIds = new Set<string>(); // Set контекстов, для которых показывается анимация загрузки
  autoScrollEnabled: boolean = true; // Флаг для управления автоматической прокруткой
  scrollHandler: ((event: Event) => void) | null = null; // Ссылка на обработчик скролла
  healthStatus: string = 'unknown'; // Статус здоровья системы
  selectedVersion: string = 'ZIOT_DOCS_220'; // По умолчанию ЗИОТ 2.20
  versionOptions: { key: string; displayName: string }[] = [];
  showOfferSourceModal: boolean = false; // Показать модальное окно предложения источника
  filterSearch: string[] = []; // Массив includes из выбранной версии
  webSearchActive: boolean = false;
  currentSessionId = '';
  currentSource = '';

  // Переменные для переподключения при перезагрузке страницы
  private reconnectSessionId: string | null = null;
  private reconnectQuestion: string | null = null;
  private reconnectContextId: string | null = null;

  constructor() {
    this.loadContexts();
    this.checkHealth();
    this.setupScrollHandler();
    this.checkForReconnectSession();
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

  private setupScrollHandler(): void {
    // Настраиваем обработчик скролла после инициализации DOM
    setTimeout(() => {
      const chatContainer = document.getElementById('chatMessages');
      if (chatContainer) {
        this.scrollHandler = () => {
          this.handleScroll(chatContainer);
        };
        chatContainer.addEventListener('scroll', this.scrollHandler);
      }
    }, 100);
  }

  private handleScroll(container: HTMLElement): void {
    // При любом ручном скролле пользователя отключаем автоскролл
    this.autoScrollEnabled = false;
  }

  private checkForReconnectSession(): void {
    // Проверяем наличие сохраненной сессии в localStorage
    const savedSessionId = localStorage.getItem('reconnectSessionId');
    const savedQuestion = localStorage.getItem('reconnectQuestion');
    const savedContextId = localStorage.getItem('reconnectContextId');

    if (savedSessionId && savedQuestion && savedContextId) {
      console.log('[RECONNECT] Found saved session:', savedSessionId);
      this.reconnectSessionId = savedSessionId;
      this.reconnectQuestion = savedQuestion;
      this.reconnectContextId = savedContextId;

      // Автоматически переподключаемся через небольшую задержку для загрузки UI
      setTimeout(() => {
        console.log('[RECONNECT] Auto-reconnecting to session');
        this.reconnectToSession();
      }, 1000);
    }
  }

  private reconnectToSession(): void {
    if (!this.reconnectSessionId || !this.reconnectQuestion || !this.reconnectContextId) {
      return;
    }

    console.log('[RECONNECT] Reconnecting to session:', this.reconnectSessionId);

    // Переключаемся на сохраненный контекст
    this.selectedContextId = this.reconnectContextId;
    this.onContextSelected(this.reconnectContextId);


    // Восстанавливаем вопрос и отправляем запрос с session_id для продолжения
    this.currentSessionId = this.reconnectSessionId;
    this.submitMessage(this.reconnectQuestion);
  }

  private clearReconnectSession(): void {
    // Очищаем данные сессии из localStorage
    localStorage.removeItem('reconnectSessionId');
    localStorage.removeItem('reconnectQuestion');
    localStorage.removeItem('reconnectContextId');

    // Очищаем локальные переменные
    this.reconnectSessionId = null;
    this.reconnectQuestion = null;
    this.reconnectContextId = null;
    this.currentSessionId = '';

    console.log('[RECONNECT] Session cleared');
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
    // Включаем автоскролл при переключении контекста, чтобы показать актуальные сообщения
    this.autoScrollEnabled = true;
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

  onNewChat(): void {
    // Переход на главную страницу - показываем welcome экран
    this.showWelcome = true;
    this.chatHistory.set([]);
    this.currentDialog = null;
    this.selectedContextId = '';
    // Включаем автоскролл для нового диалога
    this.autoScrollEnabled = true;
  }

  private loadDialog(contextId: string): void {
    this.chatService.getTurn(contextId).subscribe(response => {
      this.currentSource = response.context_label
      console.log(response.context_label)
      // Устанавливаем версию в зависимости от context_label
      if (this.currentSource) {
        this.setVersionBySource(this.currentSource);
      }
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

          // Добавляем ответ ассистента с turn_index и sources (без фильтрации по pages)
          messages.push({
            sender: 'assistant',
            text: turn.a,
            ts: turn.ts,
            turn_index: index, // Индекс в массиве turns
            context_id: contextId,
            sources: turn.sources && turn.sources.length > 0 ? turn.sources : undefined,
            feedback_type: turn.feedback_type
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

      // Прокручиваем к последнему сообщению (только если включен автоскролл)
      if (this.autoScrollEnabled) {
        // Временно отключаем обработчик скролла
        const container = document.getElementById('chatMessages');
        if (container && this.scrollHandler) {
          container.removeEventListener('scroll', this.scrollHandler);
        }

        setTimeout(() => {
          if (container) {
            container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });

            // Включаем обработчик обратно через небольшую задержку
            setTimeout(() => {
              if (container && this.scrollHandler) {
                container.addEventListener('scroll', this.scrollHandler);
              }
            }, 300);
          }
        }, 100);
      }
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



  submitMessage(promptText?: string, source?: string): void {
    const messageText = promptText ? promptText.trim() : this.userInput.trim();
    if (!messageText) return;

    // Устанавливаем currentSource и selectedVersion, если передан параметр source
    if (source) {
      console.log(source)
      this.currentSource = source;
      this.setVersionBySource(source);
    }

    // Проверяем, нет ли уже активного запроса для текущего контекста
    if (this.selectedContextId && this.hasActiveRequest(this.selectedContextId)) {
      console.log('Запрос уже выполняется для этого контекста');
      return;
    }

    // Включаем автоскролл при отправке нового сообщения
    this.autoScrollEnabled = true;

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
      this.loadingIndicatorContextIds.add(requestContextId); // Добавляем контекст для показа анимации загрузки
      this.scrollToBottom(); // Прокручиваем к индикатору загрузки

      // Сохраняем состояние для возможности переподключения при перезагрузке страницы
      // (только если это не переподключение к существующей сессии)
      if (!this.currentSessionId) {
        localStorage.setItem('reconnectQuestion', messageText);
        localStorage.setItem('reconnectContextId', requestContextId);
        console.log('[RECONNECT] Saved state for potential reconnection');
      }

      // Переменная для накопления текста при потоковом получении
      let accumulatedText = '';
      let firstTokenReceived = false;

      this.chatService.QuestStreamContext(messageText, requestContextId, this.filterSearch, this.webSearchActive, this.currentSessionId, this.currentSource)
        .subscribe({
          next: (event: StreamEvent) => {
            // Проверяем, что пользователь всё ещё находится в том же контексте
            if (this.selectedContextId !== requestContextId) {
              return;
            }

            if (isTokenEvent(event)) {
              // При получении первого токена убираем анимацию загрузки, но НЕ разблокируем кнопку
              if (!firstTokenReceived) {
                firstTokenReceived = true;
                // Убираем анимацию загрузки при получении первого токена
                this.loadingIndicatorContextIds.delete(requestContextId);
                // Но оставляем кнопку заблокированной до полного завершения
                // this.pendingRequestContextIds.delete(requestContextId);
                // this.isRequestPending = this.pendingRequestContextIds.size > 0;
              }

              // Постепенно добавляем токены к ответу
              accumulatedText += event.content;
              this.updateLastAssistantMessage(accumulatedText, requestContextId);

            } else if (isAnswerEvent(event)) {
              // При получении полного ответа убираем анимацию загрузки, но НЕ разблокируем кнопку
              if (!firstTokenReceived) {
                firstTokenReceived = true;
                // Убираем анимацию загрузки при получении полного ответа
                this.loadingIndicatorContextIds.delete(requestContextId);
                // Но оставляем кнопку заблокированной до полного завершения
                // this.pendingRequestContextIds.delete(requestContextId);
                // this.isRequestPending = this.pendingRequestContextIds.size > 0;
              }

              // Получили полный ответ сразу
              accumulatedText = event.content;
              this.updateLastAssistantMessage(accumulatedText, requestContextId);

            } else if (isDoneEvent(event)) {
              // Завершение - добавляем источники и разблокируем кнопку
              this.finalizeLastAssistantMessage(event.sources, event.context_id);
              // Разблокируем кнопку только при полном завершении ответа
              this.pendingRequestContextIds.delete(requestContextId);
              this.isRequestPending = this.pendingRequestContextIds.size > 0;
              // Очищаем сессию после успешного завершения
              this.clearReconnectSession();

            } else if (isStatusEvent(event)) {
              // Статусное сообщение
              console.log('Status:', event.message);

            } else if (isSessionIdEvent(event)) {
              // Получили session_id для возможности переподключения
              this.currentSessionId = event.session_id;
              localStorage.setItem('reconnectSessionId', event.session_id);
              console.log('[SESSION] Received session_id:', event.session_id);

            }
          },
          error: (error) => {
            // Проверяем контекст даже при ошибке
            if (this.selectedContextId !== requestContextId) {
              return;
            }
            console.error('Ошибка при отправке вопроса:', error);
            this.appendMessage('assistant', 'Упс, ничего не нашлось в базе знаний, предложи источник.', Date.now());
            // Убираем индикатор загрузки и разблокируем кнопку при ошибке
            this.loadingIndicatorContextIds.delete(requestContextId);
            this.pendingRequestContextIds.delete(requestContextId);
            this.isRequestPending = this.pendingRequestContextIds.size > 0;
            // Очищаем сессию при ошибке
            this.clearReconnectSession();
          },
          complete: () => {
            // На случай если firstTokenReceived не сработал (например, только done без токенов)
            this.loadingIndicatorContextIds.delete(requestContextId);
            this.pendingRequestContextIds.delete(requestContextId);
            this.isRequestPending = this.pendingRequestContextIds.size > 0;
            this.loadContexts();
            localStorage.removeItem(requestContextId);
          }
        });
    } else  {
      this.showWelcome = false

      // Создаем новый контекст, переключаемся на него, скрываем welcome и отправляем вопрос
      this.isRequestPending = true;
      // Включаем автоскролл при создании нового контекста
      this.autoScrollEnabled = true;
      this.scrollToBottom(); // Прокручиваем к индикатору загрузки
      this.chatService.createContext().subscribe({
        next: (newContextId: string) => {
          this.loadContexts();
          this.selectedContextId = newContextId;
          this.pendingRequestContextIds.add(newContextId); // Добавляем контекст в список активных запросов
          this.loadingIndicatorContextIds.add(newContextId); // Добавляем контекст для показа анимации загрузки

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

              // Сохраняем состояние для возможности переподключения при перезагрузке страницы
              // (только если это не переподключение к существующей сессии)
              if (!this.currentSessionId) {
                localStorage.setItem('reconnectQuestion', messageText);
                localStorage.setItem('reconnectContextId', requestContextId);
                console.log('[RECONNECT] Saved state for potential reconnection (new context)');
              }

              // Переменная для накопления текста при потоковом получении
              let accumulatedText = '';
              let firstTokenReceived = false;

              this.chatService.QuestStreamContext(messageText, requestContextId, this.filterSearch, this.webSearchActive, this.currentSessionId, this.currentSource)
                .subscribe({
                  next: (event: StreamEvent) => {
                    // Проверяем, что пользователь всё ещё находится в том же контексте
                    if (this.selectedContextId !== requestContextId) {
                      return;
                    }

                    if (isTokenEvent(event)) {
                      // При получении первого токена убираем анимацию загрузки, но НЕ разблокируем кнопку
                      if (!firstTokenReceived) {
                        firstTokenReceived = true;
                        // Убираем анимацию загрузки при получении первого токена
                        this.loadingIndicatorContextIds.delete(requestContextId);
                        // Но оставляем кнопку заблокированной до полного завершения
                        // this.pendingRequestContextIds.delete(requestContextId);
                        // this.isRequestPending = this.pendingRequestContextIds.size > 0;
                      }

                      // Постепенно добавляем токены к ответу
                      accumulatedText += event.content;
                      this.updateLastAssistantMessage(accumulatedText, requestContextId);

                    } else if (isAnswerEvent(event)) {
                      // При получении полного ответа убираем анимацию загрузки, но НЕ разблокируем кнопку
                      if (!firstTokenReceived) {
                        firstTokenReceived = true;
                        // Убираем анимацию загрузки при получении полного ответа
                        this.loadingIndicatorContextIds.delete(requestContextId);
                        // Но оставляем кнопку заблокированной до полного завершения
                        // this.pendingRequestContextIds.delete(requestContextId);
                        // this.isRequestPending = this.pendingRequestContextIds.size > 0;
                      }

                      // Получили полный ответ сразу
                      accumulatedText = event.content;
                      this.updateLastAssistantMessage(accumulatedText, requestContextId);

                    } else if (isDoneEvent(event)) {
                      // Завершение - добавляем источники и разблокируем кнопку
                      this.finalizeLastAssistantMessage(event.sources, event.context_id);
                      // Разблокируем кнопку только при полном завершении ответа
                      this.pendingRequestContextIds.delete(requestContextId);
                      this.isRequestPending = this.pendingRequestContextIds.size > 0;
                      // Очищаем сессию после успешного завершения
                      this.clearReconnectSession();

                    } else if (isStatusEvent(event)) {
                      // Статусное сообщение
                      console.log('Status:', event.message);

                    } else if (isSessionIdEvent(event)) {
                      // Получили session_id для возможности переподключения
                      this.currentSessionId = event.session_id;
                      localStorage.setItem('reconnectSessionId', event.session_id);
                      console.log('[SESSION] Received session_id (new context):', event.session_id);

                    }
                  },
                  error: (error) => {
                    // Проверяем контекст даже при ошибке
                    if (this.selectedContextId !== requestContextId) {
                      return;
                    }
                    console.error('Ошибка при отправке вопроса:', error);
                    this.appendMessage('assistant', 'Упс, ничего не нашлось в базе знаний, предложи источник.', Date.now());
                    // Убираем индикатор загрузки и разблокируем кнопку при ошибке
                    this.loadingIndicatorContextIds.delete(requestContextId);
                    this.pendingRequestContextIds.delete(requestContextId);
                    this.isRequestPending = this.pendingRequestContextIds.size > 0;
                    // Очищаем сессию при ошибке
                    this.clearReconnectSession();
                  },
                  complete: () => {
                    // На случай если firstTokenReceived не сработал (например, только done без токенов)
                    this.loadingIndicatorContextIds.delete(requestContextId);
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
              this.loadingIndicatorContextIds.delete(newContextId); // Удаляем анимацию загрузки
              this.pendingRequestContextIds.delete(newContextId); // Удаляем контекст из списка активных запросов
              this.isRequestPending = this.pendingRequestContextIds.size > 0;
              // Очищаем сессию при ошибке
              this.clearReconnectSession();
            }
          });
        },
        error: (error) => {
          console.error('Ошибка при создании контекста:', error);
          this.appendMessage('assistant', 'Ошибка при создании нового диалога.', Date.now());
          const newContextId = this.selectedContextId;
          if (newContextId) {
            this.loadingIndicatorContextIds.delete(newContextId); // Удаляем анимацию загрузки
            this.pendingRequestContextIds.delete(newContextId); // Удаляем контекст из списка активных запросов
          }
          this.isRequestPending = this.pendingRequestContextIds.size > 0;
          // Очищаем сессию при ошибке
          this.clearReconnectSession();
        }
      });
    }
  }

  appendMessage(sender: 'user' | 'assistant', text: string, ts: number, sources?: Source[]): void {
    // Обновляем signal с новым сообщением
    this.chatHistory.update(messages => [...messages, {
      sender: sender,
      text: text,
      ts: ts,
      sources: sources && sources.length > 0 ? sources : undefined
    }]);

    // Автоматическая прокрутка вниз (только если включен автоскролл)
    if (this.autoScrollEnabled) {
      this.scrollToBottom();
    }
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
    if (this.autoScrollEnabled) {
      this.scrollToBottom();
    }
  }

  // Финализация последнего сообщения (добавление источников, context_id и turn_index)
  private finalizeLastAssistantMessage(sources: Source[], contextId: string): void {
    this.chatHistory.update(messages => {
      console.log(sources)
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.sender === 'assistant') {
        lastMessage.sources = sources && sources.length > 0 ? sources : undefined;
        lastMessage.context_id = contextId;

        // Вычисляем turn_index: это количество ответов ассистента в истории минус 1 (текущее сообщение)
        const assistantMessagesCount = messages.filter(m => m.sender === 'assistant').length;
        lastMessage.turn_index = assistantMessagesCount - 1;
      }
      return [...messages];
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
      this.versionOptions = [];
      return;
    }

    const buttonRules = this.filters.filter_rules.button_rules;

    this.versionOptions = Object.entries(buttonRules)
      .filter(([key]) => key.startsWith('ZIOT_DOCS_'))
      .map(([key, rule]) => ({
        key,
        displayName: (rule.display_name || '').replace('Документация ZIIoT', 'Версия').trim()
      }));

    // Устанавливаем версию в зависимости от currentSource
    if (!this.selectedVersion || !buttonRules[this.selectedVersion]) {
      // Если есть currentSource, используем маппинг
      if (this.currentSource) {
        const sourceToVersionMap: { [key: string]: string } = {
          'ziiot': 'ZIOT_DOCS_220',
          'ziak': 'ZIAK_DOCS_LATEST',
          'projectmgmt': 'PROJECT_MGMT',
          'autobp': 'AUTOBP_KB'
        };
        this.selectedVersion = sourceToVersionMap[this.currentSource] || 'ZIOT_DOCS_220';
      } else {
        // По умолчанию ZIOT_DOCS_220
        this.selectedVersion = 'ZIOT_DOCS_220';
      }
    }

    const buttonRule = buttonRules[this.selectedVersion];
    if (buttonRule && buttonRule.includes) {
      this.filterSearch = [...buttonRule.includes];
      console.log(`Версия ${this.selectedVersion} выбрана. filterSearch:`, this.filterSearch);
    } else {
      this.filterSearch = [];
      console.warn(`Правило для ${this.selectedVersion} не найдено или не содержит includes`);
    }
  }

  // Установка версии в зависимости от источника (context_label)
  private setVersionBySource(source: string): void {
    const sourceToVersionMap: { [key: string]: string } = {
      'ziiot': 'ZIOT_DOCS_220',
      'ziak': 'ZIAK_DOCS_LATEST',
      'projectmgmt': 'PROJECT_MGMT',
      'autobp': 'AUTOBP_KB'
    };

    const newVersion = sourceToVersionMap[source];
    if (newVersion) {
      this.selectedVersion = newVersion;
      this.updateFilterSearch();
      console.log(`Версия установлена по источнику "${source}": ${this.selectedVersion}`);
    } else {
      console.warn(`Неизвестный источник: ${source}`);
    }
  }

  private scrollToBottom(): void {
    // Прокручиваем только если автоскролл включен
    if (!this.autoScrollEnabled) {
      return;
    }

    // Временно отключаем обработчик скролла
    const container = document.getElementById('chatMessages');
    if (container && this.scrollHandler) {
      container.removeEventListener('scroll', this.scrollHandler);
    }

    setTimeout(() => {
      if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });

        // Включаем обработчик обратно через небольшую задержку
        setTimeout(() => {
          if (container && this.scrollHandler) {
            container.addEventListener('scroll', this.scrollHandler);
          }
        }, 300);
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

  removeExtension(filename: string): string {
    return this.textFormatter.removeExtension(filename);
  }

  shortenFileName(filename: string): string {
    return this.textFormatter.shortenFileName(filename);
  }

  // Проверяет, есть ли активный запрос для данного контекста
  hasActiveRequest(contextId: string): boolean {
    return this.pendingRequestContextIds.has(contextId);
  }

  // Проверяет, нужно ли показывать анимацию загрузки для данного контекста
  hasLoadingIndicator(contextId: string): boolean {
    return this.loadingIndicatorContextIds.has(contextId);
  }

  // Отправка обратной связи (Like/Dislike)
  sendFeedback(contextId: string, turn_index: number, feedback_type: string): void {
    console.log(`Отправка обратной связи: contextId=${contextId}, turn_index=${turn_index}, type=${feedback_type}`);

    // Находим текущее сообщение для проверки существующего feedback_type
    const currentMessage = this.chatHistory().find(message =>
      message.sender === 'assistant' &&
      message.context_id === contextId &&
      message.turn_index === turn_index
    );

    const currentFeedbackType = currentMessage?.feedback_type;

    // Если кликнули на уже активный feedback - убираем его
    if (currentFeedbackType === feedback_type) {
      const deleteFeedbackType = feedback_type === 'like' ? 'delete_like' : 'delete_dislike';
      console.log(`Отмена feedback: ${deleteFeedbackType}`);

      this.chatService.Feedback(contextId, turn_index, deleteFeedbackType).subscribe({
        next: (response) => {
          console.log('Feedback успешно отменен:', response);

          // Убираем feedback_type из локального состояния
          this.chatHistory.update(messages => {
            return messages.map(message => {
              if (message.sender === 'assistant' &&
                  message.context_id === contextId &&
                  message.turn_index === turn_index) {
                return { ...message, feedback_type: '' };
              }
              return message;
            });
          });
        },
        error: (error) => {
          console.error('Ошибка при отмене feedback:', error);
        }
      });
      return;
    }

    // Если уже есть другой feedback, сначала удаляем его
    if (currentFeedbackType && currentFeedbackType !== '') {
      const deleteFeedbackType = currentFeedbackType === 'like' ? 'delete_like' : 'delete_dislike';
      console.log(`Удаление существующего feedback: ${deleteFeedbackType}`);

      // Сначала удаляем существующий feedback
      this.chatService.Feedback(contextId, turn_index, deleteFeedbackType).subscribe({
        next: (response) => {
          console.log('Существующий feedback удален успешно:', response);

          // После успешного удаления устанавливаем новый feedback
          this.setFeedback(contextId, turn_index, feedback_type);
        },
        error: (error) => {
          console.error('Ошибка при удалении существующего feedback:', error);
        }
      });
    } else {
      // Если feedback пустой, просто устанавливаем новый
      this.setFeedback(contextId, turn_index, feedback_type);
    }
  }

  // Вспомогательный метод для установки feedback
  private setFeedback(contextId: string, turn_index: number, feedback_type: string): void {
    this.chatService.Feedback(contextId, turn_index, feedback_type).subscribe({
      next: (response) => {
        console.log('Обратная связь отправлена успешно:', response);

        // Обновляем feedback_type в локальном состоянии сообщения
        this.chatHistory.update(messages => {
          return messages.map(message => {
            if (message.sender === 'assistant' &&
                message.context_id === contextId &&
                message.turn_index === turn_index) {
              return { ...message, feedback_type: feedback_type };
            }
            return message;
          });
        });
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

  // Открыть модальное окно предложения источника
  openOfferSourceModal(): void {
    this.showOfferSourceModal = true;
  }

  // Закрыть модальное окно предложения источника
  closeOfferSourceModal(): void {
    this.showOfferSourceModal = false;
  }

  // Переключение веб-поиска
  toggleWebSearch(): void {
    this.webSearchActive = !this.webSearchActive;
    console.log('Веб-поиск:', this.webSearchActive ? 'включен' : 'выключен');
  }

}
