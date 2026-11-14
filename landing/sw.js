// Retires the service worker of the app that used to live at the root address.
// Installed phones fetch this file when they check for an update of the old app; it removes the old app's
// cached files (only those of the root scope), unregisters itself and reloads open windows, which then show
// the start page. Learner data in localStorage and the shared recordings cache are left untouched.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil((async () => {
  const scope = self.registration.scope;
  for (const key of await caches.keys()) if (key.startsWith('workbox-') && key.endsWith(scope)) await caches.delete(key);
  await self.registration.unregister();
  for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url);
})()));
