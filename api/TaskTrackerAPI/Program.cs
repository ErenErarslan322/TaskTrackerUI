using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using TaskTrackerAPI.Models;
using TaskTrackerAPI.Security;
using Microsoft.IdentityModel.Tokens;
using TaskTrackerAPI.Data;
using TaskTrackerAPI.Hubs;

const string upgradePasswordsOption = "--upgrade-password-storage";
var upgradePasswords = args.Contains(upgradePasswordsOption, StringComparer.Ordinal);
var builder = WebApplication.CreateBuilder(args.Where(arg => arg != upgradePasswordsOption).ToArray());
if (upgradePasswords)
{
    builder.Logging.AddFilter("Microsoft.EntityFrameworkCore.Database.Command", LogLevel.Warning);
}

builder.Services.AddControllers();
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.Configure<PasswordHasherOptions>(options =>
{
    options.CompatibilityMode = PasswordHasherCompatibilityMode.IdentityV3;
    options.IterationCount = 220_000;
});
builder.Services.AddScoped<LegacyPasswordUpgrade>();
builder.Services.AddSignalR();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));


if (!upgradePasswords)
{
    var jwtSigningKey = ReadJwtSigningKey(builder.Configuration);
    builder.Services.AddSingleton(jwtSigningKey);
    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.Events = new JwtBearerEvents
            {
                OnMessageReceived = context =>
                {
                    var token = context.Request.Query["access_token"];
                    if (!string.IsNullOrEmpty(token) && context.HttpContext.Request.Path.StartsWithSegments("/apphub"))
                    {
                        context.Token = token;
                    }
                    return Task.CompletedTask;
                }
            };
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = false,
                ValidateAudience = false,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = jwtSigningKey
            };
        });
}

builder.Services.AddAuthorization();
builder.Services.AddScoped<NotificationDelivery>();
builder.Services.AddSignalR(); // 1. SignalR servisi buraya eklendi

var app = builder.Build();

if (upgradePasswords)
{
    await using var scope = app.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
    var count = await scope.ServiceProvider.GetRequiredService<LegacyPasswordUpgrade>().UpgradeAsync();
    Console.WriteLine($"Password records upgraded: {count}.");
    return;
}

// 2. CORS ayarı SignalR için WithOrigins ve AllowCredentials olarak güncellendi
app.UseCors(policy => policy
    .WithOrigins("http://localhost:4200")
    .AllowAnyMethod()
    .AllowAnyHeader()
    .AllowCredentials());

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<AppHub>("/apphub"); // 3. SignalR Hub adresi buraya eklendi

app.Run();

static SymmetricSecurityKey ReadJwtSigningKey(IConfiguration configuration)
{
    var encodedKey = configuration["Jwt:SigningKey"];
    if (string.IsNullOrWhiteSpace(encodedKey))
        throw new InvalidOperationException("Jwt:SigningKey is required.");

    byte[] keyBytes;
    try
    {
        keyBytes = Convert.FromBase64String(encodedKey);
    }
    catch (FormatException)
    {
        throw new InvalidOperationException("Jwt:SigningKey must be a Base64-encoded key.");
    }

    if (keyBytes.Length < 32)
        throw new InvalidOperationException("Jwt:SigningKey must decode to at least 32 bytes for HS256.");

    return new SymmetricSecurityKey(keyBytes);
}
