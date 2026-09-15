import { computed, effect, inject, Injectable, signal } from "@angular/core";
import type { SettingsSnapshot } from "../schedule/models";
import { ScheduleStore } from "../schedule/schedule-store";
import {
  SETTINGS_SYNC_BACKEND_FACTORY,
  type SettingsSyncBackend,
  type SettingsSyncBackendFactory,
} from "./settings-sync-backend";

export type SyncStatus = "disabled" | "loading" | "signing-in" | "syncing" | "error";

const OPT_IN_KEY = "settingsSyncEnabled";
const WRITE_DELAY_MS = 250;

@Injectable({ providedIn: "root" })
export class SettingsSync {
  private readonly store = inject(ScheduleStore);
  private readonly createBackend: SettingsSyncBackendFactory = inject(
    SETTINGS_SYNC_BACKEND_FACTORY,
  );
  private backend: SettingsSyncBackend | undefined;
  private uid: string | undefined;
  private stopListening: (() => void) | undefined;
  private lastCloudSnapshot = "";
  private pendingSnapshot: SettingsSnapshot | undefined;
  private writeTimer: ReturnType<typeof setTimeout> | undefined;
  private writeChain = Promise.resolve();

  readonly status = signal<SyncStatus>(
    localStorage.getItem(OPT_IN_KEY) === "true" ? "loading" : "disabled",
  );
  readonly errorMessage = signal<string | undefined>(undefined);
  readonly enabled = computed(() => this.status() === "syncing");

  constructor() {
    effect(() => {
      const snapshot = this.store.settingsSnapshot();
      if (this.status() !== "syncing" || this.serialize(snapshot) === this.lastCloudSnapshot) {
        return;
      }
      this.scheduleWrite(snapshot);
    });

    if (localStorage.getItem(OPT_IN_KEY) === "true") {
      void this.resume();
    }
  }

  async signIn(): Promise<void> {
    this.status.set("signing-in");
    this.errorMessage.set(undefined);
    try {
      const backend = await this.getBackend();
      const uid = await backend.signIn();
      localStorage.setItem(OPT_IN_KEY, "true");
      await this.connect(uid);
    } catch (error) {
      this.fail(error);
    }
  }

  async retry(): Promise<void> {
    this.status.set("loading");
    this.errorMessage.set(undefined);
    try {
      const backend = await this.getBackend();
      const existingUid = await backend.currentUid();
      const uid = existingUid ?? (await backend.signIn());
      localStorage.setItem(OPT_IN_KEY, "true");
      await this.connect(uid);
    } catch (error) {
      this.fail(error);
    }
  }

  async signOut(): Promise<void> {
    this.disconnect();
    try {
      await this.backend?.signOut();
      localStorage.removeItem(OPT_IN_KEY);
      this.status.set("disabled");
      this.errorMessage.set(undefined);
    } catch (error) {
      this.fail(error);
    }
  }

  private async resume(): Promise<void> {
    try {
      const backend = await this.getBackend();
      const uid = await backend.currentUid();
      if (uid === null) {
        localStorage.removeItem(OPT_IN_KEY);
        this.status.set("disabled");
        return;
      }
      await this.connect(uid);
    } catch (error) {
      this.fail(error);
    }
  }

  private async connect(uid: string): Promise<void> {
    this.disconnect();
    this.status.set("loading");
    const backend = await this.getBackend();
    const cloudSnapshot = await backend.read(uid);
    if (cloudSnapshot === null) {
      const localSnapshot = this.store.settingsSnapshot();
      await backend.write(uid, localSnapshot);
      this.lastCloudSnapshot = this.serialize(localSnapshot);
    } else {
      this.applyCloudSnapshot(cloudSnapshot);
    }

    this.uid = uid;
    this.stopListening = backend.listen(
      uid,
      (snapshot) => {
        if (snapshot === null) {
          this.scheduleWrite(this.store.settingsSnapshot());
          return;
        }
        this.applyCloudSnapshot(snapshot);
      },
      (error) => this.fail(error),
    );
    this.status.set("syncing");
  }

  private applyCloudSnapshot(snapshot: SettingsSnapshot): void {
    const serialized = this.serialize(snapshot);
    this.lastCloudSnapshot = serialized;
    if (serialized !== this.serialize(this.store.settingsSnapshot())) {
      this.store.replaceSettings(snapshot);
    }
  }

  private scheduleWrite(snapshot: SettingsSnapshot): void {
    if (this.status() !== "syncing") {
      return;
    }
    this.pendingSnapshot = snapshot;
    if (this.writeTimer !== undefined) {
      clearTimeout(this.writeTimer);
    }
    this.writeTimer = setTimeout(() => {
      this.writeTimer = undefined;
      const pending = this.pendingSnapshot;
      this.pendingSnapshot = undefined;
      if (pending !== undefined) {
        this.enqueueWrite(pending);
      }
    }, WRITE_DELAY_MS);
  }

  private enqueueWrite(snapshot: SettingsSnapshot): void {
    const backend = this.backend;
    const uid = this.uid;
    if (backend === undefined || uid === undefined || this.status() !== "syncing") {
      return;
    }
    this.writeChain = this.writeChain
      .then(() => backend.write(uid, snapshot))
      .catch((error: unknown) => this.fail(error));
  }

  private async getBackend(): Promise<SettingsSyncBackend> {
    this.backend ??= await this.createBackend();
    return this.backend;
  }

  private disconnect(): void {
    this.stopListening?.();
    this.stopListening = undefined;
    this.uid = undefined;
    this.pendingSnapshot = undefined;
    if (this.writeTimer !== undefined) {
      clearTimeout(this.writeTimer);
      this.writeTimer = undefined;
    }
  }

  private fail(error: unknown): void {
    this.disconnect();
    this.status.set("error");
    this.errorMessage.set(this.errorText(error));
  }

  private errorText(error: unknown): string {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : undefined;
    switch (code) {
      case "auth/popup-closed-by-user":
      case "auth/cancelled-popup-request":
        return "Die Google-Anmeldung wurde abgebrochen.";
      case "auth/unauthorized-domain":
        return "Diese Domain ist nicht für die Google-Anmeldung freigeschaltet.";
      case "auth/network-request-failed":
        return "Die Google-Anmeldung konnte das Netzwerk nicht erreichen.";
      case "database/permission-denied":
      case "PERMISSION_DENIED":
        return "Firebase hat den Zugriff auf die Einstellungen abgelehnt.";
      default:
        return error instanceof Error ? error.message : "Synchronisierung fehlgeschlagen.";
    }
  }

  private serialize(snapshot: SettingsSnapshot): string {
    return JSON.stringify(snapshot);
  }
}
