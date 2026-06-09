using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Reporting;
using DfrntDriveConfigurator.Core.Domain;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services.Reporting;

// STATUS: PLACEHOLDER — ported verbatim from clientcustomreportbuilder.
// International pricing source was never identified; every cell returns
// QuoteRequired. Destination list is hardcoded. Reads only TblSettings.Gstrate.
public class InternationalRateService(IDbContextFactory<DynamicDespatchDbContext> contextFactory)
{
    private static readonly (string Label, decimal MinKg, decimal MaxKg)[] WeightTiers =
    [
        ("0-5kg",   0m,  5m),
        ("5-15kg",  5m,  15m),
        ("15-25kg", 15m, 25m),
        ("25kg+",   25m, 999m),
    ];

    private static readonly string[] InternationalSpeeds =
    [
        "International Express",
        "International Standard",
        "International Economy",
    ];

    // TODO: Load from database or configuration
    private static readonly (string Code, string City, string Country, string Region)[] Destinations =
    [
        ("syd", "Sydney",        "Australia",  "australia"),
        ("mel", "Melbourne",     "Australia",  "australia"),
        ("bne", "Brisbane",      "Australia",  "australia"),
        ("per", "Perth",         "Australia",  "australia"),
        ("sin", "Singapore",     "Singapore",  "asia-pacific"),
        ("hkg", "Hong Kong",     "Hong Kong",  "asia-pacific"),
        ("tyo", "Tokyo",         "Japan",      "asia-pacific"),
        ("bkk", "Bangkok",       "Thailand",   "asia-pacific"),
        ("lax", "Los Angeles",   "USA",        "americas"),
        ("sfo", "San Francisco", "USA",        "americas"),
        ("lhr", "London",        "UK",         "europe"),
        ("fra", "Frankfurt",     "Germany",    "europe"),
    ];

    public async Task<List<InternationalRateItem>> GenerateAsync(
        int clientId, bool includeGst, bool includeFuelSurcharge,
        double markup, CancellationToken ct = default)
    {
        await using var db = await contextFactory.CreateDbContextAsync(ct);

        decimal gstMultiplier = 1m;
        if (includeGst)
        {
            var gstRate = await db.TblSettings.Select(s => s.Gstrate).FirstOrDefaultAsync(ct);
            if (gstRate.HasValue && gstRate.Value > 0)
                gstMultiplier = 1m + gstRate.Value;
        }

        decimal markupMultiplier = 1m + ((decimal)markup / 100m);
        decimal fuelMultiplier = includeFuelSurcharge ? 1.08m : 1m;

        var items = new List<InternationalRateItem>();

        foreach (var dest in Destinations)
        {
            foreach (var speed in InternationalSpeeds)
            {
                foreach (var (tierLabel, minKg, maxKg) in WeightTiers)
                {
                    // TODO: Wire to actual rate source
                    var (baseRate, availability, requiresQuote) = GetInternationalRate();

                    items.Add(new InternationalRateItem
                    {
                        DestinationCode = dest.Code,
                        City = dest.City,
                        Country = dest.Country,
                        Region = dest.Region,
                        SpeedName = speed,
                        WeightTier = tierLabel,
                        WeightMinKg = minKg,
                        WeightMaxKg = maxKg,
                        Rate = Math.Round(baseRate * markupMultiplier * gstMultiplier * fuelMultiplier, 2),
                        Availability = availability,
                        RequiresQuote = requiresQuote,
                    });
                }
            }
        }

        return items;
    }

    // TODO: Wire to actual rate source — tblInternationalRate, forwarder API, or rate card
    private static (decimal Rate, string Availability, bool RequiresQuote) GetInternationalRate()
        => (0m, "QuoteRequired", true);
}
