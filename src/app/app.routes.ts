import {Routes} from '@angular/router';
import {HomeComponent} from './home/home.component';
import {authGuard} from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    canActivate: [authGuard]
  },
  {
    path: 'file-management',
    loadChildren: () =>
      import('./features/file-management/file-management.routes').then(m => m.FILE_MANAGEMENT_ROUTES),
    canActivate: [authGuard]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
