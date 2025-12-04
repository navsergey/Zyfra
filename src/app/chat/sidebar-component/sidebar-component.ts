import {Component, Input, Output, EventEmitter, inject} from '@angular/core';
import {Context} from '../interface/interface';
import {TextFormatterService} from '../../format-text/text-formatter.service';

@Component({
  selector: 'app-sidebar-component',
  imports: [],
  templateUrl: './sidebar-component.html',
  styleUrl: './sidebar-component.scss'
})

export class SidebarComponent {

  @Input() contexts!: Context[]; // В компонент передаются данные и далее формируется шаблон HTML
  @Input() selectedContextId: string = ''; // ID выбранного контекста
  @Input() pendingRequestContextIds!: Set<string>; // Set контекстов с активными запросами
  @Input() showWelcome: boolean = false;
  @Input() isRequestPending: boolean = false;
  @Output() contextSelected = new EventEmitter<string>(); // Событие выбора контекста
  @Output() contextDeleted = new EventEmitter<string>(); // Событие удаления контекста
  @Output() newChat = new EventEmitter<void>(); // Событие удаления контекста

  textFormatter = inject(TextFormatterService);


  createNewChat(): void {
    // Проверяем, нет ли уже пустого контекста
    if (this.hasEmptyContext()) {
      console.log('Уже существует пустой контекст');
      return;
    }
    this.newChat.emit(); // Сбрасываем выбранный контекст
  }

  selectContext(context: Context): void {
    this.contextSelected.emit(context.context_id);
  }

  deleteContext(event: Event, contextId: string): void {
    event.stopPropagation(); // Предотвращаем всплытие события клика на родительский элемент
    this.contextDeleted.emit(contextId);
  }

  // Проверяет, есть ли пустой контекст (без сообщений и без активного запроса)
  hasEmptyContext(): boolean {
    if (!this.contexts) return false;

    // Контекст считается пустым, только если:
    // 1. В нём нет сообщений (turn_count === 0)
    // 2. И для него НЕ выполняется запрос (нет в pendingRequestContextIds)
    return this.contexts.some(context =>
      context.turn_count === 0 &&
      !this.pendingRequestContextIds?.has(context.context_id)
    );
  }

  formatLastActivity(lastActivity: string): string {
    if (!lastActivity) return '';

    const date = new Date(lastActivity);
    if (!isNaN(date.getTime())) {
      console.log(date)
      return this.textFormatter.formatTimestamp(date.getTime());
    }

    const asNumber = Number(lastActivity);
    if (!isNaN(asNumber)) {
      return this.textFormatter.formatTimestamp(asNumber);
    }

    return lastActivity;
  }

}
