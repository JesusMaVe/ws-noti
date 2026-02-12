# Plan: Best Practices - Sistema de Notificaciones

Plan de mejoras de buenas practicas y patrones para el proyecto ws-noti.
Analisis realizado sobre todo el codebase: backend (C# / ASP.NET Core 8), frontend (TypeScript / Webpack) y workers (JS).

---

## Fase 1: Seguridad (Prioridad Critica)

### 1.1 VAPID private key expuesta en logs
- **Archivo**: `Services/WebPushService.cs:35`
- **Problema**: `_logger.LogWarning("PrivateKey: {PrivateKey}", privateKey)` escribe la clave privada criptografica en los logs. Los logs pueden terminar en sistemas de monitoreo, reportes de bugs, etc.
- **Solucion**: Loguear solo que se generaron claves, sin exponer la clave privada:
  ```csharp
  _logger.LogWarning("Generated development VAPID keys. Public key: {PublicKey}. Add keys to appsettings.json.", publicKey);
  ```

### 1.2 XSS via notification.type sin sanitizar
- **Archivo**: `ClientApp/src/notification-ui.ts:88`
- **Problema**: `notification.type` se interpola directamente en `innerHTML` como clase CSS (`notification-${notification.type}`). Solo `message` usa `escapeHtml()`. Un tipo malicioso como `" onload="alert(1)` puede romper el atributo class.
- **Solucion**: Validar el tipo contra la lista permitida antes de insertarlo en HTML:
  ```typescript
  const safeType = ['info', 'success', 'warning', 'error'].includes(notification.type)
      ? notification.type
      : 'info';
  ```

### 1.3 SSRF via endpoint de push subscription
- **Archivo**: `Controllers/PushController.cs:31-42`
- **Problema**: El campo `Endpoint` de la suscripcion se almacena y despues `WebPushClient.SendNotificationAsync` hace HTTP POST a esa URL. Un atacante puede registrar URLs internas (ej. `https://internal-service:8080/admin`) y el servidor hara requests a ellas.
- **Solucion**: Validar que el endpoint coincida con patrones de servicios push conocidos:
  ```csharp
  var allowedHosts = new[] { "fcm.googleapis.com", "updates.push.services.mozilla.com" };
  if (!Uri.TryCreate(subscription.Endpoint, UriKind.Absolute, out var uri)
      || uri.Scheme != "https"
      || !allowedHosts.Any(h => uri.Host.EndsWith(h)))
  {
      return BadRequest(new { error = "Endpoint no valido" });
  }
  ```

### 1.4 CORS abierto sin distincion de entorno
- **Archivo**: `Program.cs:19-27, 42`
- **Problema**: `AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()` se aplica en todos los entornos. El comentario dice "development only" pero no hay verificacion de entorno.
- **Solucion**: Condicionar CORS al entorno:
  ```csharp
  if (app.Environment.IsDevelopment())
  {
      app.UseCors("AllowAll");
  }
  else
  {
      // Configurar origenes permitidos para produccion
  }
  ```

### 1.5 Sin rate limiting en POST de notificaciones
- **Archivo**: `Controllers/NotificationController.cs:22`
- **Problema**: `POST /api/notification` no tiene limite de tasa. Un atacante puede inundar el sistema con notificaciones, llenando la cola en memoria y transmitiendo a todos los clientes.
- **Solucion**: Agregar rate limiting middleware de ASP.NET Core:
  ```csharp
  builder.Services.AddRateLimiter(options =>
  {
      options.AddFixedWindowLimiter("notifications", opt =>
      {
          opt.PermitLimit = 10;
          opt.Window = TimeSpan.FromSeconds(10);
      });
  });
  ```

---

## Fase 2: Validacion de Entrada

### 2.1 Type no validado contra valores permitidos
- **Archivo**: `Controllers/NotificationController.cs:30-35`
- **Problema**: `request.Type ?? "info"` hace default a "info" si es null, pero acepta cualquier string. Un tipo invalido fluye hasta el frontend y se inserta en el DOM.
- **Solucion**: Validar contra los 4 valores permitidos:
  ```csharp
  var validTypes = new[] { "info", "success", "warning", "error" };
  var type = request.Type ?? "info";
  if (!validTypes.Contains(type))
  {
      return BadRequest(new { error = "Tipo invalido. Valores permitidos: info, success, warning, error" });
  }
  ```

### 2.2 Sin limite de longitud en mensajes
- **Archivo**: `Controllers/NotificationController.cs:25`
- **Problema**: Solo se valida que el mensaje no este vacio. Un cliente puede enviar mensajes de megabytes que se almacenan en la `ConcurrentQueue` y se transmiten a todos los clientes conectados.
- **Solucion**: Agregar validacion de longitud maxima:
  ```csharp
  if (request.Message.Length > 1000)
  {
      return BadRequest(new { error = "El mensaje excede la longitud maxima de 1000 caracteres" });
  }
  ```

### 2.3 P256dh y Auth sin validar en push subscription
- **Archivo**: `Controllers/PushController.cs:31-42`
- **Problema**: Solo se valida `Endpoint`. `P256dh` y `Auth` son requeridos para que funcione Web Push pero se aceptan vacios. Una suscripcion con claves vacias causa `WebPushException` en cada intento de envio.
- **Solucion**: Validar todos los campos requeridos:
  ```csharp
  if (string.IsNullOrEmpty(subscription.P256dh) || string.IsNullOrEmpty(subscription.Auth))
  {
      return BadRequest(new { error = "P256dh y Auth son requeridos" });
  }
  ```

### 2.4 Endpoint URL sin validar formato
- **Archivo**: `Controllers/PushController.cs:34`
- **Problema**: Se acepta cualquier string como endpoint. No se verifica que sea una URL HTTPS valida.
- **Solucion**: Validar formato URL (cubierto parcialmente por la solucion de SSRF en 1.3).

### 2.5 Sin data annotations en DTOs de request
- **Archivos**: `NotificationRequest` (NotificationController.cs:81-85), `UnsubscribeRequest` (PushController.cs:74-77)
- **Problema**: Validacion manual con `if` statements en vez de usar el sistema de model validation de ASP.NET Core.
- **Solucion**: Agregar data annotations:
  ```csharp
  public class NotificationRequest
  {
      [Required(ErrorMessage = "El mensaje es requerido")]
      [StringLength(1000, ErrorMessage = "El mensaje excede la longitud maxima")]
      public string Message { get; set; } = string.Empty;

      [RegularExpression("^(info|success|warning|error)$", ErrorMessage = "Tipo invalido")]
      public string? Type { get; set; }
  }
  ```

---

## Fase 3: Logging y Manejo de Errores

### 3.1 Console.WriteLine en NotificationHub
- **Archivo**: `Hubs/NotificationHub.cs:15, 22, 28`
- **Problema**: 3 instancias de `Console.WriteLine($"...")` con string interpolation. Viola las convenciones del proyecto (structured logging con `ILogger<T>`, sin interpolacion en logs).
- **Solucion**: Inyectar `ILogger<NotificationHub>` y reemplazar:
  ```csharp
  private readonly ILogger<NotificationHub> _logger;

  public NotificationHub(ILogger<NotificationHub> logger)
  {
      _logger = logger;
  }

  // Reemplazar:
  // Console.WriteLine($"Cliente conectado: {Context.ConnectionId}");
  // Por:
  _logger.LogInformation("Cliente conectado: {ConnectionId}", Context.ConnectionId);
  ```

### 3.2 SignalR broadcast sin try/catch
- **Archivo**: `Services/NotificationService.cs:39`
- **Problema**: `await _hubContext.Clients.All.SendAsync("ReceiveNotification", notification)` no esta en try/catch. Si falla, la notificacion ya esta en el historial (linea 30) pero nunca se entrego. Estado inconsistente.
- **Solucion**: Envolver en try/catch:
  ```csharp
  try
  {
      await _hubContext.Clients.All.SendAsync("ReceiveNotification", notification);
  }
  catch (Exception ex)
  {
      _logger.LogError(ex, "Error enviando notificacion SignalR: {NotificationId}", notification.Id);
  }
  ```

### 3.3 OnDisconnectedAsync ignora el parametro exception
- **Archivo**: `Hubs/NotificationHub.cs:25`
- **Problema**: El parametro `Exception? exception` nunca se loguea. Si un cliente se desconecta por error, esa informacion se pierde.
- **Solucion**:
  ```csharp
  if (exception != null)
  {
      _logger.LogWarning(exception, "Cliente desconectado con error: {ConnectionId}", Context.ConnectionId);
  }
  ```

### 3.4 ex.Message redundante en template de log
- **Archivo**: `Services/WebPushService.cs:82`
- **Problema**: `_logger.LogError(ex, "Error sending push to {Endpoint}: {Message}", sub.Endpoint, ex.Message)` -- `ex.Message` se duplica porque el objeto `ex` ya incluye el mensaje completo.
- **Solucion**: Remover `{Message}` y `ex.Message`:
  ```csharp
  _logger.LogError(ex, "Error enviando push a {Endpoint}", sub.Endpoint);
  ```

### 3.5 Fetch calls sin verificar response.ok (Frontend)
- **Archivo**: `ClientApp/src/push-manager.ts:44, 76, 96-108`
- **Problema**: 3 llamadas `fetch` que no verifican `response.ok`. Si el servidor devuelve 500 o es inalcanzable, el error pasa silenciosamente.
- **Solucion**: Verificar `response.ok` despues de cada fetch:
  ```typescript
  const response = await fetch(...);
  if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
  }
  ```

### 3.6 onSend callback es fire-and-forget
- **Archivo**: `ClientApp/src/notification-ui.ts:122-137`
- **Problema**: `onSend(message, type)` en linea 136 no se espera con `await`. El callback es async pero su promesa se ignora. Errores pueden perderse.
- **Solucion**: Hacer el handler async y esperar el callback:
  ```typescript
  form.addEventListener('submit', async (e) => {
      e.preventDefault();
      // ...
      await onSend(message, type);
  });
  ```

---

## Fase 4: Patrones y Arquitectura

### 4.1 NotificationService viola Single Responsibility Principle
- **Archivo**: `Services/NotificationService.cs:8-59`
- **Problema**: 3 responsabilidades mezcladas: gestion de historial (enqueue/dequeue/retrieve), broadcast SignalR, y trigger de web push.
- **Solucion**: Extraer `NotificationHistoryService` para el manejo del historial. `NotificationService` queda como orquestador que delega a `NotificationHistoryService`, `IHubContext`, y `WebPushService`.

### 4.2 NotificationUI mezcla DOM y llamadas HTTP
- **Archivo**: `ClientApp/src/notification-ui.ts`
- **Problema**: La clase hace rendering DOM (`displayNotification`, `updateStatus`) Y llamadas HTTP (`sendNotification`, `loadNotificationHistory`). Dos responsabilidades distintas: presentacion y acceso a datos.
- **Solucion**: Extraer `ApiClient` o `NotificationApiService` para las llamadas HTTP. `NotificationUI` queda puramente para manipulacion DOM.

### 4.3 Sin DTOs de respuesta
- **Archivos**: Controllers
- **Problema**: Las respuestas usan anonymous objects (`new { success = true, notification }`). El contrato API es implicito y no tipado. El modelo interno `Notification` se expone directamente.
- **Solucion**: Crear DTOs de respuesta en `Models/Responses/`:
  ```csharp
  public class NotificationResponse
  {
      public string Id { get; set; } = string.Empty;
      public string Message { get; set; } = string.Empty;
      public DateTime Timestamp { get; set; }
      public string Type { get; set; } = "info";
  }
  ```

### 4.4 WebPushClient creado internamente (no testeable)
- **Archivo**: `Services/WebPushService.cs:21`
- **Problema**: `_pushClient = new WebPushClient()` crea la dependencia directamente en el constructor. Imposible hacer unit test sin hacer HTTP requests reales.
- **Solucion**: Registrar `WebPushClient` en DI e inyectarlo:
  ```csharp
  builder.Services.AddSingleton<WebPushClient>();
  ```

### 4.5 Mapeo type-to-label duplicado 3 veces
- **Archivos**: `Services/WebPushService.cs:92-101`, `ClientApp/src/index.ts:20-27`, `ClientApp/src/notification-ui.ts:98-106`
- **Problema**: El mapeo de tipo a titulo/etiqueta esta definido 3 veces con formatos ligeramente distintos. Si se agrega un nuevo tipo, hay que actualizar 3 archivos.
- **Solucion**: Frontend: consolidar en un unico mapeo en `types.ts`. Backend: incluir el titulo en el modelo o payload de push.

---

## Fase 5: Gestion de Recursos y Null Safety

### 5.1 WebPushClient nunca se dispone
- **Archivo**: `Services/WebPushService.cs`
- **Problema**: `WebPushClient` internamente usa `HttpClient`. `WebPushService` es singleton y no implementa `IDisposable`. El `HttpClient` interno puede mantener conexiones abiertas.
- **Solucion**: Implementar `IDisposable`:
  ```csharp
  public class WebPushService : IDisposable
  {
      public void Dispose()
      {
          _pushClient?.Dispose();
      }
  }
  ```

### 5.2 Event listeners del DOM nunca se remueven
- **Archivo**: `ClientApp/src/activity-detector.ts:15-21, 54`
- **Problema**: `setupListeners()` agrega 6 event listeners con una arrow function anonima. `destroy()` solo limpia el `setInterval` pero nunca remueve los listeners. Memory leak y actividad fantasma despues de destruir.
- **Solucion**: Guardar referencia al handler y remover en `destroy()`:
  ```typescript
  private handler = () => this.registerActivity();

  public destroy(): void {
      if (this.checkInterval !== null) clearInterval(this.checkInterval);
      const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
      events.forEach(event => document.removeEventListener(event, this.handler));
  }
  ```

### 5.3 messageInput sin null check
- **Archivo**: `ClientApp/src/notification-ui.ts:166`
- **Problema**: `messageInput.value = ''` puede lanzar `TypeError` si el elemento no existe en el DOM. La linea no tiene guard clause.
- **Solucion**: Agregar verificacion:
  ```typescript
  if (messageInput) {
      messageInput.value = '';
  }
  ```

### 5.4 Callback del heartbeat no se limpia al destruir
- **Archivo**: `ClientApp/src/adaptive-heartbeat.ts:22-24, 66-68`
- **Problema**: `destroy()` solo llama `this.stop()` (limpia interval) pero el callback de `activityDetector.onStateChange()` sigue activo. Retiene referencia al closure del heartbeat, previniendo garbage collection.
- **Solucion**: Limpiar el callback en `destroy()`:
  ```typescript
  public destroy(): void {
      this.stop();
      this.activityDetector.destroy();
  }
  ```

---

## Fase 6: Infraestructura

### 6.1 Sin middleware de excepciones global para API
- **Archivo**: `Program.cs:32-37`
- **Problema**: `UseExceptionHandler("/Error")` redirige a una Razor page. Excepciones no capturadas en controllers API devuelven HTML, no JSON.
- **Solucion**: Agregar handler que devuelve JSON:
  ```csharp
  app.UseExceptionHandler(appBuilder =>
  {
      appBuilder.Run(async context =>
      {
          context.Response.ContentType = "application/json";
          context.Response.StatusCode = 500;
          await context.Response.WriteAsJsonAsync(new { error = "Error interno del servidor" });
      });
  });
  ```

### 6.2 UseStaticFiles despues de UseRouting
- **Archivo**: `Program.cs:44-49`
- **Problema**: `app.UseStaticFiles()` esta despues de `UseRouting()` y `UseAuthorization()`. Cada request de archivos estaticos (CSS, JS, imagenes) pasa innecesariamente por routing y authorization.
- **Solucion**: Mover `UseStaticFiles()` antes de `UseRouting()`.

### 6.3 Health check custom vs framework nativo
- **Archivo**: `Controllers/NotificationController.cs:54-58`
- **Problema**: Endpoint custom que solo devuelve `{ status: "healthy" }`. No usa el framework de health checks de ASP.NET Core que se integra con herramientas de monitoreo.
- **Solucion**: Usar health checks nativos:
  ```csharp
  builder.Services.AddHealthChecks();
  app.MapHealthChecks("/health");
  ```

### 6.4 Sin limite de reconexion en SharedWorker
- **Archivo**: `wwwroot/shared-websocket-worker.js:186-195`
- **Problema**: `reconnectAttempt` incrementa sin limite. Si el servidor esta permanentemente caido, el worker intenta reconectar cada 30 segundos indefinidamente.
- **Solucion**: Agregar limite maximo:
  ```javascript
  var MAX_RECONNECT_ATTEMPTS = 50;
  if (reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      updateState('Failed');
      return;
  }
  ```

### 6.5 disconnect() async en beforeunload
- **Archivo**: `ClientApp/src/index.ts:184-190`
- **Problema**: `signalRClient.disconnect()` es async pero se llama sin `await` en el handler de `beforeunload`. El browser puede cerrar la pagina antes de que se complete la desconexion.
- **Solucion**: Documentar la limitacion. Considerar `navigator.sendBeacon()` para cleanup, o aceptar que el timeout server-side de SignalR limpiara la conexion.

### 6.6 Sin request logging en desarrollo
- **Archivo**: `Program.cs`
- **Problema**: No hay middleware de logging HTTP. Dificil debuggear requests entrantes, codigos de respuesta y tiempos.
- **Solucion**: Agregar `app.UseHttpLogging()` en desarrollo.

---

## Resumen

| Fase | Severidad | Items | Descripcion |
|------|-----------|-------|-------------|
| 1 | Critica | 5 | Seguridad: logs de claves, XSS, SSRF, CORS, rate limiting |
| 2 | Alta | 5 | Validacion: tipos, longitud, campos requeridos, data annotations |
| 3 | Alta | 6 | Errores: Console.WriteLine, try/catch, response.ok, fire-and-forget |
| 4 | Media | 5 | Arquitectura: SRP, separacion de responsabilidades, DTOs, DI, DRY |
| 5 | Media | 4 | Recursos: IDisposable, event listeners, null safety, cleanup |
| 6 | Baja | 6 | Infra: exception middleware, static files, health checks, reconnect |
| **Total** | | **31** | |

### Orden de implementacion recomendado

Implementar en orden de fase (1 -> 6). Dentro de cada fase, los items son independientes y pueden hacerse en paralelo.
