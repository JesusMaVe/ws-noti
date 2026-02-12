export class PushNotificationManager {
    private apiBaseUrl: string;
    private swRegistration: ServiceWorkerRegistration | null = null;

    constructor(apiBaseUrl: string) {
        this.apiBaseUrl = apiBaseUrl;
    }

    public isSupported(): boolean {
        return 'serviceWorker' in navigator && 'PushManager' in window;
    }

    public async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
        if (!this.isSupported()) {
            console.warn('Service Worker / Push not supported');
            return null;
        }

        try {
            this.swRegistration = await navigator.serviceWorker.register('/sw.js');
            console.log('Service Worker registered:', this.swRegistration.scope);

            // Re-send existing subscription to backend on page load
            const existingSubscription = await this.swRegistration.pushManager.getSubscription();
            if (existingSubscription) {
                await this.sendSubscriptionToServer(existingSubscription);
            }

            return this.swRegistration;
        } catch (error) {
            console.error('Service Worker registration failed:', error);
            return null;
        }
    }

    public async subscribeToPush(): Promise<PushSubscription | null> {
        if (!this.swRegistration) {
            console.error('Service Worker not registered');
            return null;
        }

        try {
            // Get VAPID public key from server
            const response = await fetch(`${this.apiBaseUrl}/api/push/vapid-public-key`);
            const { publicKey } = await response.json();

            const applicationServerKey = this.urlBase64ToUint8Array(publicKey);

            const subscription = await this.swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey.buffer as ArrayBuffer
            });

            // Send subscription to backend
            await this.sendSubscriptionToServer(subscription);

            console.log('Push subscription created:', subscription.endpoint);
            return subscription;
        } catch (error) {
            console.error('Push subscription failed:', error);
            return null;
        }
    }

    public async unsubscribeFromPush(): Promise<boolean> {
        if (!this.swRegistration) return false;

        try {
            const subscription = await this.swRegistration.pushManager.getSubscription();
            if (!subscription) return true;

            // Unsubscribe from browser
            await subscription.unsubscribe();

            // Remove from backend
            await fetch(`${this.apiBaseUrl}/api/push/unsubscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endpoint: subscription.endpoint })
            });

            console.log('Push subscription removed');
            return true;
        } catch (error) {
            console.error('Push unsubscribe failed:', error);
            return false;
        }
    }

    public async isSubscribed(): Promise<boolean> {
        if (!this.swRegistration) return false;
        const subscription = await this.swRegistration.pushManager.getSubscription();
        return subscription !== null;
    }

    private async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
        const key = subscription.getKey('p256dh');
        const auth = subscription.getKey('auth');

        await fetch(`${this.apiBaseUrl}/api/push/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                endpoint: subscription.endpoint,
                p256dh: key ? btoa(String.fromCharCode(...new Uint8Array(key))) : '',
                auth: auth ? btoa(String.fromCharCode(...new Uint8Array(auth))) : ''
            })
        });
    }

    private urlBase64ToUint8Array(base64String: string): Uint8Array {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }

        return outputArray;
    }
}
