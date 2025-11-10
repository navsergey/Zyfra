import {inject, Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {CookieService} from 'ngx-cookie-service';
import {tap} from 'rxjs';
import {TokenResponse} from './auth.interface';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  http = inject(HttpClient)
  cookieService = inject(CookieService) //Для вытягивания token из куков
  baseApiUrl = 'https://dev.study.dp.zyfra.com/';

  token: string | null = null;
  refreshtoken: string | null = null;

  get isAuth(){
    if (!this.token){
      this.token = this.cookieService.get('token'); //Проверка куков
    }
    return !!this.token; //Двойное отрицание, чтобы привести к boolean
  }

  getToken(): string | null {
    if (!this.token){
      this.token = this.cookieService.get('token'); //Проверка куков
    }
    return this.token;
  }
  login(payload: { access_code: string }) {
    // Отправляем JSON (raw) в body
    return this.http.post<TokenResponse>(`${this.baseApiUrl}auth`, payload).pipe(
      tap(val => {
        this.token = val.access_token;
        this.refreshtoken = val.refresh_token;
        this.cookieService.set('token', this.token);
        this.cookieService.set('refresh_token', this.refreshtoken);
      })
    )
  }
}
