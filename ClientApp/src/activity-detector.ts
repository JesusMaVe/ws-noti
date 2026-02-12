export class ActivityDetector {
    private lastActivityTime: number;
    private isActive: boolean = true;
    private idleTimeout: number;
    private checkInterval: number | null = null;
    private onStateChangeCallback?: (active: boolean) => void;

    constructor(idleTimeoutMs: number = 120000) { // 2 minutes default
        this.lastActivityTime = Date.now();
        this.idleTimeout = idleTimeoutMs;
        this.setupListeners();
        this.startChecking();
    }

    private setupListeners(): void {
        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
        const handler = () => this.registerActivity();

        events.forEach(event => {
            document.addEventListener(event, handler, { passive: true });
        });
    }

    private registerActivity(): void {
        this.lastActivityTime = Date.now();
        if (!this.isActive) {
            this.isActive = true;
            this.onStateChangeCallback?.(true);
        }
    }

    private startChecking(): void {
        this.checkInterval = window.setInterval(() => {
            const elapsed = Date.now() - this.lastActivityTime;
            if (elapsed >= this.idleTimeout && this.isActive) {
                this.isActive = false;
                this.onStateChangeCallback?.(false);
            }
        }, 10000); // Check every 10 seconds
    }

    public onStateChange(callback: (active: boolean) => void): void {
        this.onStateChangeCallback = callback;
    }

    public getIsActive(): boolean {
        return this.isActive;
    }

    public getTimeSinceLastActivity(): number {
        return Date.now() - this.lastActivityTime;
    }

    public destroy(): void {
        if (this.checkInterval !== null) {
            clearInterval(this.checkInterval);
        }
    }
}
