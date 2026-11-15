export type NotificationPermission = "granted" | "denied" | "undetermined";
export type NotificationPreference = {
  revision: number;
  optIn: boolean;
  permission: NotificationPermission;
  registered: boolean;
  available: boolean;
};

export type NotificationStatus = {
  state: "off" | "permission_required" | "denied" | "unavailable" | "registered" | "registration_failed" | "sync_failed";
  optIn: boolean;
};

export type NotificationRuntime = {
  available: () => boolean;
  configure: () => Promise<void>;
  permission: () => Promise<NotificationPermission>;
  requestPermission: () => Promise<NotificationPermission>;
  token: () => Promise<string>;
  onTokenChange: (listener: () => void) => () => void;
};

export type NotificationBackend = {
  preference: () => Promise<NotificationPreference>;
  update: (value: {
    expectedRevision: number;
    optIn: boolean;
    permission: NotificationPermission;
    token?: string;
  }) => Promise<NotificationPreference>;
};

export function createNotificationService(runtime: NotificationRuntime, backend: NotificationBackend) {
  let generation = 0;
  let pending: Promise<unknown> = Promise.resolve();
  let locallyOff = false;
  let cancelPreflight: (() => void) | undefined;

  function synchronize(choice?: boolean) {
    const version = choice === undefined ? generation : ++generation;
    if (choice !== undefined) {
      cancelPreflight?.();
      locallyOff = !choice;
    }
    let cancel!: () => void;
    const canceled = new Promise<never>((_resolve, reject) => {
      cancel = () => reject(new Error("Notification registration superseded"));
    });
    void canceled.catch(() => {});
    const task = async (): Promise<NotificationStatus> => {
      if (version !== generation) return { state: "off", optIn: false };
      cancelPreflight = cancel;
      try {
        const current = await Promise.race([backend.preference(), canceled]);
        if (version !== generation) return { state: "off", optIn: false };
        const optIn = choice ?? (locallyOff ? false : current.optIn);
        const available = runtime.available() && current.available;
        let permission: NotificationPermission = current.permission;
        let token: string | undefined;
        let failed = false;
        if (available && optIn) {
          try {
            await Promise.race([runtime.configure(), canceled]);
            permission = await Promise.race([runtime.permission(), canceled]);
            if (choice === true && permission === "undetermined") {
              permission = await Promise.race([runtime.requestPermission(), canceled]);
            }
            if (permission === "granted") {
              let timer: ReturnType<typeof setTimeout> | undefined;
              try {
                token = await Promise.race([runtime.token(), canceled, new Promise<never>((_resolve, reject) => {
                  timer = setTimeout(() => reject(new Error("Notification registration timed out")), 10_000);
                })]);
              } finally {
                clearTimeout(timer);
              }
            }
          } catch {
            failed = true;
          }
        }
        if (version !== generation) return { state: "off", optIn: false };
        const updated = await backend.update({ expectedRevision: current.revision, optIn, permission, token });
        if (!updated.optIn) return { state: "off", optIn: false };
        if (!available) return { state: "unavailable", optIn: true };
        if (failed) return { state: "registration_failed", optIn: true };
        if (permission === "denied") return { state: "denied", optIn: true };
        if (permission !== "granted") return { state: "permission_required", optIn: true };
        return { state: updated.registered ? "registered" : "registration_failed", optIn: true };
      } catch {
        return { state: "sync_failed", optIn: choice ?? !locallyOff };
      }
    };
    const result = pending.then(task, task);
    pending = result;
    return result;
  }

  return {
    optIn: () => synchronize(true),
    optOut: () => synchronize(false),
    reconcile: () => synchronize(),
    allowsForeground: () => !locallyOff,
    listen(onStatus: (status: NotificationStatus) => void) {
      return runtime.onTokenChange(() => { void synchronize().then(onStatus); });
    },
    dispose() {
      generation++;
      locallyOff = true;
      cancelPreflight?.();
    },
  };
}
