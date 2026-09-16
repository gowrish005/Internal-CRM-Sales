importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

// Config is injected by the FCMProvider component at registration time via URL params.
// This SW reads them from the URL query string so we don't hard-code secrets here.
const url = new URL(location.href);
const config = {
  apiKey:            url.searchParams.get("apiKey"),
  authDomain:        url.searchParams.get("authDomain"),
  projectId:         url.searchParams.get("projectId"),
  storageBucket:     url.searchParams.get("storageBucket"),
  messagingSenderId: url.searchParams.get("messagingSenderId"),
  appId:             url.searchParams.get("appId"),
};

firebase.initializeApp(config);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title = "GAPSO CRM", body = "You have a new notification" } =
    payload.notification ?? {};

  self.registration.showNotification(title, {
    body,
    icon: "/gapso-logo.png",
    badge: "/gapso-logo.png",
    data: payload.data ?? {},
    requireInteraction: true,
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.link ?? "/tasks";
  event.waitUntil(clients.openWindow(url));
});
