export type Session = {
  deviceId: string;
  treeId: string | null;
};

export type SessionStorage = {
  getItem: () => Promise<string | null>;
  setItem: (value: string) => Promise<void>;
  withLock?: <T>(action: () => Promise<T>) => Promise<T>;
};

export function createSessionStore(storage: SessionStorage, createId: () => string) {
  let pending: Promise<Session> | undefined;

  return {
    load(): Promise<Session> {
      if (!pending) {
        const readOrCreate = async () => {
          const stored = await storage.getItem();
          if (stored !== null) {
            const value: unknown = JSON.parse(stored);
            if (
              typeof value !== "object" || value === null ||
              !("deviceId" in value) || typeof value.deviceId !== "string" || !value.deviceId ||
              !("treeId" in value) || !(value.treeId === null || (typeof value.treeId === "string" && value.treeId.length > 0))
            ) {
              throw new Error("Stored session is invalid");
            }
            return { deviceId: value.deviceId, treeId: value.treeId };
          }
          const session = { deviceId: createId(), treeId: null };
          await storage.setItem(JSON.stringify(session));
          return session;
        };
        pending = (storage.withLock ? storage.withLock(readOrCreate) : readOrCreate()).catch((error: unknown) => {
          pending = undefined;
          throw error;
        });
      }
      return pending;
    },
    async selectTree(treeId: string | null): Promise<Session> {
      const current = await this.load();
      const next = { ...current, treeId };
      await storage.setItem(JSON.stringify(next));
      pending = Promise.resolve(next);
      return next;
    },
  };
}
