import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {ChatMessage} from '../interface/interface';
import {SidebarComponent} from '../sidebar-component/sidebar-component';

@Component({
  selector: 'app-chat-component',
  imports: [CommonModule, FormsModule, SidebarComponent],
  templateUrl: './chat-component.html',
  styleUrl: './chat-component.scss'
})
export class ChatComponent {
  chatHistory: ChatMessage[] = [];
  userInput: string = '';
  showWelcome: boolean = true;

  private aiResponses: string[] = [
    'Для повышения эффективности производства рекомендую внедрить платформу ZIIoT. Она обеспечивает сбор данных с оборудования в режиме реального времени, что позволяет оперативно принимать решения и снижать простои на 25-30%.',
    'Цифра разработала комплексные решения для различных отраслей: горнодобывающей, нефтегазовой, металлургии, энергетики. Каждый дивизион специализируется на своей области, обеспечивая глубокую экспертизу.',
    'Роботизация предприятия начинается с аудита процессов и выявления операций с высоким риском для сотрудников. Дивизион "Цифра Роботикс" поможет разработать стратегию внедрения автоматизированных систем.',
    'Платформа ZIIoT Oil&Gas стала стандартом для промышленной автоматизации в нефтегазовой отрасли. Она интегрирует данные с месторождений, позволяет оптимизировать добычу и прогнозировать работу оборудования.',
    'Для горной промышленности мы предлагаем решения по управлению карьерным транспортом, автоматизации добычных процессов и беспилотному управлению техникой, что повышает безопасность и производительность.',
    'Цифровая трансформация требует комплексного подхода: от стратегии до внедрения. Наши эксперты помогут составить план развития, выбрать интеграторов и обеспечить сопровождение на всех этапах.'
  ];

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

  getTimestamp(): string {
    const date = new Date();
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  useSamplePrompt(promptText: string): void {
    this.userInput = promptText;
    this.submitMessage();
  }

  submitMessage(): void {
    const messageText = this.userInput.trim();

    if (!messageText) return;

    if (this.showWelcome) {
      this.showWelcome = false;
    }

    this.appendMessage('user', messageText);
    this.userInput = '';

    // Сброс высоты textarea
    setTimeout(() => {
      const textarea = document.getElementById('userInput') as HTMLTextAreaElement;
      if (textarea) {
        textarea.style.height = 'auto';
      }
    }, 0);

    // Имитация ответа AI
    setTimeout(() => {
      const randomReply = this.aiResponses[Math.floor(Math.random() * this.aiResponses.length)];
      this.appendMessage('assistant', randomReply);
    }, 1200);
  }

  appendMessage(sender: 'user' | 'assistant', text: string): void {
    const timestamp = this.getTimestamp();
    this.chatHistory.push({ sender, text, timestamp });

    // Автоматическая прокрутка вниз
    setTimeout(() => {
      const container = document.getElementById('chatMessages');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 100);
  }


  getMessageIcon(sender: 'user' | 'assistant'): string {
    return sender === 'user' ? 'Вы' : 'AI';
  }
}
