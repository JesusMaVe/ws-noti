using Microsoft.AspNetCore.SignalR;
using notification_app.Models;

namespace notification_app.Hubs;

public class NotificationHub : Hub
{
    public async Task SendNotificationToAll(Notification notification)
    {
        await Clients.All.SendAsync("ReceiveNotification", notification);
    }

    public Task UpdateClientState(string state)
    {
        Console.WriteLine($"Client {Context.ConnectionId} state: {state}");
        return Task.CompletedTask;
    }

    public override async Task OnConnectedAsync()
    {
        await base.OnConnectedAsync();
        Console.WriteLine($"Cliente conectado: {Context.ConnectionId}");
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await base.OnDisconnectedAsync(exception);
        Console.WriteLine($"Cliente desconectado: {Context.ConnectionId}");
    }
}
