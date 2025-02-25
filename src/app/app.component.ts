import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

// PrimeNG Imports
import { MenubarModule } from 'primeng/menubar';
import { ButtonModule } from 'primeng/button';
import { MenuItem } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';

// Auth service
import { AuthService } from './auth/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MenubarModule,
    ButtonModule,
    ToastModule,
    AvatarModule
  ],
  providers: [MessageService],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'File Management System';
  menuItems: MenuItem[] = [];

  constructor(
    public authService: AuthService
  ) {}

  ngOnInit() {
    console.log('App component initializing...');

    // Check if already logged in and update UI
    this.updateMenu();
  }

  updateMenu() {
    const isLoggedIn = this.authService.loggedIn();

    this.menuItems = [
      {
        label: 'Home',
        icon: 'pi pi-home',
        routerLink: ['/']
      }
    ];

    if (isLoggedIn) {
      this.menuItems.push(
        {
          label: 'File Management',
          icon: 'pi pi-file',
          routerLink: ['/file-management']
        },
        {
          label: 'User',
          icon: 'pi pi-user',
          items: [
            {
              label: 'Profile',
              icon: 'pi pi-user-edit'
            },
            {
              label: 'Logout',
              icon: 'pi pi-sign-out',
              command: () => this.logout()
            }
          ]
        }
      );
    } else {
      this.menuItems.push(
        {
          label: 'Login',
          icon: 'pi pi-sign-in',
          routerLink: ['/login']
        }
      );
    }
  }

  logout() {
    this.authService.logout();
  }
}
