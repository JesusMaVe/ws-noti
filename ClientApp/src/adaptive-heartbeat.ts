import * as signalR from '@microsoft/signalr';
import { ActivityDetector } from './activity-detector';

export class AdaptiveHeartbeat {
    private activityDetector: ActivityDetector;
    private connection: signalR.HubConnection | null;
    private activeIntervalMs: number;
    private idleIntervalMs: number;
    private heartbeatTimer: number | null = null;

    constructor(
        connection: signalR.HubConnection | null,
        activityDetector: ActivityDetector,
        activeIntervalMs: number = 30000,  // 30s when active
        idleIntervalMs: number = 180000    // 3min when idle
    ) {
        this.connection = connection;
        this.activityDetector = activityDetector;
        this.activeIntervalMs = activeIntervalMs;
        this.idleIntervalMs = idleIntervalMs;

        this.activityDetector.onStateChange((active) => {
            this.adjustHeartbeat(active);
        });
    }

    public start(): void {
        this.scheduleHeartbeat(this.activeIntervalMs);
    }

    public stop(): void {
        if (this.heartbeatTimer !== null) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    private adjustHeartbeat(active: boolean): void {
        const interval = active ? this.activeIntervalMs : this.idleIntervalMs;
        this.scheduleHeartbeat(interval);
        console.log(`Heartbeat adjusted: ${active ? 'active' : 'idle'} (${interval / 1000}s)`);
    }

    private scheduleHeartbeat(intervalMs: number): void {
        this.stop();
        this.heartbeatTimer = window.setInterval(() => {
            this.sendHeartbeat();
        }, intervalMs);
    }

    private sendHeartbeat(): void {
        if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) {
            return;
        }

        const state = this.activityDetector.getIsActive() ? 'active' : 'idle';
        this.connection.invoke('UpdateClientState', state).catch((err: Error) => {
            console.warn('Heartbeat failed:', err);
        });
    }

    public updateConnection(connection: signalR.HubConnection | null): void {
        this.connection = connection;
    }

    public destroy(): void {
        this.stop();
    }
}
