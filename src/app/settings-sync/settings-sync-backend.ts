import { InjectionToken } from '@angular/core';
import type { SettingsSnapshot } from '../schedule/models';

export interface SettingsSyncBackend {
  currentUid(): Promise<string | null>;
  signIn(): Promise<string>;
  read(uid: string): Promise<SettingsSnapshot | null>;
  listen(
    uid: string,
    next: (snapshot: SettingsSnapshot | null) => void,
    error: (error: Error) => void,
  ): () => void;
  write(uid: string, snapshot: SettingsSnapshot): Promise<void>;
  signOut(): Promise<void>;
}

export type SettingsSyncBackendFactory = () => Promise<SettingsSyncBackend>;

export const SETTINGS_SYNC_BACKEND_FACTORY = new InjectionToken<SettingsSyncBackendFactory>(
  'SETTINGS_SYNC_BACKEND_FACTORY',
  {
    providedIn: 'root',
    factory: () => async () => {
      const { FirebaseSettingsSyncBackend } = await import('./firebase-settings-sync-backend');
      return new FirebaseSettingsSyncBackend();
    },
  },
);
