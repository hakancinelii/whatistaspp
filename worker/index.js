// next-pwa tarafından üretilen service worker'a dahil edilen özel kod.
// Push bildirimi alımı ve tıklama davranışı.

self.addEventListener("push", (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch (e) {
        data = { title: "Social Transfer", body: event.data ? event.data.text() : "" };
    }

    const title = data.title || "Social Transfer";
    const options = {
        body: data.body || "",
        icon: "/android-chrome-192x192.png",
        badge: "/favicon-32x32.png",
        vibrate: [200, 100, 200],
        tag: data.tag || undefined,
        renotify: !!data.tag,
        data: { url: data.url || "/dashboard/driver" },
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const targetUrl = (event.notification.data && event.notification.data.url) || "/dashboard/driver";

    event.waitUntil(
        self.clients
            .matchAll({ type: "window", includeUncontrolled: true })
            .then((clientList) => {
                for (const client of clientList) {
                    // Açık bir pencere varsa onu hedefe yönlendirip öne getir
                    if ("focus" in client) {
                        if ("navigate" in client) {
                            client.navigate(targetUrl).catch(() => { });
                        }
                        return client.focus();
                    }
                }
                if (self.clients.openWindow) {
                    return self.clients.openWindow(targetUrl);
                }
            })
    );
});
