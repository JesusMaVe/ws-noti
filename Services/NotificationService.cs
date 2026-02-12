using Microsoft.AspNetCore.SignalR;
using notification_app.Hubs;
using notification_app.Models;
using System.Collections.Concurrent;

namespace notification_app.Services;

public class NotificationService
{
    private readonly IHubContext<NotificationHub> _hubContext;
    private readonly WebPushService _webPushService;
    private readonly ILogger<NotificationService> _logger;
    private readonly ConcurrentQueue<Notification> _notificationHistory;
    private const int MaxHistorySize = 100;

    public NotificationService(
        IHubContext<NotificationHub> hubContext,
        WebPushService webPushService,
        ILogger<NotificationService> logger)
    {
        _hubContext = hubContext;
        _webPushService = webPushService;
        _logger = logger;
        _notificationHistory = new ConcurrentQueue<Notification>();
    }

    public async Task SendNotificationAsync(Notification notification)
    {
        // Guardar en historial
        _notificationHistory.Enqueue(notification);

        // Mantener solo las últimas 100 notificaciones
        while (_notificationHistory.Count > MaxHistorySize)
        {
            _notificationHistory.TryDequeue(out _);
        }

        // Enviar a todos los clientes conectados via SignalR
        await _hubContext.Clients.All.SendAsync("ReceiveNotification", notification);

        // Enviar push notification (no debe romper el flujo principal)
        try
        {
            await _webPushService.SendPushToAllAsync(notification);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending push notifications");
        }
    }

    public List<Notification> GetNotificationHistory(int limit = 50)
    {
        return _notificationHistory
            .Reverse()
            .Take(limit)
            .ToList();
    }
}
