import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  if (!authService.loggedIn()) {
    // Automatically trigger SSO login
    authService.login();
    return false;
  }
  return true;
};
