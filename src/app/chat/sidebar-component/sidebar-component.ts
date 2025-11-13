import {Component, Input, Output, EventEmitter} from '@angular/core';
import {Context} from '../interface/interface';

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
  @Output() contextSelected = new EventEmitter<string>(); // Событие выбора контекста
  @Output() contextDeleted = new EventEmitter<string>(); // Событие удаления контекста
  @Output() homeRequested = new EventEmitter<void>(); // Событие перехода на главную


  createNewChat(): void {
    // Проверяем, нет ли уже пустого контекста
    if (this.hasEmptyContext()) {
      console.log('Уже существует пустой контекст');
      return;
    }
    this.contextSelected.emit(''); // Сбрасываем выбранный контекст
  }

  goToHome(): void {
    // Переход на главную страницу (показать welcome экран)
    this.homeRequested.emit();
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

}
