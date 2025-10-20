import {Component, inject} from '@angular/core';
import {ChatService} from '../../services/chat-service';
import {Context} from '../../chat/interface/interface';

@Component({
  selector: 'app-history-component',
  imports: [],
  templateUrl: './history-component.html',
  styleUrl: './history-component.scss'
})
export class HistoryComponent {
  chatService = inject(ChatService);
  context: Context[] = []

  constructor() {
    this.chatService.getContexts().subscribe({
      next: (val) => {
        this.context = val;
        console.log('Получены контексты:', this.context);
      },
      error: (error) => {
        console.error('Ошибка при загрузке контекстов:', error);
        this.context = [];
      }
    });
  }
}
