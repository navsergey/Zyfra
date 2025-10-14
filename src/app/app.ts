import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {ChatComponent} from './chat/chat-component/chat-component';
import {AuthPageComponent} from './authpage/auth-page-component/auth-page-component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ChatComponent, AuthPageComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('zyfra1.0');
}
