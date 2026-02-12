// sw.js - Service Worker for Push Notifications

self.addEventListener('install', function (event) {
    self.skipWaiting();
});

self.addEventListener('activate', function (event) {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function (event) {
    if (!event.data) return;

    var data;
    try {
        data = event.data.json();
    } catch (e) {
        data = { title: 'Nueva notificación', body: event.data.text() };
    }

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(function (clientList) {
                // If there are open tabs, don't show push notification
                // The tab handles it via Web Notifications API (Escenario 2)
                if (clientList.length > 0) {
                    return;
                }

                // No open tabs - show push notification (Escenario 3)
                return self.registration.showNotification(data.title || 'Nueva notificación', {
                    body: data.body || '',
                    tag: 'notification-' + (data.id || Date.now()),
                    data: {
                        url: '/',
                        notificationId: data.id
                    },
                    requireInteraction: false
                });
            })
    );
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    var urlToOpen = event.notification.data && event.notification.data.url
        ? event.notification.data.url
        : '/';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(function (clientList) {
                // Try to focus an existing tab
                for (var i = 0; i < clientList.length; i++) {
                    var client = clientList[i];
                    if ('focus' in client) {
                        return client.focus();
                    }
                }
                // No existing tab, open new window
                if (self.clients.openWindow) {
                    return self.clients.openWindow(urlToOpen);
                }
            })
    );
});
