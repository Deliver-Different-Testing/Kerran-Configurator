using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Reporting;
using DfrntDriveConfigurator.Core.Domain;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services.Reporting;

// STATUS: PLACEHOLDER — ported verbatim from clientcustomreportbuilder. The
// actual inter-city rate source (SP / rate table) was never identified, so
// GetRegionalRateAsync returns (0, "Unavailable") for every cell. The city
// list is hardcoded NZ centres; revisit both when a real regional rate source
// is wired. Reads only TblSettings.Gstrate from the DB.
public class RegionalRateService(IDbContextFactory<DynamicDespatchDbContext> contextFactory)
{
    private static readonly (string Label, decimal MinKg, decimal MaxKg)[] WeightTiers =
    [
        ("0-5kg",   0m,  5m),
        ("5-15kg",  5m,  15m),
        ("15-25kg", 15m, 25m),
        ("25kg+",   25m, 999m),
    ];

    private static readonly string[] RegionalSpeeds =
    [
        "Regional Same Day",
        "Regional Overnight",
        "National Economy",
    ];

    // TODO: Load from database table (tblRegionalCity or similar)
    private static readonly (string Code, string Name)[] Cities =
    [
        ("akl", "Auckland"),
        ("ham", "Hamilton"),
        ("tau", "Tauranga"),
        ("rot", "Rotorua"),
        ("npl", "New Plymouth"),
        ("pmn", "Palmerston North"),
        ("wlg", "Wellington"),
        ("nsn", "Nelson"),
        ("chc", "Christchurch"),
        ("dud", "Dunedin"),
        ("zqn", "Queenstown"),
    ];

    public async Task<List<RegionalRateItem>> GenerateAsync(
        int clientId, string? fromCityCode, bool includeGst,
        bool includeFuelSurcharge, double markup, CancellationToken ct = default)
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

        var items = new List<RegionalRateItem>();
        var originCities = string.IsNullOrEmpty(fromCityCode)
            ? Cities
            : Cities.Where(c => c.Code.Equals(fromCityCode, StringComparison.OrdinalIgnoreCase)).ToArray();

        foreach (var from in originCities)
        {
            foreach (var to in Cities)
            {
                if (from.Code == to.Code) continue;
                foreach (var speed in RegionalSpeeds)
                {
                    foreach (var (tierLabel, minKg, maxKg) in WeightTiers)
                    {
                        // TODO: Replace with real SP/table call
                        var (baseRate, availability) = GetRegionalRate();

                        items.Add(new RegionalRateItem
                        {
                            FromCityCode = from.Code,
                            FromCityName = from.Name,
                            ToCityCode = to.Code,
                            ToCityName = to.Name,
                            SpeedName = speed,
                            WeightTier = tierLabel,
                            WeightMinKg = minKg,
                            WeightMaxKg = maxKg,
                            Rate = Math.Round(baseRate * markupMultiplier * gstMultiplier * fuelMultiplier, 2),
                            Availability = availability,
                        });
                    }
                }
            }
        }

        return items;
    }

    // TODO: Wire to actual data source — tblRegionalRate, WS_stpJobType_Rates, or tblFreightRate
    private static (decimal Rate, string Availability) GetRegionalRate() => (0m, "Unavailable");
}
