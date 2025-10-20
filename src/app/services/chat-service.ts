import {inject, Injectable} from '@angular/core';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {Context} from '../chat/interface/interface';
import {Observable, catchError, of} from 'rxjs';
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
    
    console.log('Используемый токен для авторизации:', token ? `${token.substring(0, 10)}...` : 'не найден');
    
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

  getContexts(): Observable<Context[]> {
    const headers = this.getAuthHeaders();
    
    return this.http.get<Context[]>(`${this.baseApiUrl}contexts`, { headers }).pipe(
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
}
