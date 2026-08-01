"use client";

import { useEffect } from "react";
import type { Locale } from "@/types";
import { createOneTapAuthClient } from "@/lib/auth-client";

const DISMISSED_KEY = "anei-google-one-tap-dismissed";

export function GoogleOneTap({
  clientId,
  locale,
  callbackURL,
}: {
  clientId: string;
  locale: Locale;
  callbackURL: string;
}) {
  useEffect(() => {
    if (sessionStorage.getItem(DISMISSED_KEY) === "1") return;

    const client = createOneTapAuthClient(clientId);
    void client.oneTap({
      autoSelect: false,
      context: "signin",
      callbackURL,
      onPromptNotification: () => {
        sessionStorage.setItem(DISMISSED_KEY, "1");
      },
      fetchOptions: {
        onError: () => {
          // One Tap is progressive enhancement. The visible OAuth and password
          // controls remain available, so a prompt failure needs no modal error.
          sessionStorage.setItem(DISMISSED_KEY, "1");
        },
      },
    }).catch(() => {
      sessionStorage.setItem(DISMISSED_KEY, "1");
    });
  }, [callbackURL, clientId, locale]);

  return null;
}
