using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;

namespace TaskTrackerAPI.Hubs
{
    public class AppHub : Hub
    {
        // Hangi kullanıcının hangi durumla bağlı olduğunu canlı tutan sözlük (Username -> Status)
        private static readonly ConcurrentDictionary<string, string> UserStatuses = new();

        //  Kullanıcı giriş yaptığında veya bağlandığında tetiklenir
        public async Task RegisterUser(string username, string status = "Çevrimiçi")
        {
            if (string.IsNullOrWhiteSpace(username)) return;
            var key = username.Trim().ToLower();

            UserStatuses[key] = status;
            await Groups.AddToGroupAsync(Context.ConnectionId, key);

            // Herkese bu kullanıcının yeni durumunu ve güncel listeyi yayınla
            await Clients.All.SendAsync("UserStatusChanged", key, status);
            await Clients.Caller.SendAsync("ReceiveAllStatuses", UserStatuses);
        }

        //  Kullanıcı Ayarlar'dan durumunu değiştirdiğinde veya çıkış yaptığında tetiklenir
        public async Task ChangeUserStatus(string username, string newStatus)
        {
            if (string.IsNullOrWhiteSpace(username)) return;
            var key = username.Trim().ToLower();

            UserStatuses[key] = newStatus;
            await Clients.All.SendAsync("UserStatusChanged", key, newStatus);
        }

        //  Kullanıcılar arası anlık mesaj gönderme
        public async Task SendPrivateMessage(string sender, string receiver, string message)
        {
            var senderKey = sender.Trim().ToLower();
            var receiverKey = receiver.Trim().ToLower();

            var payload = new
            {
                sender = sender.Trim(),
                receiver = receiver.Trim(),
                text = message,
                id = Guid.NewGuid(),
                createdAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                timestamp = DateTime.Now.ToString("HH:mm")
            };

            // Mesajı hem alıcıya hem de gönderenin kendi ekranına anında ilet
            await Clients.Group(receiverKey).SendAsync("ReceiveMessage", payload);
            if (senderKey != receiverKey)
            {
                await Clients.Group(senderKey).SendAsync("ReceiveMessage", payload);
            }
        }
    }
}
