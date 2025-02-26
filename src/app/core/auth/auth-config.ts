import {AuthConfig} from 'angular-oauth2-oidc';

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
  apiUrl: 'http://localhost:8080'
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
};
