import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home.component';
import { TasksComponent } from './features/tasks/tasks.component';
import { MessagesComponent } from './features/messages/messages.component';
import { MembersComponent } from './features/teams/members.component';
import { SettingsComponent } from './features/settings/settings.component';

export const routes: Routes = [
  { path: '', redirectTo: 'tasks', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  { path: 'tasks', component: TasksComponent },
  { path: 'messages', component: MessagesComponent },
  { path: 'members', component: MembersComponent },
  { path: 'settings', component: SettingsComponent },
  { path: '**', redirectTo: 'tasks' }
];
