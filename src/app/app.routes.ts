import { Routes } from '@angular/router';
import {AuthPageComponent} from './authpage/auth-page-component/auth-page-component';
import {ChatComponent} from './chat/chat-component/chat-component';
import {canActivateAuth} from './authpage/auth/acces.guard';

export const routes: Routes = [

  {path: '', component: ChatComponent,
    canActivate: [canActivateAuth]
  },

  {path: 'login', component: AuthPageComponent},
];
