import {inject, Injectable} from '@angular/core';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {
  Context,
  ContextsResponse,
  CreateContext,
  QueryRequest,
  QueryResponse,
  SwitchContext,
  TurnResponse
} from '../chat/interface/interface';
import {Observable, catchError, of, map, throwError} from 'rxjs';
import {AuthService} from '../authpage/auth/auth';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  http = inject(HttpClient)
  authService = inject(AuthService)
  baseApiUrl = 'http://localhost:53593/';

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

    return this.http.post<SwitchContext>(`${this.baseApiUrl}contexts/${contextId}/activate`, {context_id: contextId}, { headers }).pipe(
      catchError(error => {
        console.error('Ошибка при переключении контекста:', error);
        console.error('Статус ошибки:', error.status);
        console.error('Сообщение ошибки:', error.message);

        // Если 403, возможно проблема с авторизацией
        if (error.status === 403) {
          console.error('403 Forbidden - проверьте токен авторизации');
        }

        // Возвращаем пустой объект SwitchContext в случае ошибки
        return of();
      })
    );
  }

  QuestContext(question: string, contextId: string): Observable<QueryResponse> {
    const headers = this.getAuthHeaders();

    // Создаем объект запроса с правильным интерфейсом
    const request: QueryRequest = {
      context_id: contextId,
      question: question
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
          turns: []
        });
      })
    );
  }





}
