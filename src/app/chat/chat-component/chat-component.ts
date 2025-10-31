import { Component, inject, signal } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {ChatMessage, Context, TurnResponse} from '../interface/interface';
import {SidebarComponent} from '../sidebar-component/sidebar-component';
import {ChatService} from '../../services/chat-service';
import {toObservable} from '@angular/core/rxjs-interop';
import {TextFormatterService} from '../../format-text/text-formatter.service';
import {tap} from 'rxjs';

@Component({
  selector: 'app-chat-component',
  imports: [CommonModule, FormsModule, SidebarComponent, AsyncPipe],
  templateUrl: './chat-component.html',
  styleUrl: './chat-component.scss'
})
export class ChatComponent {
  chatService = inject(ChatService);
  textFormatter = inject(TextFormatterService);
  chatHistory = signal<ChatMessage[]>([]);
  chatHistory$ = toObservable(this.chatHistory);
  userInput: string = '';
  showWelcome: boolean = true;
  contexts: Context[] = [];
  selectedContextId: string = '';
  currentDialog: TurnResponse | null = null;
  isRequestPending: boolean = false;
  userTextFlag: boolean = false;

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
      this.isRequestPending = true;

      if (!this.userTextFlag) {
        try {
          localStorage.setItem(`${this.selectedContextId}`, messageText);
          console.log('Сохранение!')
        }
        catch {
          console.log('Ошибка')
        }
      }

      this.chatService.QuestContext(messageText, this.selectedContextId)
        .pipe(
          tap(() => {
            // Устанавливаем флаг сразу после отправки запроса
            this.userTextFlag = true;
          })
        )
        .subscribe({
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
        },
        complete: () => {
          this.isRequestPending = false;
          this.userTextFlag = false;
          localStorage.setItem(`${this.selectedContextId}`, '');
          console.log('localStorage был удалён!');
        }
      });
    } else  {
      this.showWelcome = false

      // Создаем новый контекст, переключаемся на него, скрываем welcome и отправляем вопрос
      this.isRequestPending = true;
      this.chatService.createContext().subscribe({
        next: (newContextId: string) => {
          this.loadContexts();
          this.selectedContextId = newContextId;

          const switchContexts$ = this.chatService.switchContexts(newContextId);
          switchContexts$
            .pipe(
              tap((response) => {
                console.log('tap() выполнился в компоненте! Response:', response);
                // Восстанавливаем сообщение из localStorage после переключения контекста
                const storedMessage = localStorage.getItem(newContextId);
                console.log('storedMessage:', storedMessage);
                console.log('this.userInput:', this.userInput);
              })
            )
            .subscribe({
            next: (response) => {
              console.log('switchContexts next() выполнился! Response:', response);
              this.showWelcome = false;
              
              // Сохраняем сообщение в localStorage перед отправкой запроса
              try {
                localStorage.setItem(`${newContextId}`, messageText);
                console.log('Сохранение для нового контекста!');
              } catch {
                console.log('Ошибка сохранения в localStorage');
              }
              
              this.chatService.QuestContext(messageText, newContextId)
                .subscribe({
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
                },
                complete: () => {
                  this.isRequestPending = false;
                  localStorage.setItem(`${newContextId}`, '');
                  console.log('localStorage был удалён для нового контекста!');
                }
              });
            },
            error: (error) => {
              console.error('Ошибка при переключении контекста:', error);
              this.appendMessage('assistant', 'Ошибка при создании нового диалога.', Date.now());
              this.isRequestPending = false;
            }
          });
        },
        error: (error) => {
          console.error('Ошибка при создании контекста:', error);
          this.appendMessage('assistant', 'Ошибка при создании нового диалога.', Date.now());
          this.isRequestPending = false;
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
    return this.textFormatter.formatTimestamp(timestamp);
  }

  formatMessageText(text: string): string {
    return this.textFormatter.formatMessageText(text);
  }
}








// ---------------------------------------------

// import { Component, inject, signal, OnDestroy } from '@angular/core';
// import { CommonModule, AsyncPipe } from '@angular/common';
// import { FormsModule } from '@angular/forms';
// import { ChatMessage, Context, TurnResponse } from '../interface/interface';
// import { SidebarComponent } from '../sidebar-component/sidebar-component';
// import { ChatService } from '../../services/chat-service';
// import { toObservable } from '@angular/core/rxjs-interop';
// import { TextFormatterService } from '../../format-text/text-formatter.service';
// import { Subject, Subscription } from 'rxjs';
// import { takeUntil, switchMap, tap } from 'rxjs/operators';
//
// @Component({
//   selector: 'app-chat-component',
//   imports: [CommonModule, FormsModule, SidebarComponent, AsyncPipe],
//   templateUrl: './chat-component.html',
//   styleUrl: './chat-component.scss'
// })
// export class ChatComponent implements OnDestroy {
//   chatService = inject(ChatService);
//   textFormatter = inject(TextFormatterService);
//   chatHistory = signal<ChatMessage[]>([]);
//   chatHistory$ = toObservable(this.chatHistory);
//   userInput: string = '';
//   showWelcome: boolean = true;
//   contexts: Context[] = [];
//   selectedContextId: string = '';
//   currentDialog: TurnResponse | null = null;
//   isRequestPending: boolean = false;
//   userTextFlag: boolean = false;
//
//   // Разделенные подписки
//   private destroy$ = new Subject<void>();
//   private contextSubscriptions = new Subscription();
//   private messageSubscriptions = new Subscription();
//   private initializationSubscriptions = new Subscription();
//
//   constructor() {
//     this.loadContexts();
//   }
//
//   private loadContexts(): void {
//     // Очищаем предыдущие подписки контекстов
//     this.contextSubscriptions.unsubscribe();
//     this.contextSubscriptions = new Subscription();
//
//     this.contextSubscriptions.add(
//       this.chatService.getContexts()
//         .pipe(takeUntil(this.destroy$))
//         .subscribe(val => {
//           this.contexts = val;
//         })
//     );
//   }
//
//   onContextSelected(contextId: string): void {
//     // Очищаем предыдущие операции с контекстами
//     this.contextSubscriptions.unsubscribe();
//     this.contextSubscriptions = new Subscription();
//
//     if (!contextId) {
//       this.contextSubscriptions.add(
//         this.chatService.createContext()
//           .pipe(takeUntil(this.destroy$))
//           .subscribe({
//             next: (newContextId: string) => {
//               this.loadContexts();
//               this.selectedContextId = newContextId;
//
//               // Подписка на switchContexts
//               this.contextSubscriptions.add(
//                 this.chatService.switchContexts(newContextId)
//                   .pipe(takeUntil(this.destroy$))
//                   .subscribe()
//               );
//
//               this.loadDialog(newContextId);
//             },
//             error: () => {
//               this.chatHistory.set([]);
//               this.showWelcome = true;
//               this.currentDialog = null;
//             }
//           })
//       );
//       return;
//     }
//
//     // Переключение на существующий контекст
//     this.contextSubscriptions.add(
//       this.chatService.switchContexts(contextId)
//         .pipe(takeUntil(this.destroy$))
//         .subscribe()
//     );
//     this.selectedContextId = contextId;
//     this.loadDialog(contextId);
//   }
//
//   onContextDeleted(contextId: string): void {
//     if (this.isRequestPending) {
//       return;
//     }
//
//     this.contextSubscriptions.add(
//       this.chatService.deleteContext(contextId)
//         .pipe(takeUntil(this.destroy$))
//         .subscribe({
//           next: () => {
//             if (this.selectedContextId === contextId) {
//               this.chatHistory.set([]);
//               this.showWelcome = true;
//               this.currentDialog = null;
//               this.selectedContextId = '';
//             }
//             this.loadContexts();
//           },
//           error: (error) => {
//             console.error('Ошибка при удалении контекста:', error);
//           }
//         })
//     );
//   }
//
//   private loadDialog(contextId: string): void {
//     this.contextSubscriptions.add(
//       this.chatService.getTurn(contextId)
//         .pipe(takeUntil(this.destroy$))
//         .subscribe(response => {
//           this.currentDialog = response;
//           this.showWelcome = false;
//
//           const messages: ChatMessage[] = [];
//           if (response.turns && response.turns.length > 0) {
//             response.turns.forEach(turn => {
//               messages.push({
//                 sender: 'user',
//                 text: turn.q,
//                 ts: turn.ts
//               });
//
//               messages.push({
//                 sender: 'assistant',
//                 text: turn.a,
//                 ts: turn.ts
//               });
//             });
//           }
//           this.chatHistory.set(messages);
//
//           setTimeout(() => {
//             const container = document.getElementById('chatMessages');
//             if (container) {
//               container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
//             }
//           }, 100);
//         })
//     );
//   }
//
//   adjustHeight(event: Event): void {
//     const elem = event.target as HTMLTextAreaElement;
//     elem.style.height = 'auto';
//     elem.style.height = elem.scrollHeight + 'px';
//   }
//
//   checkEnter(event: KeyboardEvent): void {
//     if (event.key === 'Enter' && !event.shiftKey) {
//       event.preventDefault();
//       this.submitMessage();
//     }
//   }
//
//   submitMessage(): void {
//     const messageText = this.userInput.trim();
//     if (!messageText) return;
//
//     this.appendMessage('user', messageText, 0);
//     this.userInput = '';
//
//     // Сброс высоты textarea
//     setTimeout(() => {
//       const textarea = document.getElementById('userInput') as HTMLTextAreaElement;
//       if (textarea) {
//         textarea.style.height = 'auto';
//       }
//     }, 0);
//
//     // Очищаем предыдущие подписки сообщений
//     this.messageSubscriptions.unsubscribe();
//     this.messageSubscriptions = new Subscription();
//
//     if (this.selectedContextId) {
//       this.sendWithExistingContext(messageText);
//     } else if (this.showWelcome) {
//       this.sendWithNewContext(messageText);
//     }
//   }
//
//   private sendWithExistingContext(messageText: string): void {
//     this.isRequestPending = true;
//
//     if (!this.userTextFlag) {
//       localStorage.setItem(`${this.selectedContextId}`, messageText);
//     }
//
//     this.messageSubscriptions.add(
//       this.chatService.QuestContext(messageText, this.selectedContextId)
//         .pipe(
//           tap(() => {
//             console.log('Логировагниеыфвыфвыф')
//             this.userTextFlag = true;
//           }),
//           takeUntil(this.destroy$)
//         )
//         .subscribe({
//           next: (response) => {
//             if (response && response.answer) {
//               this.appendMessage('assistant', response.answer, Date.now());
//             } else {
//               console.error('Некорректный ответ от сервера:', response);
//               this.appendMessage('assistant', 'Получен некорректный ответ от сервера', Date.now());
//             }
//           },
//           error: (error) => {
//             console.error('Ошибка при отправке вопроса:', error);
//             this.appendMessage('assistant', 'Извините, произошла ошибка при обработке вашего вопроса.', Date.now());
//           },
//           complete: () => {
//             this.isRequestPending = false;
//             this.userTextFlag = false;
//             localStorage.setItem(`${this.selectedContextId}`, '');
//             console.log('localStorage был удалён!');
//           }
//         })
//     );
//   }
//
//   private sendWithNewContext(messageText: string): void {
//     this.isRequestPending = true;
//
//     this.messageSubscriptions.add(
//       this.chatService.createContext()
//         .pipe(
//           switchMap((newContextId: string) => {
//             this.loadContexts();
//             this.selectedContextId = newContextId;
//             localStorage.setItem(newContextId, messageText);
//
//             console.log('Перед вызовом switchContexts:', newContextId);
//
//             return this.chatService.switchContexts(newContextId).pipe(
//               tap((response) => {
//                 console.log('switchContexts tap выполнен! Response:', response);
//                 const storedMessage = localStorage.getItem(newContextId);
//                 console.log('storedMessage:', storedMessage);
//                 console.log('this.userInput:', this.userInput);
//                 if (storedMessage && !!this.userInput) {
//                   console.log('Условие выполнено!');
//                 }
//               }),
//               switchMap(() => {
//                 console.log('switchContexts next() выполнился!');
//                 this.showWelcome = false;
//                 return this.chatService.QuestContext(messageText, newContextId);
//               })
//             );
//           }),
//           takeUntil(this.destroy$)
//         )
//         .subscribe({
//           next: (response) => {
//             if (response && response.answer) {
//               this.appendMessage('assistant', response.answer, Date.now());
//               console.log('ПРИШЁЛ ОТВЕТ');
//             } else {
//               console.error('Некорректный ответ от сервера:', response);
//               this.appendMessage('assistant', 'Получен некорректный ответ от сервера', Date.now());
//             }
//           },
//           error: (error) => {
//             console.error('Ошибка при создании контекста:', error);
//             this.appendMessage('assistant', 'Ошибка при создании нового диалога.', Date.now());
//             this.isRequestPending = false;
//           },
//           complete: () => {
//             this.isRequestPending = false;
//           }
//         })
//     );
//   }
//
//   appendMessage(sender: 'user' | 'assistant', text: string, ts: number): void {
//     this.chatHistory.update(messages => [...messages, { sender: sender, text: text, ts: ts }]);
//
//     setTimeout(() => {
//       const container = document.getElementById('chatMessages');
//       if (container) {
//         container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
//       }
//     }, 100);
//   }
//
//   getMessageIcon(sender: 'user' | 'assistant'): string {
//     return sender === 'user' ? 'Вы' : 'AI';
//   }
//
//   formatTimestamp(timestamp: number): string {
//     return this.textFormatter.formatTimestamp(timestamp);
//   }
//
//   formatMessageText(text: string): string {
//     return this.textFormatter.formatMessageText(text);
//   }
//
//   ngOnDestroy(): void {
//     // Очищаем все подписки
//     this.destroy$.next();
//     this.destroy$.complete();
//     this.contextSubscriptions.unsubscribe();
//     this.messageSubscriptions.unsubscribe();
//     this.initializationSubscriptions.unsubscribe();
//   }
// }
