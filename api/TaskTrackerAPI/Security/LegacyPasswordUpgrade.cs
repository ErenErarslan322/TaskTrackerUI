using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TaskTrackerAPI.Data;
using TaskTrackerAPI.Models;

namespace TaskTrackerAPI.Security;

public class LegacyPasswordUpgrade(AppDbContext db, IPasswordHasher<User> hasher)
{
    public async Task<int> UpgradeAsync()
    {
        var updated = 0;
        while (true)
        {
            var accounts = await db.Users.AsNoTracking()
                .Where(account => !account.PasswordIsHashed)
                .OrderBy(account => account.Id)
                .Take(64)
                .ToListAsync();
            if (accounts.Count == 0) return updated;

            foreach (var account in accounts)
            {
                var hash = hasher.HashPassword(account, account.PasswordHash);
                updated += await db.Users
                    .Where(item => item.Id == account.Id && !item.PasswordIsHashed)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(item => item.PasswordHash, hash)
                        .SetProperty(item => item.PasswordIsHashed, true));
            }
        }
    }
}
