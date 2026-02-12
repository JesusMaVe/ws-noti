using System.Collections.Concurrent;
using notification_app.Models;

namespace notification_app.Services;

public class PushSubscriptionService
{
    private readonly ConcurrentDictionary<string, PushSubscriptionModel> _subscriptions = new();

    public void AddSubscription(PushSubscriptionModel subscription)
    {
        _subscriptions.AddOrUpdate(subscription.Endpoint, subscription, (_, _) => subscription);
    }

    public void RemoveSubscription(string endpoint)
    {
        _subscriptions.TryRemove(endpoint, out _);
    }

    public IEnumerable<PushSubscriptionModel> GetAllSubscriptions()
    {
        return _subscriptions.Values;
    }
}
