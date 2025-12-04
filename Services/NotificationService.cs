using Microsoft.AspNetCore.SignalR;
using notification_app.Hubs;
using notification_app.Models;
using System.Collections.Concurrent;

namespace notification_app.Services;

public class NotificationService
{
    private readonly IHubContext<NotificationHub> _hubContext;
    private readonly ConcurrentQueue<Notification> _notificationHistory;
    private const int MaxHistorySize = 100;

    public NotificationService(IHubContext<NotificationHub> hubContext)
    {
        _hubContext = hubContext;
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

        // Enviar a todos los clientes conectados
        await _hubContext.Clients.All.SendAsync("ReceiveNotification", notification);
    }

    public List<Notification> GetNotificationHistory(int limit = 50)
    {
        return _notificationHistory
            .Reverse()
            .Take(limit)
            .ToList();
    }
}
