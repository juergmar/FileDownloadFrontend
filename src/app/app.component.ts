import {Component, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterOutlet} from '@angular/router';

import {MenubarModule} from 'primeng/menubar';
import {ButtonModule} from 'primeng/button';
import {MenuItem, MessageService} from 'primeng/api';
import {ToastModule} from 'primeng/toast';
import {AvatarModule} from 'primeng/avatar';
import {AuthService} from './core/auth/auth.service';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MenubarModule,
    ButtonModule,
    ToastModule,
    AvatarModule,
  ],
  providers: [MessageService],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  public title = 'File Management System';
  public menuItems: MenuItem[] = [];

  constructor(
    public authService: AuthService
  ) {
  }

  public ngOnInit(): void {
    this.updateMenu();
  }

  public updateMenu(): void {
    const isLoggedIn = this.authService.loggedIn();

    this.menuItems = [
      {
        label: 'Home',
        icon: 'pi pi-home',
        routerLink: ['/'],
        routerLinkActiveOptions: {exact: true}
      }
    ];

    if (isLoggedIn) {
      this.menuItems.push(
        {
          label: 'File Management',
          icon: 'pi pi-file',
          routerLink: ['/file-management'],
          routerLinkActiveOptions: {exact: true}
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

  public logout(): void {
    this.authService.logout();
  }
}
