namespace notification_app.Models;

public class Notification
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Message { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string Type { get; set; } = "info"; // info, success, warning, error
}
