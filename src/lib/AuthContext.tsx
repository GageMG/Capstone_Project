import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import { onUnauthorized, setToken } from "./api";

const TOKEN_KEY = "auth_token";
const SIGNED_OUT = "__signed_out__";
const web = () => (globalThis as any).localStorage;
let pendingStorageWrite = Promise.resolve();

const storage = {
  async get(): Promise<string | null> {
    try {
      if (Platform.OS === "web") return web()?.getItem(TOKEN_KEY) ?? null;
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch (e) {
      console.warn("Token read failed:", e);
      return null;
    }
  },
  set(value: string): Promise<void> {
    pendingStorageWrite = pendingStorageWrite.then(async () => {
      try {
        if (Platform.OS === "web") web()?.setItem(TOKEN_KEY, value);
        else await SecureStore.setItemAsync(TOKEN_KEY, value);
      } catch (e) {
        console.warn("Token write failed:", e);
      }
    });
    return pendingStorageWrite;
  },
};

type AuthContextValue = {
  ready: boolean;
  loggedIn: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    onUnauthorized(() => {
      setToken("");
      setLoggedIn(false);
      void storage.set(SIGNED_OUT);
    });

    (async () => {
      const stored = await storage.get();
      const t =
        stored === SIGNED_OUT ? "" : stored || process.env.EXPO_PUBLIC_JWT_TOKEN || "";
      setToken(t);
      setLoggedIn(t.length > 0);
      setReady(true);
    })();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      loggedIn,
      signIn: async (t) => {
        await storage.set(t);
        setToken(t);
        setLoggedIn(true);
      },
      signOut: async () => {
        setToken("");
        setLoggedIn(false);
        await storage.set(SIGNED_OUT);
      },
    }),
    [ready, loggedIn]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
