# Sistema de Notificaciones en Tiempo Real

Sistema MVP de notificaciones en tiempo real usando ASP.NET Core, SignalR y TypeScript con Webpack.

## Características

- **Backend**: ASP.NET Core 8 con SignalR
- **Frontend**: TypeScript + Webpack
- **Notificaciones broadcast** en tiempo real a todos los usuarios conectados
- **Historial de notificaciones** en memoria (últimas 100 notificaciones)
- **API REST** para enviar y obtener notificaciones
- **Persistencia en memoria** durante la sesión del servidor
- **Reconexión automática** de SignalR
- **Carga automática** del historial al abrir nuevas pestañas

## Estructura del Proyecto

```
notification-app/
├── Controllers/
│   └── NotificationController.cs    # API REST para notificaciones
├── Hubs/
│   └── NotificationHub.cs           # Hub de SignalR
├── Models/
│   └── Notification.cs              # Modelo de notificación
├── Services/
│   └── NotificationService.cs       # Servicio de notificaciones
├── ClientApp/                       # Aplicación frontend
│   ├── src/
│   │   ├── index.ts                 # Punto de entrada
│   │   ├── signalr-client.ts        # Cliente SignalR
│   │   ├── notification-ui.ts       # Lógica de UI
│   │   └── types.ts                 # Tipos TypeScript
│   ├── package.json
│   ├── tsconfig.json
│   └── webpack.config.js
└── wwwroot/
    ├── index.html                   # Página principal
    └── dist/
        └── bundle.js                # Bundle compilado
```

## Requisitos Previos

- .NET 8.0 SDK
- Node.js 18+ y npm

## Instalación

### 1. Instalar dependencias de Node.js

```bash
cd ClientApp
npm install
```

### 2. Compilar el frontend

```bash
npm run build
```

Para desarrollo con watch mode:

```bash
npm run dev
```

### 3. Compilar el backend

```bash
cd ..
dotnet build
```

## Uso

### Iniciar la aplicación

```bash
dotnet run
```

La aplicación estará disponible en `http://localhost:5094`

### Acceder a la interfaz web

Abre tu navegador en:
```
http://localhost:5094/index.html
```

### Probar con múltiples pestañas

1. Abre varias pestañas del navegador con la misma URL
2. En cualquier pestaña, escribe un mensaje y selecciona un tipo
3. Haz clic en "Enviar Notificación"
4. **Todas las pestañas recibirán la notificación en tiempo real**
5. **Las nuevas pestañas cargarán automáticamente el historial de notificaciones previas**

## API Endpoints

### Enviar notificación

```bash
POST /api/notification
Content-Type: application/json

{
  "message": "Tu mensaje aquí",
  "type": "info"  // info, success, warning, error
}
```

Ejemplo con curl:

```bash
curl -X POST http://localhost:5094/api/notification \
  -H "Content-Type: application/json" \
  -d '{"message":"Hola mundo","type":"success"}'
```

### Obtener historial de notificaciones

```bash
GET /api/notification/history?limit=50
```

Respuesta:
```json
{
  "success": true,
  "count": 3,
  "notifications": [
    {
      "id": "uuid",
      "message": "Mensaje de la notificación",
      "timestamp": "2025-12-04T06:48:56.654839Z",
      "type": "warning"
    }
  ]
}
```

### Health Check

```bash
GET /api/notification/health
```

## SignalR Hub

El hub de SignalR está disponible en:
```
/notificationHub
```

### Eventos del Hub

- **ReceiveNotification**: Recibe notificaciones broadcast

## Tipos de Notificaciones

- `info`: Información (azul)
- `success`: Éxito (verde)
- `warning`: Advertencia (amarillo)
- `error`: Error (rojo)

## Desarrollo

### Scripts disponibles

En el directorio `ClientApp/`:

- `npm run build`: Compila para producción
- `npm run dev`: Compila en modo desarrollo con watch
- `npm run watch`: Alias para dev

### Recompilar frontend después de cambios

Después de modificar archivos TypeScript:

```bash
cd ClientApp
npm run build
cd ..
dotnet run
```

## Arquitectura

### Flujo de Notificaciones

1. Usuario envía notificación desde el frontend (index.html)
2. Cliente hace POST a `/api/notification`
3. `NotificationController` recibe la petición
4. `NotificationService` usa `IHubContext` para enviar broadcast
5. `NotificationHub` envía evento `ReceiveNotification` a todos los clientes
6. Todos los clientes conectados reciben y muestran la notificación

### Características Técnicas

- **Reconexión automática**: SignalR intenta reconectar automáticamente si se pierde la conexión
- **Type-safety**: TypeScript proporciona tipos estáticos en el frontend
- **CORS configurado**: Permite conexiones desde cualquier origen (solo para desarrollo)
- **Logging**: Muestra logs de conexión/desconexión en la consola del servidor

## Próximas Mejoras

- Agregar persistencia con Entity Framework Core
- Implementar autenticación y autorización
- Notificaciones a usuarios específicos (no solo broadcast)
- Marcar notificaciones como leídas/no leídas
- Notificaciones push del navegador
- Tests unitarios y de integración
- Docker support

## Troubleshooting

### El bundle.js no se encuentra

Asegúrate de compilar el frontend:
```bash
cd ClientApp
npm run build
```

### CORS issues

El proyecto está configurado con CORS permisivo para desarrollo. Para producción, configura las URLs permitidas en `Program.cs`.

### Puerto en uso

Si el puerto 5094 está en uso, puedes modificarlo en `Properties/launchSettings.json`.

## Licencia

MIT
