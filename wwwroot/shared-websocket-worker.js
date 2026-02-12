// shared-websocket-worker.js
// SharedWorker that maintains a single SignalR WebSocket connection
// and broadcasts notifications to all connected tabs

const RECORD_SEPARATOR = '\x1e';
const RECONNECT_DELAYS = [0, 2000, 5000, 10000, 30000];

let ports = [];
let ws = null;
let hubUrl = null;
let currentState = 'Disconnected';
let reconnectAttempt = 0;
let reconnectTimer = null;
let pingTimer = null;

self.onconnect = function (e) {
    const port = e.ports[0];
    ports.push(port);

    // Send current state to new port
    port.postMessage({ type: 'stateChange', state: currentState });

    port.onmessage = function (event) {
        const msg = event.data;

        switch (msg.type) {
            case 'init':
                if (!hubUrl) {
                    hubUrl = msg.hubUrl;
                }
                if (!ws || ws.readyState === WebSocket.CLOSED) {
                    connectToHub();
                }
                break;

            case 'disconnect':
                removePort(port);
                break;
        }
    };

    port.start();
};

function removePort(port) {
    const index = ports.indexOf(port);
    if (index > -1) {
        ports.splice(index, 1);
    }
    if (ports.length === 0) {
        cleanup();
    }
}

function cleanup() {
    if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = null;
    }
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    if (ws) {
        ws.close();
        ws = null;
    }
    currentState = 'Disconnected';
}

async function connectToHub() {
    if (!hubUrl) return;

    updateState('Connecting');

    try {
        // Step 1: Negotiate with SignalR
        const negotiateUrl = hubUrl + '/negotiate?negotiateVersion=1';
        const response = await fetch(negotiateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' }
        });

        if (!response.ok) {
            throw new Error('Negotiate failed: ' + response.status);
        }

        const data = await response.json();
        const connectionToken = data.connectionToken;

        // Step 2: Open WebSocket connection
        const httpUrl = new URL(hubUrl);
        const wsScheme = httpUrl.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = wsScheme + '//' + httpUrl.host + httpUrl.pathname + '?id=' + encodeURIComponent(connectionToken);

        ws = new WebSocket(wsUrl);

        ws.onopen = function () {
            // Step 3: Send SignalR JSON protocol handshake
            ws.send(JSON.stringify({ protocol: 'json', version: 1 }) + RECORD_SEPARATOR);
        };

        ws.onmessage = function (event) {
            const messages = event.data.split(RECORD_SEPARATOR).filter(function (m) { return m.length > 0; });

            for (const msg of messages) {
                try {
                    const parsed = JSON.parse(msg);
                    handleSignalRMessage(parsed);
                } catch (e) {
                    // Ignore parse errors
                }
            }
        };

        ws.onclose = function () {
            ws = null;
            if (pingTimer) {
                clearInterval(pingTimer);
                pingTimer = null;
            }

            if (ports.length > 0) {
                updateState('Reconnecting');
                scheduleReconnect();
            } else {
                updateState('Disconnected');
            }
        };

        ws.onerror = function () {
            // onclose will be called after this
        };

    } catch (error) {
        if (ports.length > 0) {
            updateState('Reconnecting');
            scheduleReconnect();
        } else {
            updateState('Failed');
        }
    }
}

function handleSignalRMessage(msg) {
    switch (msg.type) {
        case undefined:
            // Handshake response (no type field means success)
            if (!msg.error) {
                updateState('Connected');
                reconnectAttempt = 0;
                startPingInterval();
            } else {
                updateState('Failed');
            }
            break;

        case 1: // Invocation
            if (msg.target === 'ReceiveNotification' && msg.arguments && msg.arguments.length > 0) {
                broadcast({ type: 'notification', data: msg.arguments[0] });
            }
            break;

        case 6: // Ping - respond with ping
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 6 }) + RECORD_SEPARATOR);
            }
            break;

        case 7: // Close
            if (ws) ws.close();
            break;
    }
}

function startPingInterval() {
    if (pingTimer) clearInterval(pingTimer);
    // Send ping every 15 seconds to keep connection alive
    pingTimer = setInterval(function () {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 6 }) + RECORD_SEPARATOR);
        }
    }, 15000);
}

function scheduleReconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    const delay = RECONNECT_DELAYS[Math.min(reconnectAttempt, RECONNECT_DELAYS.length - 1)];
    reconnectAttempt++;
    reconnectTimer = setTimeout(function () {
        if (ports.length > 0) {
            connectToHub();
        }
    }, delay);
}

function updateState(state) {
    currentState = state;
    broadcast({ type: 'stateChange', state: state });
}

function broadcast(message) {
    const deadPorts = [];
    for (const port of ports) {
        try {
            port.postMessage(message);
        } catch (e) {
            deadPorts.push(port);
        }
    }
    for (const port of deadPorts) {
        removePort(port);
    }
}
