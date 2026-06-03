using System;
using System.Security.Cryptography;
using System.Text;

namespace DfrntDriveConfigurator.Core.Application.Utilities;

public sealed class SaltHashed
{
    public string Salt { get; set; }
    public string Hashed { get; set; }
}

// Courier mobile-login password hashing.
//
// SOURCE OF TRUTH: marsapi `AuthenticateController.HashPassword` (the mobile
// app's login validator). It hardcodes this exact scheme and IGNORES the
// User.IsLegacyHash flag, so any courier credential we write MUST be produced
// by an identical function or the courier cannot sign in. AdminManager's
// CourierService uses the same algorithm. Do NOT swap this for
// Hub.Shared.PasswordHelper (that uses a different, base64-salt variant for
// the Hub/contact login path).
//
// If marsapi's hashing ever changes, this MUST change in lockstep — there is
// no negotiated contract, only byte-for-byte agreement.
public static class CourierPasswordHasher
{
    public static SaltHashed SaltHashNewPassword(string password)
    {
        // Matches marsapi: a random 5-digit numeric salt. The salt format is
        // irrelevant to validation (the validator re-hashes with the stored
        // salt); we keep it numeric purely for parity with existing rows.
        var random = new Random();
        var salt = random.Next(10000, 99999);
        var salted = salt.ToString();
        return new SaltHashed
        {
            Salt = salted,
            Hashed = HashPassword(password, salted),
        };
    }

    public static string HashPassword(string password, string salt)
    {
        var k2 = new Rfc2898DeriveBytes(
            password,
            Encoding.UTF8.GetBytes(salt + salt),
            10000,
            HashAlgorithmName.SHA256);

        var hashBytes = k2.GetBytes(64); // 64 bytes = 512 bits
        return BitConverter.ToString(hashBytes).Replace("-", "");
    }
}
