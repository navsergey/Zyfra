import { Component } from '@angular/core';
import { ChatMessage } from '../interface/interface';

@Component({
  selector: 'app-sidebar-component',
  imports: [],
  templateUrl: './sidebar-component.html',
  styleUrl: './sidebar-component.scss'
})

export class SidebarComponent {

  chatHistory: ChatMessage[] = [];
  userInput: string = '';
  showWelcome: boolean = true;

  createNewChat(): void {
    this.chatHistory = [];
    this.showWelcome = true;
    this.userInput = '';
  }

}
