import {Component, inject} from '@angular/core';
import { CommonModule } from '@angular/common';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {AuthService} from '../auth/auth';
import {Router} from '@angular/router';

@Component({
  selector: 'app-auth-page-component',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './auth-page-component.html',
  styleUrl: './auth-page-component.scss'
})

export class AuthPageComponent {
  authService = inject(AuthService)
  router = inject(Router)

  showPassword: boolean = false;

  form = new FormGroup({
    // username: new FormControl('', Validators.required),
    access_code: new FormControl('', Validators.required),
  })

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }




  onSubmit() {
    if (this.form.valid) {
      console.log('Отправляемые данные:', this.form.value);
      
      this.authService.login(this.form.value as { access_code: string }).subscribe({
        next: (response) => {
          console.log('Успешная авторизация:', response);
          this.router.navigateByUrl('');
        },
        error: (error) => {
          console.error('Ошибка авторизации:', error);
          console.error('Детали ошибки:', error.error);
          alert('Ошибка авторизации: ' + (error.error?.detail || error.message || 'Неверный код доступа'));
        }
      });
    }
  }
}
