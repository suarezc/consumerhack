const key = "storytime.session.v1";

export const sessionStorage = {
  async getItem() {
    return localStorage.getItem(key);
  },
  async setItem(value: string) {
    localStorage.setItem(key, value);
  },
};
