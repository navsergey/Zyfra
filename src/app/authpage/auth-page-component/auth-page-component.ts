import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-auth-page-component',
  imports: [CommonModule, FormsModule],
  templateUrl: './auth-page-component.html',
  styleUrl: './auth-page-component.scss'
})
export class AuthPageComponent {
  username: string = '';
  password: string = '';
  showPassword: boolean = false;

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    if (this.username && this.password) {
      console.log('Вход:', { username: this.username, password: this.password });
      // Здесь будет логика авторизации
    }
  }
}
