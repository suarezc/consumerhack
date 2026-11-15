import * as SecureStore from "expo-secure-store";

const key = "storytime.session.v1";

export const sessionStorage = {
  getItem: () => SecureStore.getItemAsync(key),
  setItem: (value: string) => SecureStore.setItemAsync(key, value),
};
