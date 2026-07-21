import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { Platform } from "react-native";
import { dictionaries, normalizeLocale, type TranslationKey } from "../../../../lib/i18n/translations";
import type { AppLocale, ThemeMode } from "../domain";
import { type CachedAuthStatus } from "../auth/statusShared";
import { revalidateCloudSession } from "../auth/cloud";
import { localStatus } from "../auth/statusShared";
import { readCachedAuthStatus, writeCachedAuthStatus } from "../auth/statusStore";
import { resolveAdapter } from "../data/resolveAdapter";
import { LocalAdapter } from "../data/LocalAdapter";
import type { DataAdapter } from "../data/DataAdapter";

type AppContextValue = {
  adapter: DataAdapter;
  authStatus: CachedAuthStatus;
  locale: AppLocale;
  theme: ThemeMode;
  defaultWaterTargetMl: number;
  initialized: boolean;
  authReady: boolean;
  initError: string | null;
  t: (key: TranslationKey) => string;
  activateLocalMode: () => Promise<void>;
  activateCloudSession: (status: CachedAuthStatus) => Promise<void>;
  setLocale: (locale: AppLocale) => Promise<void>;
  setTheme: (theme: ThemeMode) => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

type AdapterSelection = { adapter: DataAdapter; status: CachedAuthStatus };

function createLocalSelection(status: CachedAuthStatus): AdapterSelection {
  return { adapter: new LocalAdapter(status.profileId), status };
}

function resolveAdapterSafely(status: CachedAuthStatus): AdapterSelection {
  try {
    return resolveAdapter(status);
  } catch (error) {
    console.warn("Daily Health could not initialize the selected data adapter; using local mode instead.", error);
    return createLocalSelection({
      ...status,
      subscribed: false,
      localMirror: false,
      testMode: true,
      accessToken: null
    });
  }
}

function createInitialSelection(): AdapterSelection {
  // The hosted website is cloud-only. Android keeps its offline SQLite path.
  if (Platform.OS === "web") return resolveAdapterSafely(localStatus("web-remote"));
  return createLocalSelection(localStatus());
}

export function AppProvider({ children }: PropsWithChildren) {
  // The first render must not invoke a platform bridge or a Metro re-export.
  const [selection, setSelection] = useState<AdapterSelection>(() => createInitialSelection());
  const [locale, setLocaleState] = useState<AppLocale>("en");
  const [theme, setThemeState] = useState<ThemeMode>("light");
  const [defaultWaterTargetMl, setDefaultWaterTargetMl] = useState(2000);
  const [initialized, setInitialized] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    if (authReady) return;

    // Development bypass: On localhost, if we don't have a real token yet,
    // use the bypass token to avoid "Sign in is required" errors.
    if (Platform.OS === "web" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
      if (!selection.status.accessToken) {
        setSelection(resolveAdapterSafely({
          ...selection.status,
          subscribed: true,
          profileId: "dev-user-id",
          accessToken: "dev-token-bypass"
        }));
        setAuthReady(true);
        return;
      }
    }

    let active = true;
    void (async () => {
      try {
        console.log("AppProvider: Restoring auth status...");
        const status = await readCachedAuthStatus(selection.status);
        console.log("AppProvider: Auth status restored:", status.profileId, "subscribed:", status.subscribed);
        if (active) setSelection(resolveAdapterSafely(status));
      } catch (error) {
        console.warn("Daily Health could not restore the previous sign-in state; continuing locally.", error);
      } finally {
        if (active) {
          console.log("AppProvider: Auth ready.");
          setAuthReady(true);
        }
      }
    })();
    return () => { active = false; };
  }, [authReady, selection.status]);

  useEffect(() => {
    if (!authReady) return;
    let active = true;
    console.log("AppProvider: Ensuring profile for adapter mode:", selection.adapter.mode);
    void selection.adapter.ensureProfile()
      .then(({ settings }) => {
        if (!active) return;
        console.log("AppProvider: Profile ensured, setting locale:", settings.locale);
        setLocaleState(normalizeLocale(settings.locale));
        setThemeState(settings.theme);
        setDefaultWaterTargetMl(settings.defaultWaterTargetMl);
      })
      .catch((err) => {
        console.error("AppProvider: Failed to ensure profile:", err);
        // If the server is offline and we are in mirror mode, we can still proceed!
        if (selection.adapter.mode === "mirror") {
          console.log("AppProvider: Proceeding in offline mirror mode.");
          return; // The mirror will handle individual request fallbacks
        }

        // If we have no local data and no connection, we offer to switch to local mode.
        setInitError(err instanceof Error ? err.message : "Failed to initialize account.");
      })
      .finally(() => {
        if (active) {
          console.log("AppProvider: Initialized.");
          setInitialized(true);
        }
      });
    return () => { active = false; };
  }, [authReady, selection.adapter]);

  useEffect(() => {
    if (!authReady) return;
    let active = true;
    void (async () => {
      try {
        const next = await revalidateCloudSession(selection.status);
        if (!active || !next || JSON.stringify(next) === JSON.stringify(selection.status)) return;
        try {
          await writeCachedAuthStatus(next);
        } catch (error) {
          console.warn("Daily Health could not persist the refreshed sign-in state.", error);
        }
        if (active) setSelection(resolveAdapterSafely(next));
      } catch (error) {
        console.warn("Daily Health could not refresh the cloud session.", error);
      }
    })();
    return () => { active = false; };
  }, [authReady, selection.status]);

  const activateLocalMode = useCallback(async () => {
    // Development bypass: "Continue without account" on web now automatically
    // uses the debug cloud session to avoid "Sign in is required" errors.
    if (Platform.OS === "web" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
      const debugStatus: CachedAuthStatus = {
        version: 1,
        subscribed: true,
        localMirror: false,
        testMode: true,
        profileId: "dev-user-id",
        accessToken: "dev-token-bypass"
      };
      setSelection(resolveAdapterSafely(debugStatus));
      return;
    }

    const next = { ...selection.status, subscribed: false, localMirror: false, testMode: true, accessToken: null } satisfies CachedAuthStatus;
    try {
      if (Platform.OS !== "web") await writeCachedAuthStatus(next);
    } catch (error) {
      console.warn("Daily Health could not persist local mode.", error);
    }
    setSelection(createLocalSelection(next));
  }, [selection.status]);

  const activateCloudSession = useCallback(async (status: CachedAuthStatus) => {
    try {
      await writeCachedAuthStatus(status);
    } catch (error) {
      console.warn("Daily Health could not persist the cloud sign-in state.", error);
    }
    setSelection(resolveAdapterSafely(status));
  }, []);

  const setLocale = useCallback(async (nextLocale: AppLocale) => {
    setLocaleState(nextLocale);
    const settings = await selection.adapter.saveSettings({ locale: nextLocale });
    setDefaultWaterTargetMl(settings.defaultWaterTargetMl);
  }, [selection.adapter]);

  const setTheme = useCallback(async (nextTheme: ThemeMode) => {
    setThemeState(nextTheme);
    await selection.adapter.saveSettings({ theme: nextTheme });
  }, [selection.adapter]);

  const value = useMemo<AppContextValue>(() => ({
    adapter: selection.adapter,
    authStatus: selection.status,
    locale,
    theme,
    defaultWaterTargetMl,
    initialized,
    authReady,
    initError,
    t: (key) => dictionaries[locale][key] ?? dictionaries.en[key] ?? key,
    activateLocalMode,
    activateCloudSession,
    setLocale,
    setTheme
  }), [activateCloudSession, activateLocalMode, authReady, defaultWaterTargetMl, initialized, locale, selection, setLocale, setTheme, theme]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider.");
  return context;
}
