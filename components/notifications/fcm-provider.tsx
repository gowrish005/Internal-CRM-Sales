"use client";

import { useEffect } from "react";
import { getFirebaseMessaging, onMessage } from "@/lib/firebase-client";
import { saveFcmToken } from "@/lib/actions/notifications";

export function FCMProvider() {
  useEffect(() => {
    // Only wire up FCM foreground listener if Firebase is configured
    if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return;

    async function initFCM() {
      try {
        const messaging = getFirebaseMessaging();
        if (!messaging) return;

        onMessage(messaging, (payload) => {
          window.dispatchEvent(
            new CustomEvent("fcm-message", {
              detail: { title: payload.notification?.title, body: payload.notification?.body },
            })
          );
        });
      } catch (err) {
        console.warn("[FCMProvider]", err);
      }
    }

    initFCM();
  }, []);

  return null;
}
