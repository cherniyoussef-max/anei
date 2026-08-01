import { createAuthClient } from "better-auth/react";
import { createAuthClient as createCoreAuthClient } from "better-auth/client";
import { inferAdditionalFields, oneTapClient } from "better-auth/client/plugins";
import type { BetterAuthClientPlugin } from "better-auth";
import type { GoogleOneTapActionOptions } from "better-auth/client/plugins";
import type { auth } from "@/server/auth";

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
});

export const { useSession, signIn, signOut, signUp } = authClient;

export function createOneTapAuthClient(clientId: string) {
  // Better Auth 1.6.25 ships the One Tap plugin with a narrower internal
  // BetterFetch generic than createAuthClient accepts. Runtime contracts match;
  // keep the compatibility cast isolated until the upstream declarations align.
  const plugin = oneTapClient({
    clientId,
    autoSelect: false,
    promptOptions: {
      fedCM: true,
      maxAttempts: 1,
    },
  }) as unknown as BetterAuthClientPlugin;
  const client = createCoreAuthClient({
    plugins: [
      plugin,
    ],
  });
  return client as typeof client & {
    oneTap: (options?: GoogleOneTapActionOptions) => Promise<void>;
  };
}
