import { Notification, ConnectionState, NotificationRequest } from './types';

export class NotificationUI {
    private notifications: Notification[] = [];
    private apiBaseUrl: string;

    constructor(apiBaseUrl: string) {
        this.apiBaseUrl = apiBaseUrl;
    }

    public displayNotification(notification: Notification): void {
        // Evitar duplicados (por si la notificación ya está en el historial)
        const exists = this.notifications.some(n => n.id === notification.id);
        if (!exists) {
            this.notifications.unshift(notification);
            this.renderNotifications();
        }
    }

    public async loadNotificationHistory(): Promise<void> {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/notification/history?limit=50`);

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const result = await response.json();

            if (result.success && result.notifications) {
                // Cargar el historial (ya viene ordenado del más reciente al más antiguo)
                this.notifications = result.notifications;
                this.renderNotifications();
                console.log(`Historial cargado: ${result.count} notificaciones`);
            }
        } catch (error) {
            console.error('Error al cargar historial:', error);
        }
    }

    public updateConnectionStatus(state: ConnectionState): void {
        const statusElement = document.getElementById('connection-status');
        const statusText = document.getElementById('status-text');

        if (!statusElement || !statusText) return;

        statusElement.className = `status ${state.toLowerCase()}`;
        statusText.textContent = this.getStatusText(state);
    }

    private getStatusText(state: ConnectionState): string {
        switch (state) {
            case ConnectionState.Connected:
                return 'Conectado';
            case ConnectionState.Connecting:
                return 'Conectando...';
            case ConnectionState.Reconnecting:
                return 'Reconectando...';
            case ConnectionState.Disconnected:
                return 'Desconectado';
            case ConnectionState.Failed:
                return 'Conexión fallida';
            default:
                return 'Desconocido';
        }
    }

    private renderNotifications(): void {
        const container = document.getElementById('notifications-list');
        if (!container) return;

        if (this.notifications.length === 0) {
            container.innerHTML = '<p class="no-notifications">No hay notificaciones aún</p>';
            return;
        }

        container.innerHTML = this.notifications
            .map(notification => this.createNotificationHTML(notification))
            .join('');
    }

    private createNotificationHTML(notification: Notification): string {
        const date = new Date(notification.timestamp);
        const formattedTime = date.toLocaleTimeString('es-ES');
        const formattedDate = date.toLocaleDateString('es-ES');

        return `
            <div class="notification notification-${notification.type}">
                <div class="notification-header">
                    <span class="notification-type">${this.getTypeLabel(notification.type)}</span>
                    <span class="notification-time">${formattedTime} - ${formattedDate}</span>
                </div>
                <div class="notification-message">${this.escapeHtml(notification.message)}</div>
            </div>
        `;
    }

    private getTypeLabel(type: string): string {
        const labels: Record<string, string> = {
            info: 'INFO',
            success: 'ÉXITO',
            warning: 'ADVERTENCIA',
            error: 'ERROR'
        };
        return labels[type] || type.toUpperCase();
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    public setupSendForm(onSend: (message: string, type: string) => void): void {
        const form = document.getElementById('send-form') as HTMLFormElement;
        const messageInput = document.getElementById('message-input') as HTMLTextAreaElement;
        const typeSelect = document.getElementById('type-select') as HTMLSelectElement;
        const sendButton = document.getElementById('send-button') as HTMLButtonElement;

        if (!form || !messageInput || !typeSelect || !sendButton) return;

        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const message = messageInput.value.trim();
            const type = typeSelect.value;

            if (!message) {
                alert('Por favor, escribe un mensaje');
                return;
            }

            sendButton.disabled = true;
            sendButton.textContent = 'Enviando...';

            onSend(message, type);
        });
    }

    public async sendNotification(message: string, type: string): Promise<void> {
        const sendButton = document.getElementById('send-button') as HTMLButtonElement;
        const messageInput = document.getElementById('message-input') as HTMLTextAreaElement;

        try {
            const request: NotificationRequest = {
                message: message,
                type: type
            };

            const response = await fetch(`${this.apiBaseUrl}/api/notification`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request)
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const result = await response.json();
            console.log('Notificación enviada:', result);

            // Limpiar el formulario
            messageInput.value = '';

        } catch (error) {
            console.error('Error al enviar notificación:', error);
            alert('Error al enviar la notificación');
        } finally {
            if (sendButton) {
                sendButton.disabled = false;
                sendButton.textContent = 'Enviar Notificación';
            }
        }
    }

    public clearNotifications(): void {
        this.notifications = [];
        this.renderNotifications();
    }
}
