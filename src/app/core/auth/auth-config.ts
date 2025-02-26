import { AuthConfig } from 'angular-oauth2-oidc';

const localEnvironment = {
  openIdConnectIssuer: 'http://localhost:8090/realms/Leno',
  openIdConnectClientId: 'leno-compliance-frontend',
  openIdConnectLoginUrl: '',
  openIdConnectLogoutUrl: '',
  openIdConnectTokenEndpoint: '',
  openIdConnectScope: ''
};

export const environment = {
  ...localEnvironment,
  production: false,
  resourceServer: '',
  websocketReconnectDelay: 5000,
  openIdConnectResponseType: 'code',
  apiUrl: 'http://localhost:8080',
  // Added token refresh parameters
  refreshTokenTimeout: 20000, // 20 seconds
  silentRefreshTimeout: 10000, // 10 seconds
  tokenRefreshMargin: 60, // Refresh token 60 seconds before it expires
};

export const authConfig: AuthConfig = {
  issuer: environment.openIdConnectIssuer,
  redirectUri: window.location.origin,
  clientId: environment.openIdConnectClientId,
  responseType: environment.openIdConnectResponseType,
  loginUrl: environment.openIdConnectLoginUrl || undefined,
  logoutUrl: environment.openIdConnectLogoutUrl || undefined,
  tokenEndpoint: environment.openIdConnectTokenEndpoint || undefined,
  scope: environment.openIdConnectScope || 'openid profile email',
  // Configure token refresh behavior
  useSilentRefresh: true,
  silentRefreshTimeout: environment.silentRefreshTimeout,
  timeoutFactor: 0.75,
  sessionChecksEnabled: true,
  showDebugInformation: !environment.production,
  clearHashAfterLogin: true,
  nonceStateSeparator: 'semicolon',
  skipIssuerCheck: false, // Ensure issuer validation
  waitForTokenInMsec: 500, // Short wait time to check for tokens after redirect
  skipSubjectCheck: false, // Validate token subject
  requestAccessToken: true,
  oidc: true, // Use OpenID Connect
  requireHttps: !window.location.hostname.includes('localhost'), // Only require HTTPS in production
  // Support for refresh tokens
  useHttpBasicAuth: false,
  disableAtHashCheck: false,
};
