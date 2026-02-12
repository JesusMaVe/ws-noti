using Microsoft.AspNetCore.Mvc;
using notification_app.Models;
using notification_app.Services;

namespace notification_app.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PushController : ControllerBase
{
    private readonly PushSubscriptionService _subscriptionService;
    private readonly WebPushService _webPushService;
    private readonly ILogger<PushController> _logger;

    public PushController(
        PushSubscriptionService subscriptionService,
        WebPushService webPushService,
        ILogger<PushController> logger)
    {
        _subscriptionService = subscriptionService;
        _webPushService = webPushService;
        _logger = logger;
    }

    [HttpGet("vapid-public-key")]
    public IActionResult GetVapidPublicKey()
    {
        return Ok(new { publicKey = _webPushService.GetPublicKey() });
    }

    [HttpPost("subscribe")]
    public IActionResult Subscribe([FromBody] PushSubscriptionModel subscription)
    {
        if (string.IsNullOrEmpty(subscription.Endpoint))
        {
            return BadRequest(new { error = "Endpoint is required" });
        }

        _subscriptionService.AddSubscription(subscription);
        _logger.LogInformation("New push subscription: {Endpoint}", subscription.Endpoint);
        return Ok(new { success = true });
    }

    [HttpPost("unsubscribe")]
    public IActionResult Unsubscribe([FromBody] UnsubscribeRequest request)
    {
        if (string.IsNullOrEmpty(request.Endpoint))
        {
            return BadRequest(new { error = "Endpoint is required" });
        }

        _subscriptionService.RemoveSubscription(request.Endpoint);
        _logger.LogInformation("Push subscription removed: {Endpoint}", request.Endpoint);
        return Ok(new { success = true });
    }
}

public class UnsubscribeRequest
{
    public string Endpoint { get; set; } = string.Empty;
}
