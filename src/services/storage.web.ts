const key = "storytime.session.v1";

export const sessionStorage = {
  async withLock<T>(action: () => Promise<T>): Promise<T> {
    if (!navigator.locks) throw new Error("Persistent identity requires browser locks");
    return navigator.locks.request(key, action);
  },
  async getItem() {
    return localStorage.getItem(key);
  },
  async setItem(value: string) {
    localStorage.setItem(key, value);
  },
};
