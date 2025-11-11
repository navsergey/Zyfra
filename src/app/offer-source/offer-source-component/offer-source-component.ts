import { Component, Output, EventEmitter, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ChatService } from '../../services/chat-service';

@Component({
  selector: 'app-offer-source-component',
  imports: [FormsModule, CommonModule],
  templateUrl: './offer-source-component.html',
  styleUrl: './offer-source-component.scss'
})
export class OfferSourceComponent {
  @Output() close = new EventEmitter<void>();
  
  chatService = inject(ChatService);
  
  // Поля формы
  sourceLink: string = '';
  category: string = '';
  comment: string = '';
  
  // Статус отправки
  isSubmitting: boolean = false;
  submitSuccess: boolean = false;
  submitError: string = '';

  closeForm(): void {
    this.close.emit();
  }
  
  submitForm(): void {
    // Проверка обязательного поля url
    if (!this.sourceLink || this.sourceLink.trim() === '') {
      this.submitError = 'Ссылка на источник обязательна для заполнения';
      return;
    }
    
    // Сброс статусов
    this.submitError = '';
    this.isSubmitting = true;
    this.submitSuccess = false;
    
    // Подготовка данных (category и comment могут быть пустыми)
    const categoryValue = this.category && this.category.trim() !== '' ? this.category : null;
    const commentValue = this.comment && this.comment.trim() !== '' ? this.comment : null;
    
    // Отправка данных
    this.chatService.OfferSource(this.sourceLink.trim(), categoryValue, commentValue)
      .subscribe({
        next: (response) => {
          this.isSubmitting = false;
          if (response.success) {
            this.submitSuccess = true;
            console.log('Источник успешно отправлен:', response);
            
            // Очистка формы после успешной отправки
            this.sourceLink = '';
            this.category = '';
            this.comment = '';
            
            // Закрытие формы через 1.5 секунды
            setTimeout(() => {
              this.close.emit();
            }, 1500);
          } else {
            this.submitError = response.message || 'Такая ссылка уже была предложена';
          }
        },
        error: (error) => {
          this.isSubmitting = false;
          this.submitError = 'Произошла ошибка при отправке. Попробуйте снова.';
          console.error('Ошибка при отправке источника:', error);
        }
      });
  }
}
