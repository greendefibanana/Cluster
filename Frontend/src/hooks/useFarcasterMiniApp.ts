import { useEffect, useState } from "react";
import sdk from "@farcaster/frame-sdk";
import { appEnv } from "../lib/env";

export interface FarcasterMiniAppState {
  isReady: boolean;
  isInMiniApp: boolean;
  context: unknown;
  error: string | null;
}

export function useFarcasterMiniApp() {
  const [state, setState] = useState<FarcasterMiniAppState>({
    isReady: false,
    isInMiniApp: false,
    context: null,
    error: null,
  });

  useEffect(() => {
    if (!appEnv.farcaster.enabled) {
      return;
    }

    let cancelled = false;

    async function initializeFarcaster() {
      try {
        const isInMiniApp = await sdk.isInMiniApp();
        const context = isInMiniApp ? await sdk.context : null;

        if (isInMiniApp) {
          await sdk.actions.ready();
        }

        if (!cancelled) {
          setState({
            isReady: true,
            isInMiniApp,
            context,
            error: null,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            isReady: false,
            isInMiniApp: false,
            context: null,
            error: error instanceof Error ? error.message : "Farcaster Mini App setup failed",
          });
        }
      }
    }

    void initializeFarcaster();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
