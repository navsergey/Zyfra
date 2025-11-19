import {inject, Injectable} from '@angular/core';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {
  Context,
  ContextsResponse,
  CreateContext, FeedbackRequest, FilterRulesResponse, Health,
  QueryRequest,
  QueryResponse,
  SwitchContext,
  TurnResponse,
  StreamEvent,
  ErrorEvent, OfferSourceResponce, OfferSourceRequest
} from '../chat/interface/interface';
import {Observable, catchError, of, map, throwError, tap, Observer} from 'rxjs';
import {AuthService} from '../authpage/auth/auth';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  http = inject(HttpClient)
  authService = inject(AuthService)
  baseApiUrl = 'https://dev.study.dp.zyfra.com/';

  private getAuthHeaders(): HttpHeaders {
    // Получаем токен из AuthService используя новый метод
    const token = this.authService.getToken();

    if (token) {
      return new HttpHeaders({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      });
    }

    console.warn('Токен авторизации не найден, запрос будет отправлен без авторизации');
    return new HttpHeaders({
      'Content-Type': 'application/json'
    });
  }

  createContext(): Observable<string> {
    const headers = this.getAuthHeaders();

    return this.http.post<CreateContext>(`${this.baseApiUrl}contexts/new`, {}, { headers }).pipe(
      map(response => {
        if (response.success) {
          return response.context_id;
        }
        throw new Error(response.message);
      }),
      catchError(error => {
        console.error('HTTP ошибка:', error);
        return throwError(() => new Error('Не удалось создать новый диалог'));
      })
    );
  }

  deleteContext(contextId: string): Observable<string> {
    const headers = this.getAuthHeaders();

    return this.http.delete<string>(
      `${this.baseApiUrl}contexts/${contextId}`,
      { headers }
    );
  }

  getContexts(): Observable<Context[]> {
    const headers = this.getAuthHeaders();

    return this.http.get<ContextsResponse>(`${this.baseApiUrl}contexts`, { headers }).pipe(
      // Извлекаем массив contexts из ответа
      map((response: ContextsResponse) => response.contexts || []),
      catchError(error => {
        console.error('Ошибка при получении контекстов:', error);
        console.error('Статус ошибки:', error.status);
        console.error('Сообщение ошибки:', error.message);

        // Если 403, возможно проблема с авторизацией
        if (error.status === 403) {
          console.error('403 Forbidden - проверьте токен авторизации');
        }

        return of([]); // Возвращаем пустой массив в случае ошибки
      })
    );
  }

  switchContexts(contextId:string): Observable<SwitchContext> {
    const headers = this.getAuthHeaders();

    const request$ = this.http.post<SwitchContext>(`${this.baseApiUrl}contexts/${contextId}/activate`, {context_id: contextId}, { headers });

    return request$.pipe(
      catchError(error => {
        console.error('Ошибка при переключении контекста:', error);
        console.error('Статус ошибки:', error.status);
        console.error('Сообщение ошибки:', error.message);

        // Если 403, возможно проблема с авторизацией
        if (error.status === 403) {
          console.error('403 Forbidden - проверьте токен авторизации');
        }

        // Возвращаем пустой объект SwitchContext в случае ошибки
        return of({ context_id: contextId } as SwitchContext);
      }),
    );
  }

  QuestContext(question: string, contextId: string, active_sources: string[], web_search_active:boolean, session_id:string, context_label:string): Observable<QueryResponse> {
    const headers = this.getAuthHeaders();

    // Создаем объект запроса с правильным интерфейсом
    const request: QueryRequest = {
      context_id: contextId,
      question: question,
      active_sources: active_sources,
      web_search_active:web_search_active,
      session_id: session_id,
      context_label: context_label,
    };

    return this.http.post<QueryResponse>(`${this.baseApiUrl}query`, request, { headers }).pipe(
      catchError(error => {
        console.error('Ошибка при отправке вопроса:', error);
        console.error('Статус ошибки:', error.status);
        console.error('Сообщение ошибки:', error.message);

        // Если 403, возможно проблема с авторизацией
        if (error.status === 403) {
          console.error('403 Forbidden - проверьте токен авторизации');
        }

        // Возвращаем объект QueryResponse с сообщением об ошибке
        return of({
          answer: 'Извините, произошла ошибка при обработке вашего вопроса.',
          context_id: contextId,
          sources: []
        });
      })
    );
  }


  QuestStreamContext(question: string, contextId: string, active_sources: string[],web_search_active:boolean, session_id:string, context_label: string): Observable<StreamEvent> {
    const token = this.authService.getToken();

    // Создаем объект запроса с правильным интерфейсом
    const request: QueryRequest = {
      context_id: contextId,
      question: question,
      active_sources: active_sources,
      web_search_active: web_search_active,
      session_id: session_id,
      context_label: context_label,
    };

    return new Observable<StreamEvent>((observer: Observer<StreamEvent>) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Используем fetch API для работы с SSE
      fetch(`${this.baseApiUrl}query/stream`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(request)
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          if (!response.body) {
            throw new Error('Response body is null');
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';

          // Функция для чтения потока
          const readStream = (): void => {
            reader.read().then(({ done, value }) => {
              if (done) {
                console.log('Stream complete');
                observer.complete();
                return;
              }

              // Декодируем чанк данных
              buffer += decoder.decode(value, { stream: true });

              // Разбиваем буфер на строки
              const lines = buffer.split('\n');

              // Оставляем последнюю (возможно неполную) строку в буфере
              buffer = lines.pop() || '';

              // Обрабатываем каждую строку
              for (const line of lines) {
                const trimmedLine = line.trim();

                // SSE формат: "data: {...}"
                if (trimmedLine.startsWith('data: ')) {
                  const jsonStr = trimmedLine.substring(6); // Убираем "data: "

                  try {
                    const event = JSON.parse(jsonStr) as StreamEvent;
                    observer.next(event);

                    // Если получили событие 'done', завершаем поток
                    if (event.type === 'done') {
                      observer.complete();
                      reader.cancel();
                      return;
                    }
                  } catch (parseError) {
                    console.error('Ошибка парсинга JSON:', parseError, 'JSON:', jsonStr);
                  }
                }
              }

              // Продолжаем читать поток
              readStream();
            }).catch(error => {
              console.error('Ошибка при чтении потока:', error);
              const errorEvent: ErrorEvent = {
                type: 'error',
                message: 'Ошибка при чтении потока данных',
                error_code: 'STREAM_READ_ERROR'
              };
              observer.next(errorEvent);
              observer.error(error);
            });
          };

          // Начинаем читать поток
          readStream();
        })
        .catch(error => {
          console.error('Ошибка при отправке запроса:', error);

          // Отправляем событие ошибки
          const errorEvent: ErrorEvent = {
            type: 'error',
            message: error.message || 'Ошибка при подключении к серверу',
            error_code: 'CONNECTION_ERROR'
          };
          observer.next(errorEvent);
          observer.error(error);
        });

      // Cleanup функция для отмены запроса при unsubscribe
      return () => {
        console.log('Отписка от SSE потока');
      };
    });
  }






  getTurn(contextId:string): Observable<TurnResponse> {
    const headers = this.getAuthHeaders();

    return this.http.get<TurnResponse>(`${this.baseApiUrl}contexts/${contextId}`, { headers }).pipe(
      catchError(error => {
        console.error('Ошибка при получении контекста:', error);
        console.error('Статус ошибки:', error.status);
        console.error('Сообщение ошибки:', error.message);

        // Если 403, возможно проблема с авторизацией
        if (error.status === 403) {
          console.error('403 Forbidden - проверьте токен авторизации');
        }

        // Возвращаем пустой объект TurnResponse в случае ошибки
        return of({
          context_id: '',
          title: '',
          created_at: '',
          last_activity: '',
          turn_count: 0,
          is_active: false,
          turns: [],
          context_label: '',
        });
      })
    );
  }

  getHealth(): Observable<Health> {
    const headers = this.getAuthHeaders();

    return this.http.get<Health>(`${this.baseApiUrl}health`, { headers }).pipe(
      catchError(error => {
        console.error('Ошибка при получении контекста:', error);
        console.error('Статус ошибки:', error.status);
        console.error('Сообщение ошибки:', error.message);

        // Если 403, возможно проблема с авторизацией
        if (error.status === 403) {
          console.error('403 Forbidden - проверьте токен авторизации');
        }

        // Возвращаем пустой объект Health в случае ошибки
        return of({
          status: 'error',
          documents_loaded: 0,
          vector_db_initialized: false
        });
      })
    );
  }


  getFilterRules(): Observable<FilterRulesResponse> {
    const headers = this.getAuthHeaders();
    // Добавляем X-Admin-Key к существующим headers
    return this.http.get<FilterRulesResponse>(`${this.baseApiUrl}config/filter-rules`, { headers }).pipe(
      catchError(error => {
        console.error('Ошибка при получении правил фильтрации:', error);
        console.error('Статус ошибки:', error.status);
        console.error('Сообщение ошибки:', error.message);

        // Если 403, возможно проблема с авторизацией
        if (error.status === 403) {
          console.error('403 Forbidden - проверьте токен авторизации');
        }

        // Возвращаем объект FilterRulesResponse с ошибкой
        return of({
          success: false,
          message: 'Ошибка при получении правил фильтрации',
          filter_rules: {
            comment: '',
            default_active_sources: [],
            button_rules: {}
          }
        });
      })
    );
  }

  Feedback(contextId: string, turn_index: number, feedback_type: string): Observable<FeedbackRequest> {
    const headers = this.getAuthHeaders();

    const request: FeedbackRequest = {
      context_id: contextId,
      turn_index: turn_index,
      feedback_type: feedback_type
    };

    return this.http.post<FeedbackRequest>(`${this.baseApiUrl}feedback`, request, { headers }).pipe(
      catchError(error => {
        console.error('Ошибка при отправке обратной связи:', error);
        console.error('Статус ошибки:', error.status);
        console.error('Сообщение ошибки:', error.message);

        // Если 403, возможно проблема с авторизацией
        if (error.status === 403) {
          console.error('403 Forbidden - проверьте токен авторизации');
        }

        // Возвращаем объект с ошибкой
        return of({
          context_id: contextId,
          turn_index: turn_index,
          feedback_type: 'error'
        });
      })
    );
  }


  OfferSource(url: string, category: string | null, comment: string | null): Observable<OfferSourceResponce> {
    const headers = this.getAuthHeaders();

    const request: OfferSourceRequest = {
      url: url,
      category: category || '',
      comment: comment || ''
    };

    return this.http.post<OfferSourceResponce>(`${this.baseApiUrl}sources/offer`, request, { headers }).pipe(
      catchError(error => {
        console.error('Ошибка при отправке обратной связи:', error);
        console.error('Статус ошибки:', error.status);
        console.error('Сообщение ошибки:', error.message);

        // Если 403, возможно проблема с авторизацией
        if (error.status === 403) {
          console.error('403 Forbidden - проверьте токен авторизации');
        }

        // Возвращаем объект с ошибкой
        return of({
            success: false,
            message: '',
            link_id: '',
        });
      })
    );
  }


}
