using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using TaskTrackerAPI.Data;
using TaskTrackerAPI.Models;

namespace TaskTrackerAPI.Controllers
{
    [Route("api/auth")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IPasswordHasher<User> _passwordHasher;
        private readonly SymmetricSecurityKey _jwtSigningKey;

        public AuthController(AppDbContext context, IPasswordHasher<User> passwordHasher, SymmetricSecurityKey jwtSigningKey)
        {
            _context = context;
            _passwordHasher = passwordHasher;
            _jwtSigningKey = jwtSigningKey;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] UserLoginDto request)
        {
            var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Username == request.Username && u.PasswordIsHashed);
            if (user is null)
                return InvalidCredentials();

            PasswordVerificationResult verification;
            try
            {
                verification = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
            }
            catch (FormatException)
            {
                return InvalidCredentials();
            }

            if (verification == PasswordVerificationResult.Failed)
                return InvalidCredentials();

            if (verification == PasswordVerificationResult.SuccessRehashNeeded)
            {
                var updatedHash = _passwordHasher.HashPassword(user, request.Password);
                await _context.Users.Where(account => account.Id == user.Id && account.PasswordHash == user.PasswordHash)
                    .ExecuteUpdateAsync(setters => setters.SetProperty(account => account.PasswordHash, updatedHash));
            }

            var tokenHandler = new JwtSecurityTokenHandler();
            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                    new Claim(ClaimTypes.Name, user.Username)
                }),
                Expires = DateTime.UtcNow.AddDays(7),
                SigningCredentials = new SigningCredentials(_jwtSigningKey, SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            return Ok(new
            {
                token = tokenHandler.WriteToken(token),
                username = user.Username,
                userId = user.Id
            });
        }
        private IActionResult InvalidCredentials() =>
            Unauthorized(new { Message = "Kullanıcı adı veya şifre hatalı." });

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] UserRegisterDto request)
        {
            if (await _context.Users.AnyAsync(u => u.Username == request.Username))
                return BadRequest(new { Message = "Bu kullanıcı adı zaten alınmış." });
            if(await _context.Users.AnyAsync(u => u.Email == request.Email))
                return BadRequest(new { Message = "Bu e-posta zaten kullanılmış." });

            var user = new User
            {
                Username = request.Username,
                Email = request.Email,
                PasswordIsHashed = true
            };
            user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Kayıt başarılı." });
        }

        [HttpGet("search")]
        public async Task<IActionResult> SearchUser([FromQuery] string email)
        {
            var user = await _context.Users
                .Where(u => u.Email.ToLower() == email.ToLower())
                .Select(u => new { u.Id, u.Username, u.Email })
                .FirstOrDefaultAsync();

            if (user == null)
                return NotFound(new { Message = "Bu e-posta adresine sahip kayıtlı bir kullanıcı bulunamadı." });

            return Ok(user);
        }
    }

    public record UserLoginDto(string Username, string Password);
    public record UserRegisterDto(string Username, string Email, string Password);
}
