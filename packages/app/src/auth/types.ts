import type { IntegrationUser } from '@navet/app/types/integration-user';
import type { IntegrationProviderId } from '@navet/app/types/provider';
import type {
  NavetProviderSessionInput,
  NavetProviderSessionMap,
} from '@navet/core/provider-contract';
import type { HomeyCloudHomey, HomeySnapshot } from '@navet/provider-homey';
import type { Auth } from 'home-assistant-js-websocket';
import type { AuthRuntime } from './runtime-types';

export type AuthMode = 'ha_frontend_session' | 'ingress_session' | 'oauth';

export interface BaseAuthSession {
  providerId: IntegrationProviderId;
  runtime: AuthRuntime;
  authMode: AuthMode;
  haBaseUrl: string;
  hassUrl: string;
  auth?: Auth;
  expiresAt?: number;
  userId?: string;
  user?: IntegrationUser;
}

export interface HomeAssistantAuthSession extends BaseAuthSession {
  providerId: 'home_assistant';
  /** Opaque server-side credential session selected by the HttpOnly browser cookie. */
  credentialSessionId?: string;
  /** Compare-before-write revision for standalone OAuth token persistence. */
  credentialRevision?: number;
}

export interface HomeyAuthSession extends BaseAuthSession {
  providerId: 'homey';
  availableHomeys?: HomeyCloudHomey[];
  selectedHomeyId?: string;
  needsHomeySelection?: boolean;
  homeySnapshot?: HomeySnapshot;
}

export interface OpenHABAuthSession extends BaseAuthSession {
  providerId: 'openhab';
  /**
   * Direct openHAB sessions may carry credentials. Same-origin proxied sessions intentionally
   * omit them because the browser is bound to server-side credentials through an HttpOnly cookie.
   */
  username?: string;
  password?: string;
  proxyBaseUrl?: string;
}

export type AuthSession = HomeAssistantAuthSession | HomeyAuthSession | OpenHABAuthSession;

/**
 * Providers with an interactive login step, i.e. the ones the shared auth session manager
 * can ever hold a session for. Automatic providers (e.g. yr) never appear here.
 */
export const AUTH_SESSION_PROVIDER_IDS = [
  'home_assistant',
  'homey',
  'openhab',
] as const satisfies readonly AuthSession['providerId'][];

export function isAuthSessionProviderId(value: string): value is AuthSession['providerId'] {
  return (AUTH_SESSION_PROVIDER_IDS as readonly string[]).includes(value);
}

export interface AuthAdapter {
  readonly providerId: IntegrationProviderId;
  readonly kind: AuthRuntime;
  init(): Promise<AuthSession | null>;
  login?(input?: {
    hassUrl?: string;
    accessToken?: string;
    username?: string;
    password?: string;
    providerId?: IntegrationProviderId;
  }): Promise<AuthSession>;
  refresh?(session: AuthSession): Promise<AuthSession>;
  invalidatePersistedSession?(session: AuthSession): Promise<AuthSession | undefined>;
  logout?(): Promise<void>;
}

export function isHomeyAuthSession(session: AuthSession): session is HomeyAuthSession {
  return session.providerId === 'homey';
}

export type AuthSessionMap = Partial<Record<IntegrationProviderId, AuthSession>>;

export type AuthCompatibleSession = AuthSession & NavetProviderSessionInput;
export type AuthCompatibleSessionMap = NavetProviderSessionMap;

export function toAuthCompatibleSession(
  session: AuthSession | null | undefined
): AuthCompatibleSession | null {
  return (session ?? null) as AuthCompatibleSession | null;
}

export function toAuthCompatibleSessionMap(sessions: AuthSessionMap): AuthCompatibleSessionMap {
  return sessions as AuthCompatibleSessionMap;
}

export function fromProviderSessionInput(
  session: NavetProviderSessionInput | null | undefined
): AuthSession | null {
  return (session ?? null) as AuthSession | null;
}

export function fromProviderSessionMap(sessions: NavetProviderSessionMap): AuthSessionMap {
  return sessions as AuthSessionMap;
}
