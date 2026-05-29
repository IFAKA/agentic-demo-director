export interface DemoHooks {
  reset?: () => Promise<void> | void;
  seed?: (name: string, payload?: unknown) => Promise<void> | void;
  ready?: (key: string) => Promise<void> | void;
  disableDebug?: () => Promise<void> | void;
  overlay?: {
    tap?: (x: number, y: number) => void;
  };
}

export interface InstallDemoHooksOptions extends DemoHooks {
  enabled?: boolean;
  allowedSeeds?: string[];
  allowedReadyKeys?: string[];
}

export function installDemoHooks(options: InstallDemoHooksOptions) {
  if (!isDemoMode(options.enabled)) return;

  const allowedSeeds = new Set(options.allowedSeeds);
  const allowedReadyKeys = new Set(options.allowedReadyKeys);

  window.__demo = {
    reset: async () => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      await options.reset?.();
    },
    seed: async (name: string, payload?: unknown) => {
      if (allowedSeeds.size > 0 && !allowedSeeds.has(name)) {
        throw new Error(`Unknown demo seed: ${name}`);
      }
      if (!options.seed) throw new Error("No demo seed hook installed");
      await options.seed(name, payload);
    },
    ready: async (key: string) => {
      if (allowedReadyKeys.size > 0 && !allowedReadyKeys.has(key)) {
        throw new Error(`Unknown demo readiness key: ${key}`);
      }
      if (!options.ready) return;
      await options.ready(key);
    },
    disableDebug: async () => {
      document.documentElement.dataset.demoDebugDisabled = "true";
      await options.disableDebug?.();
    },
    tap: options.overlay?.tap,
    overlay: options.overlay,
  };
}

function isDemoMode(explicit?: boolean) {
  if (explicit !== undefined) return explicit;
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("demo") === "1" || params.get("scene") !== null;
}

declare global {
  interface Window {
    __demo?: DemoHooks & {
      tap?: (x: number, y: number) => void;
    };
  }
}
