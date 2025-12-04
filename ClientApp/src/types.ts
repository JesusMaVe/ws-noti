export interface Notification {
    id: string;
    message: string;
    timestamp: string;
    type: 'info' | 'success' | 'warning' | 'error';
}

export enum ConnectionState {
    Disconnected = 'Disconnected',
    Connecting = 'Connecting',
    Connected = 'Connected',
    Reconnecting = 'Reconnecting',
    Failed = 'Failed'
}

export interface NotificationRequest {
    message: string;
    type?: string;
}
