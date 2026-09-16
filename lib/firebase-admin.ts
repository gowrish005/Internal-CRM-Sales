import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

let app: App | undefined;

function getAdminApp(): App | undefined {
  if (app) return app;
  if (getApps().length) { app = getApps()[0]; return app; }

  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) return undefined;

  app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return app;
}

export async function sendPushNotification({
  token,
  title,
  body,
  data,
}: {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}) {
  const adminApp = getAdminApp();
  if (!adminApp) return;

  try {
    await getMessaging(adminApp).send({
      token,
      notification: { title, body },
      data,
      webpush: {
        notification: {
          title,
          body,
          icon: "/gapso-logo.png",
          requireInteraction: true,
        },
        fcmOptions: { link: process.env.NEXT_PUBLIC_APP_URL ?? "/" },
      },
    });
  } catch (err: any) {
    console.warn("[FCM] send failed:", err?.message);
  }
}
