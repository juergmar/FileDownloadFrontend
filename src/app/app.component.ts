import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { MenubarModule } from 'primeng/menubar';
import { ButtonModule } from 'primeng/button';
import { MenuItem, MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { AvatarModule } from 'primeng/avatar';
import { AuthService } from './core/auth/auth.service';
import { Subject, takeUntil } from 'rxjs';
import { DialogModule } from 'primeng/dialog';

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
    DialogModule,
  ],
  providers: [MessageService],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  public title: string = 'File Management System';
  public menuItems: MenuItem[] = [];
  public showSessionExpiryDialog: boolean = false;
  public username: string = '';
  private destroy$: Subject<void> = new Subject<void>();

  public constructor(
    public authService: AuthService,
    private messageService: MessageService
  ) {}

  public ngOnInit(): void {
    // Subscribe to login state changes
    this.authService.isLoggedIn$
      .pipe(takeUntil(this.destroy$))
      .subscribe(isLoggedIn => {
        this.updateMenu();
        this.username = isLoggedIn ? this.authService.getUsername() : '';
      });

    // Initial menu setup
    this.updateMenu();
  }

  public ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public updateMenu(): void {
    this.menuItems = [
      {
        label: 'Home',
        icon: 'pi pi-home',
        routerLink: ['/'],
        routerLinkActiveOptions: { exact: true }
      }
    ];

    if (this.authService.loggedIn()) {
      this.menuItems.push(
        {
          label: 'File Management',
          icon: 'pi pi-file',
          routerLink: ['/file-management'],
          routerLinkActiveOptions: { exact: true }
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
    }
  }

  public logout(): void {
    this.authService.logout();
    this.messageService.add({
      severity: 'info',
      summary: 'Logged Out',
      detail: 'You have been successfully logged out'
    });
  }
}
