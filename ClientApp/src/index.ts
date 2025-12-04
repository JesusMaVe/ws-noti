import { SignalRClient } from './signalr-client';
import { NotificationUI } from './notification-ui';

// Configuración
const API_BASE_URL = window.location.origin;
const HUB_URL = `${API_BASE_URL}/notificationHub`;

// Inicializar componentes
const signalRClient = new SignalRClient(HUB_URL);
const notificationUI = new NotificationUI(API_BASE_URL);

// Función principal
async function initialize(): Promise<void> {
    console.log('Inicializando aplicación de notificaciones...');

    // Configurar listeners del cliente SignalR
    signalRClient.onNotification((notification) => {
        console.log('Nueva notificación:', notification);
        notificationUI.displayNotification(notification);
    });

    signalRClient.onStateChange((state) => {
        console.log('Estado de conexión:', state);
        notificationUI.updateConnectionStatus(state);
    });

    // Configurar formulario de envío
    notificationUI.setupSendForm(async (message, type) => {
        await notificationUI.sendNotification(message, type);
    });

    // Cargar historial de notificaciones
    await notificationUI.loadNotificationHistory();

    // Conectar al hub
    try {
        await signalRClient.connect();
        console.log('Aplicación inicializada correctamente');
    } catch (error) {
        console.error('Error al inicializar la aplicación:', error);
        alert('Error al conectar con el servidor. Por favor, recarga la página.');
    }
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
});
