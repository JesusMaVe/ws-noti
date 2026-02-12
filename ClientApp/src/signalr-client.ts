import * as signalR from '@microsoft/signalr';
import { Notification, ConnectionState } from './types';

export class SignalRClient {
    private connection: signalR.HubConnection | null = null;
    private worker: SharedWorker | null = null;
    private useSharedWorker: boolean = false;
    private hubUrl: string;
    private currentState: ConnectionState = ConnectionState.Disconnected;
    private onNotificationReceived?: (notification: Notification) => void;
    private onConnectionStateChanged?: (state: ConnectionState) => void;

    constructor(hubUrl: string) {
        this.hubUrl = hubUrl;
        this.useSharedWorker = typeof SharedWorker !== 'undefined';

        if (this.useSharedWorker) {
            this.setupSharedWorker();
        } else {
            this.setupDirectConnection();
        }
    }

    private setupSharedWorker(): void {
        try {
            this.worker = new SharedWorker('/shared-websocket-worker.js');

            this.worker.port.onmessage = (event: MessageEvent) => {
                const msg = event.data;

                switch (msg.type) {
                    case 'notification':
                        if (this.onNotificationReceived) {
                            this.onNotificationReceived(msg.data);
                        }
                        break;
                    case 'stateChange':
                        this.handleWorkerStateChange(msg.state);
                        break;
                }
            };

            this.worker.port.start();
            console.log('Using SharedWorker for SignalR connection');
        } catch (e) {
            console.warn('SharedWorker failed, falling back to direct connection:', e);
            this.useSharedWorker = false;
            this.worker = null;
            this.setupDirectConnection();
        }
    }

    private handleWorkerStateChange(state: string): void {
        const stateMap: Record<string, ConnectionState> = {
            'Connected': ConnectionState.Connected,
            'Connecting': ConnectionState.Connecting,
            'Reconnecting': ConnectionState.Reconnecting,
            'Disconnected': ConnectionState.Disconnected,
            'Failed': ConnectionState.Failed
        };
        this.updateConnectionState(stateMap[state] || ConnectionState.Disconnected);
    }

    private setupDirectConnection(): void {
        this.connection = new signalR.HubConnectionBuilder()
            .withUrl(this.hubUrl)
            .withAutomaticReconnect()
            .configureLogging(signalR.LogLevel.Information)
            .build();

        this.setupEventHandlers();
    }

    private setupEventHandlers(): void {
        if (!this.connection) return;

        this.connection.on('ReceiveNotification', (notification: Notification) => {
            console.log('Notificación recibida:', notification);
            if (this.onNotificationReceived) {
                this.onNotificationReceived(notification);
            }
        });

        this.connection.onclose(() => {
            console.log('Conexión cerrada');
            this.updateConnectionState(ConnectionState.Disconnected);
        });

        this.connection.onreconnecting(() => {
            console.log('Reconectando...');
            this.updateConnectionState(ConnectionState.Reconnecting);
        });

        this.connection.onreconnected(() => {
            console.log('Reconectado');
            this.updateConnectionState(ConnectionState.Connected);
        });
    }

    public async connect(): Promise<void> {
        if (this.useSharedWorker && this.worker) {
            this.worker.port.postMessage({ type: 'init', hubUrl: this.hubUrl });
            return;
        }

        if (this.connection) {
            try {
                this.updateConnectionState(ConnectionState.Connecting);
                await this.connection.start();
                console.log('Conectado a SignalR Hub');
                this.updateConnectionState(ConnectionState.Connected);
            } catch (error) {
                console.error('Error al conectar:', error);
                this.updateConnectionState(ConnectionState.Failed);
                throw error;
            }
        }
    }

    public async disconnect(): Promise<void> {
        if (this.useSharedWorker && this.worker) {
            this.worker.port.postMessage({ type: 'disconnect' });
            return;
        }

        if (this.connection) {
            try {
                await this.connection.stop();
                console.log('Desconectado de SignalR Hub');
            } catch (error) {
                console.error('Error al desconectar:', error);
            }
        }
    }

    public onNotification(callback: (notification: Notification) => void): void {
        this.onNotificationReceived = callback;
    }

    public onStateChange(callback: (state: ConnectionState) => void): void {
        this.onConnectionStateChanged = callback;
    }

    private updateConnectionState(state: ConnectionState): void {
        this.currentState = state;
        if (this.onConnectionStateChanged) {
            this.onConnectionStateChanged(state);
        }
    }

    public getConnectionState(): ConnectionState {
        if (this.useSharedWorker) {
            return this.currentState;
        }

        if (!this.connection) return ConnectionState.Disconnected;

        switch (this.connection.state) {
            case signalR.HubConnectionState.Connected:
                return ConnectionState.Connected;
            case signalR.HubConnectionState.Connecting:
                return ConnectionState.Connecting;
            case signalR.HubConnectionState.Reconnecting:
                return ConnectionState.Reconnecting;
            case signalR.HubConnectionState.Disconnected:
                return ConnectionState.Disconnected;
            default:
                return ConnectionState.Disconnected;
        }
    }

    // Expose hub connection for adaptive heartbeat (only works with direct connection)
    public getConnection(): signalR.HubConnection | null {
        return this.connection;
    }
}
