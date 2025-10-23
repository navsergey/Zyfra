import {Component, Input, Output, EventEmitter} from '@angular/core';
import {ChatMessage, Context} from '../interface/interface';

@Component({
  selector: 'app-sidebar-component',
  imports: [],
  templateUrl: './sidebar-component.html',
  styleUrl: './sidebar-component.scss'
})

export class SidebarComponent {

  @Input() contexts!: Context[]; // В компонент передаются данные и далее формируется шаблон HTML
  @Input() selectedContextId: string = ''; // ID выбранного контекста
  @Output() contextSelected = new EventEmitter<string>(); // Событие выбора контекста
  @Output() contextDeleted = new EventEmitter<string>(); // Событие удаления контекста


  createNewChat(): void {
    this.contextSelected.emit(''); // Сбрасываем выбранный контекст
  }

  selectContext(context: Context): void {
    this.contextSelected.emit(context.context_id);
  }

  deleteContext(event: Event, contextId: string): void {
    event.stopPropagation(); // Предотвращаем всплытие события клика на родительский элемент
    this.contextDeleted.emit(contextId);
  }

}
