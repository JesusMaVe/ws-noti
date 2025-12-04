using Microsoft.AspNetCore.Mvc;
using notification_app.Models;
using notification_app.Services;

namespace notification_app.Controllers;

[ApiController]
[Route("api/[controller]")]
public class NotificationController : ControllerBase
{
    private readonly NotificationService _notificationService;
    private readonly ILogger<NotificationController> _logger;

    public NotificationController(
        NotificationService notificationService,
        ILogger<NotificationController> logger)
    {
        _notificationService = notificationService;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> SendNotification([FromBody] NotificationRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
        {
            return BadRequest(new { error = "El mensaje no puede estar vacío" });
        }

        var notification = new Notification
        {
            Message = request.Message,
            Type = request.Type ?? "info",
            Timestamp = DateTime.UtcNow
        };

        try
        {
            await _notificationService.SendNotificationAsync(notification);
            _logger.LogInformation("Notificación enviada: {Message}", notification.Message);

            return Ok(new {
                success = true,
                notification = notification
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al enviar notificación");
            return StatusCode(500, new { error = "Error al enviar la notificación" });
        }
    }

    [HttpGet("health")]
    public IActionResult Health()
    {
        return Ok(new { status = "healthy", timestamp = DateTime.UtcNow });
    }

    [HttpGet("history")]
    public IActionResult GetHistory([FromQuery] int limit = 50)
    {
        try
        {
            var history = _notificationService.GetNotificationHistory(limit);
            return Ok(new
            {
                success = true,
                count = history.Count,
                notifications = history
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener historial de notificaciones");
            return StatusCode(500, new { error = "Error al obtener el historial" });
        }
    }
}

public class NotificationRequest
{
    public string Message { get; set; } = string.Empty;
    public string? Type { get; set; }
}
