using WebPush;
using notification_app.Models;
using System.Text.Json;

namespace notification_app.Services;

public class WebPushService
{
    private readonly PushSubscriptionService _subscriptionService;
    private readonly VapidDetails _vapidDetails;
    private readonly WebPushClient _pushClient;
    private readonly ILogger<WebPushService> _logger;

    public WebPushService(
        PushSubscriptionService subscriptionService,
        IConfiguration configuration,
        ILogger<WebPushService> logger)
    {
        _subscriptionService = subscriptionService;
        _logger = logger;
        _pushClient = new WebPushClient();

        var vapidSection = configuration.GetSection("VapidKeys");
        var subject = vapidSection["Subject"] ?? "mailto:dev@example.com";
        var publicKey = vapidSection["PublicKey"];
        var privateKey = vapidSection["PrivateKey"];

        if (string.IsNullOrEmpty(publicKey) || string.IsNullOrEmpty(privateKey))
        {
            var keys = VapidHelper.GenerateVapidKeys();
            publicKey = keys.PublicKey;
            privateKey = keys.PrivateKey;
            _logger.LogWarning("VAPID keys not configured. Generated development keys:");
            _logger.LogWarning("PublicKey: {PublicKey}", publicKey);
            _logger.LogWarning("PrivateKey: {PrivateKey}", privateKey);
            _logger.LogWarning("Add these to appsettings.json under VapidKeys section for persistence.");
        }

        _vapidDetails = new VapidDetails(subject, publicKey, privateKey);
    }

    public string GetPublicKey() => _vapidDetails.PublicKey;

    public async Task SendPushToAllAsync(Notification notification)
    {
        var payload = JsonSerializer.Serialize(new
        {
            title = GetTitle(notification.Type),
            body = notification.Message,
            type = notification.Type,
            id = notification.Id,
            timestamp = notification.Timestamp
        });

        var subscriptions = _subscriptionService.GetAllSubscriptions().ToList();
        var expiredEndpoints = new List<string>();

        foreach (var sub in subscriptions)
        {
            try
            {
                var pushSubscription = new PushSubscription(sub.Endpoint, sub.P256dh, sub.Auth);
                await _pushClient.SendNotificationAsync(pushSubscription, payload, _vapidDetails);
            }
            catch (WebPushException ex) when (ex.StatusCode == System.Net.HttpStatusCode.Gone ||
                                               ex.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                _logger.LogInformation("Removing expired push subscription: {Endpoint}", sub.Endpoint);
                expiredEndpoints.Add(sub.Endpoint);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending push to {Endpoint}", sub.Endpoint);
            }
        }

        foreach (var endpoint in expiredEndpoints)
        {
            _subscriptionService.RemoveSubscription(endpoint);
        }
    }

    private static string GetTitle(string type)
    {
        return type switch
        {
            "success" => "Notificacion exitosa",
            "warning" => "Advertencia",
            "error" => "Error",
            _ => "Nueva notificacion"
        };
    }
}
