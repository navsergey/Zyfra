import {Component, Input} from '@angular/core';
import {ChatMessage, Context} from '../interface/interface';

@Component({
  selector: 'app-sidebar-component',
  imports: [],
  templateUrl: './sidebar-component.html',
  styleUrl: './sidebar-component.scss'
})

export class SidebarComponent {

  @Input() contexts!: Context[]; // В компонент передаются данные и далее формируется шаблон HTML

  chatHistory: ChatMessage[] = [];
  userInput: string = '';
  showWelcome: boolean = true;

  createNewChat(): void {
    this.chatHistory = [];
    this.showWelcome = true;
    this.userInput = '';
  }

}
