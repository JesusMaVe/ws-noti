import { SignalRClient } from './signalr-client';
import { NotificationUI } from './notification-ui';
import { BrowserNotificationManager } from './browser-notification';
import { PushNotificationManager } from './push-manager';
import { ActivityDetector } from './activity-detector';
import { AdaptiveHeartbeat } from './adaptive-heartbeat';

// Configuración
const API_BASE_URL = window.location.origin;
const HUB_URL = `${API_BASE_URL}/notificationHub`;

// Inicializar componentes
const signalRClient = new SignalRClient(HUB_URL);
const notificationUI = new NotificationUI(API_BASE_URL);
const browserNotification = new BrowserNotificationManager();
const pushManager = new PushNotificationManager(API_BASE_URL);
const activityDetector = new ActivityDetector();
let adaptiveHeartbeat: AdaptiveHeartbeat | null = null;

function getNotificationTitle(type: string): string {
    switch (type) {
        case 'success': return 'Notificacion exitosa';
        case 'warning': return 'Advertencia';
        case 'error': return 'Error';
        default: return 'Nueva notificacion';
    }
}

// Función principal
async function initialize(): Promise<void> {
    console.log('Inicializando aplicación de notificaciones...');

    // Configurar listeners del cliente SignalR
    signalRClient.onNotification((notification) => {
        console.log('Nueva notificación:', notification);
        notificationUI.displayNotification(notification);

        // Escenario 2: Si el tab esta oculto, mostrar notificacion nativa del navegador
        if (browserNotification.isPageHidden() && browserNotification.getPermissionState() === 'granted') {
            browserNotification.showBrowserNotification(
                getNotificationTitle(notification.type),
                notification.message,
                'notification-' + notification.id
            );
        }
    });

    signalRClient.onStateChange((state) => {
        console.log('Estado de conexión:', state);
        notificationUI.updateConnectionStatus(state);
    });

    // Configurar formulario de envío
    notificationUI.setupSendForm(async (message, type) => {
        await notificationUI.sendNotification(message, type);
    });

    // Configurar boton de permisos de notificacion
    setupNotificationButton();

    // Configurar boton de push
    setupPushButton();

    // Cargar historial de notificaciones
    await notificationUI.loadNotificationHistory();

    // Conectar al hub
    try {
        await signalRClient.connect();
        console.log('Aplicación inicializada correctamente');

        // Configurar heartbeat adaptativo (solo en modo conexion directa)
        const connection = signalRClient.getConnection();
        if (connection) {
            adaptiveHeartbeat = new AdaptiveHeartbeat(connection, activityDetector);
            adaptiveHeartbeat.start();
        }
    } catch (error) {
        console.error('Error al inicializar la aplicación:', error);
        alert('Error al conectar con el servidor. Por favor, recarga la página.');
    }

    // Registrar service worker para push notifications
    await pushManager.registerServiceWorker();
}

function setupNotificationButton(): void {
    const btn = document.getElementById('enable-notifications-btn') as HTMLButtonElement;
    if (!btn) return;

    const state = browserNotification.getPermissionState();
    updateNotificationButtonState(btn, state);

    btn.addEventListener('click', async () => {
        const permission = await browserNotification.requestPermission();
        updateNotificationButtonState(btn, permission);
    });
}

function updateNotificationButtonState(btn: HTMLButtonElement, state: NotificationPermission | 'unsupported'): void {
    switch (state) {
        case 'granted':
            btn.textContent = 'Notificaciones activadas';
            btn.classList.add('btn-granted');
            btn.classList.remove('btn-denied');
            btn.disabled = true;
            break;
        case 'denied':
            btn.textContent = 'Notificaciones bloqueadas';
            btn.classList.add('btn-denied');
            btn.classList.remove('btn-granted');
            btn.disabled = true;
            break;
        case 'unsupported':
            btn.textContent = 'No soportado';
            btn.disabled = true;
            break;
        default:
            btn.textContent = 'Activar notificaciones';
            btn.disabled = false;
            break;
    }
}

function setupPushButton(): void {
    const btn = document.getElementById('enable-push-btn') as HTMLButtonElement;
    if (!btn) return;

    if (!pushManager.isSupported()) {
        btn.textContent = 'Push no soportado';
        btn.disabled = true;
        return;
    }

    // Verificar estado inicial de suscripcion
    updatePushButtonState(btn);

    btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Procesando...';

        const subscribed = await pushManager.isSubscribed();

        if (subscribed) {
            const success = await pushManager.unsubscribeFromPush();
            if (success) {
                btn.textContent = 'Activar Push';
                btn.classList.remove('btn-granted');
            }
        } else {
            const subscription = await pushManager.subscribeToPush();
            if (subscription) {
                btn.textContent = 'Desactivar Push';
                btn.classList.add('btn-granted');
            }
        }

        btn.disabled = false;
    });
}

async function updatePushButtonState(btn: HTMLButtonElement): Promise<void> {
    // Esperar un momento a que se registre el SW
    setTimeout(async () => {
        const subscribed = await pushManager.isSubscribed();
        if (subscribed) {
            btn.textContent = 'Desactivar Push';
            btn.classList.add('btn-granted');
        } else {
            btn.textContent = 'Activar Push';
            btn.classList.remove('btn-granted');
        }
    }, 1000);
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

// Desconectar al cerrar la página
window.addEventListener('beforeunload', () => {
    signalRClient.disconnect();
    if (adaptiveHeartbeat) {
        adaptiveHeartbeat.destroy();
    }
    activityDetector.destroy();
});
