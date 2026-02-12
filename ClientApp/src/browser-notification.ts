export class BrowserNotificationManager {
    private pageHidden: boolean = false;

    constructor() {
        this.setupVisibilityListener();
    }

    private setupVisibilityListener(): void {
        document.addEventListener('visibilitychange', () => {
            this.pageHidden = document.hidden;
        });
        this.pageHidden = document.hidden;
    }

    public isPageHidden(): boolean {
        return this.pageHidden;
    }

    public async requestPermission(): Promise<NotificationPermission> {
        if (!('Notification' in window)) {
            console.warn('Browser does not support notifications');
            return 'denied';
        }
        return await Notification.requestPermission();
    }

    public getPermissionState(): NotificationPermission | 'unsupported' {
        if (!('Notification' in window)) {
            return 'unsupported';
        }
        return Notification.permission;
    }

    public showBrowserNotification(title: string, body: string, tag?: string): void {
        if (!('Notification' in window)) return;
        if (Notification.permission !== 'granted') return;

        const notification = new Notification(title, {
            body: body,
            tag: tag || 'notification-app',
            requireInteraction: false
        });

        notification.onclick = () => {
            window.focus();
            notification.close();
        };

        // Auto-close after 5 seconds
        setTimeout(() => notification.close(), 5000);
    }
}
