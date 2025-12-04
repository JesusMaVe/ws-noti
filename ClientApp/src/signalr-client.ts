import * as signalR from '@microsoft/signalr';
import { Notification, ConnectionState } from './types';

export class SignalRClient {
    private connection: signalR.HubConnection;
    private onNotificationReceived?: (notification: Notification) => void;
    private onConnectionStateChanged?: (state: ConnectionState) => void;

    constructor(hubUrl: string) {
        this.connection = new signalR.HubConnectionBuilder()
            .withUrl(hubUrl)
            .withAutomaticReconnect()
            .configureLogging(signalR.LogLevel.Information)
            .build();

        this.setupEventHandlers();
    }

    private setupEventHandlers(): void {
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

    public async disconnect(): Promise<void> {
        try {
            await this.connection.stop();
            console.log('Desconectado de SignalR Hub');
        } catch (error) {
            console.error('Error al desconectar:', error);
        }
    }

    public onNotification(callback: (notification: Notification) => void): void {
        this.onNotificationReceived = callback;
    }

    public onStateChange(callback: (state: ConnectionState) => void): void {
        this.onConnectionStateChanged = callback;
    }

    private updateConnectionState(state: ConnectionState): void {
        if (this.onConnectionStateChanged) {
            this.onConnectionStateChanged(state);
        }
    }

    public getConnectionState(): ConnectionState {
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
}
