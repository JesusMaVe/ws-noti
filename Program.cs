using notification_app.Hubs;
using notification_app.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorPages();
builder.Services.AddControllers();

// Configurar SignalR
builder.Services.AddSignalR();

// Registrar servicios
builder.Services.AddSingleton<PushSubscriptionService>();
builder.Services.AddSingleton<WebPushService>();
builder.Services.AddSingleton<NotificationService>();

// Configurar CORS para permitir conexiones desde el frontend
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();

// Habilitar CORS
app.UseCors("AllowAll");

app.UseRouting();

app.UseAuthorization();

// Mapear archivos estáticos
app.UseStaticFiles();

// Mapear controladores API
app.MapControllers();

// Mapear SignalR Hub
app.MapHub<NotificationHub>("/notificationHub");

// Mapear Razor Pages
app.MapRazorPages();

app.Run();
