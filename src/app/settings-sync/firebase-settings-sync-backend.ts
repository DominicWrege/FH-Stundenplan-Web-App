import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { get, getDatabase, onValue, ref, serverTimestamp, set } from "firebase/database";
import { parseSettingsSnapshot, type SettingsSnapshot } from "../schedule/models";
import { FIREBASE_CONFIG } from "./firebase.config";
import type { SettingsSyncBackend } from "./settings-sync-backend";

export class FirebaseSettingsSyncBackend implements SettingsSyncBackend {
  private readonly app = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApp();
  private readonly auth = getAuth(this.app);
  private readonly database = getDatabase(this.app);

  async currentUid(): Promise<string | null> {
    await this.auth.authStateReady();
    return this.auth.currentUser?.uid ?? null;
  }

  async signIn(): Promise<string> {
    await setPersistence(this.auth, browserLocalPersistence);
    const credential = await signInWithPopup(this.auth, new GoogleAuthProvider());
    return credential.user.uid;
  }

  async read(uid: string): Promise<SettingsSnapshot | null> {
    const snapshot = await get(this.settingsRef(uid));
    return snapshot.exists() ? this.parse(snapshot.val()) : null;
  }

  listen(
    uid: string,
    next: (snapshot: SettingsSnapshot | null) => void,
    error: (error: Error) => void,
  ): () => void {
    return onValue(
      this.settingsRef(uid),
      (snapshot) => {
        try {
          next(snapshot.exists() ? this.parse(snapshot.val()) : null);
        } catch (cause) {
          error(cause instanceof Error ? cause : new Error("Synchronisierte Daten sind ungültig."));
        }
      },
      (cause) => error(cause),
    );
  }

  async write(uid: string, snapshot: SettingsSnapshot): Promise<void> {
    await set(this.settingsRef(uid), { ...snapshot, updatedAt: serverTimestamp() });
  }

  async signOut(): Promise<void> {
    await signOut(this.auth);
  }

  private settingsRef(uid: string) {
    return ref(this.database, `users/${uid}/settings`);
  }

  private parse(value: unknown): SettingsSnapshot {
    const snapshot = parseSettingsSnapshot(value);
    if (snapshot === undefined) {
      throw new Error("Die synchronisierten Einstellungen haben ein ungültiges Format.");
    }
    return snapshot;
  }
}
