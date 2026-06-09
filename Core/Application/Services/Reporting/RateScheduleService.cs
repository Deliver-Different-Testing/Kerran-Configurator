using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Dtos.Reporting;
using DfrntDriveConfigurator.Core.Application.Services.Np;
using DfrntDriveConfigurator.Core.Domain;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace DfrntDriveConfigurator.Core.Application.Services.Reporting;

// Ported from clientcustomreportbuilder (Reports.Api). Generates a client's
// rate schedule by walking suburbs x rating-enabled job types and calling the
// legacy Despatch rating objects per cell:
//   UTL_stpJob_VariableModification (proc), UTL_fncJob_Rate (fn),
//   REP_fncJob_IsValid (fn), UTL_fncJob_DirectCanBeASAP (fn).
// [AdminManager] was granted EXECUTE on all four in dbmigrationsv2
// 20260610100000_GrantRateScheduleLegacyObjectsToAdminManager.sql.
//
// Client access is NP-scoped: a non-admin caller can only price a client whose
// tucClient.NpAgentId matches their scope. Out-of-scope (and missing) clients
// are reported identically as "not found" so existence isn't leaked.
public class RateScheduleService(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    RegionalRateService regionalService,
    InternationalRateService internationalService,
    INpScopeResolver scopeResolver)
{
    private static readonly HashSet<string> ExcludedSystemNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "UT", "B", "HDR", "HNDR", "MR"
    };

    private const int CbdSuburbId = 112;

    // TODO: Make configurable — load from tblSetting or AppConfig
    private const int DefaultProspectRateCodeId = 1;

    public async Task<RateScheduleResponse> GenerateAsync(RateScheduleRequest request, CancellationToken ct = default)
    {
        await using var db = await contextFactory.CreateDbContextAsync(ct);

        // NP-scope guard: a non-admin caller may only price clients linked to
        // their NpAgentId. Failure looks like "not found" (no existence leak).
        var scope = await scopeResolver.ResolveAsync();
        if (!scope.IsAdmin)
        {
            var inScope = scope.NpAgentId is int npId &&
                await db.TucClients.AsNoTracking()
                    .AnyAsync(c => c.UcclId == request.ClientId && c.NpAgentId == npId, ct);
            if (!inScope)
                throw new InvalidOperationException($"Client {request.ClientId} not found.");
        }

        var clientInfo = await GetClientInfoAsync(db, request.ClientId, ct);
        if (clientInfo == null)
            throw new InvalidOperationException($"Client {request.ClientId} not found.");

        int fromSuburbId = request.FromSuburbId > 0 ? request.FromSuburbId.Value : clientInfo.SuburbId;

        var fromSuburbName = await db.TucSuburbs
            .Where(s => s.UcsuId == fromSuburbId)
            .Select(s => s.UcsuName)
            .FirstOrDefaultAsync(ct) ?? "Unknown";

        decimal gstMultiplier = 1m;
        if (request.IncludeGst)
        {
            var gstRate = await db.TblSettings.Select(s => s.Gstrate).FirstOrDefaultAsync(ct);
            if (gstRate.HasValue && gstRate.Value > 0)
                gstMultiplier = 1m + gstRate.Value;
        }

        decimal markupMultiplier = 1m + ((decimal)request.Markup / 100m);
        // PPD is applied inside UTL_fncJob_Rate via the @IncludePpd argument
        // (the function divides by (1 - tucClient.PPDRate) when set). Do NOT
        // re-apply it here or it double-counts. Fuel is likewise the function's
        // job (@IncludeFuelSurcharge); only markup + GST are applied in C#.

        var ratingEnabledGroupIds = db.TucJobTypeGroupings
            .Where(g => g.RatingEnabled)
            .Select(g => g.GroupingId);

        var suburbQuery = db.TucSuburbs
            .Where(s => s.SiteId == clientInfo.SiteId && s.Priority == 1);
        if (request.SuburbIds.Count > 0)
            suburbQuery = suburbQuery.Where(s => request.SuburbIds.Contains(s.UcsuId));
        var suburbs = await suburbQuery
            .OrderBy(s => s.UcsuName)
            .Select(s => new { s.UcsuId, s.UcsuName, s.UcsuArea })
            .ToListAsync(ct);

        var jobTypeQuery = db.TucJobTypes
            .Where(jt => !ExcludedSystemNames.Contains(jt.SystemName)
                      && ratingEnabledGroupIds.Contains(jt.GroupingId));
        if (request.JobTypeIds.Count > 0)
            jobTypeQuery = jobTypeQuery.Where(jt => request.JobTypeIds.Contains(jt.UcjtId));
        var jobTypes = await jobTypeQuery
            .OrderBy(jt => jt.Minutes)
            .Select(jt => new { jt.UcjtId, jt.ShortName, jt.Minutes, jt.SystemName, jt.GroupingId })
            .ToListAsync(ct);

        if (!clientInfo.EconomyActive)
            jobTypes = jobTypes.Where(jt => !string.Equals(jt.SystemName, "EC", StringComparison.OrdinalIgnoreCase)).ToList();
        if (!clientInfo.EconomyRuns)
            jobTypes = jobTypes.Where(jt => !string.Equals(jt.SystemName, "ER", StringComparison.OrdinalIgnoreCase)).ToList();

        var items = new List<RateScheduleItem>();
        var today = DateTime.Today;

        foreach (var suburb in suburbs)
        {
            int baseSize = suburb.UcsuId == CbdSuburbId ? 1 : 2;
            bool areaOneCarJob = suburb.UcsuArea == 1 && baseSize == 2;

            foreach (var jobType in jobTypes)
            {
                var (modFromId, modToId, modSize, _, modPedal) =
                    await CallVariableModificationAsync(db, fromSuburbId, suburb.UcsuId, baseSize, jobType.UcjtId, false, ct);

                decimal rawRate = await CallJobRateAsync(
                    db, request.ClientId, modFromId, modToId, jobType.UcjtId,
                    modSize, modPedal, false, 0, today, request.IncludeFuelSurcharge, request.IncludePpd, ct);

                string availability = await CallIsValidAsync(
                    db, jobType.UcjtId, modFromId, modToId, request.ClientId, modSize, ct);

                decimal finalRate = Math.Round(rawRate * markupMultiplier * gstMultiplier, 2);

                items.Add(new RateScheduleItem
                {
                    ToSuburbId = suburb.UcsuId,
                    ToSuburbName = suburb.UcsuName,
                    JobTypeId = jobType.UcjtId,
                    SpeedName = jobType.ShortName,
                    Minutes = jobType.Minutes,
                    Rate = finalRate,
                    Availability = availability,
                    AreaOneCarJob = areaOneCarJob,
                    Pedal = modPedal,
                    GroupingId = jobType.GroupingId
                });

                if (string.Equals(availability, "Unavailable", StringComparison.OrdinalIgnoreCase))
                {
                    bool canBeAsap = await CallDirectCanBeAsapAsync(
                        db, jobType.UcjtId, modFromId, modToId, request.ClientId, modSize, ct);

                    if (canBeAsap)
                    {
                        items.Add(new RateScheduleItem
                        {
                            ToSuburbId = suburb.UcsuId,
                            ToSuburbName = suburb.UcsuName,
                            JobTypeId = jobType.UcjtId,
                            SpeedName = "Direct",
                            Minutes = jobType.Minutes,
                            Rate = finalRate,
                            Availability = "Available",
                            AreaOneCarJob = areaOneCarJob,
                            Pedal = modPedal,
                            GroupingId = jobType.GroupingId
                        });
                    }
                }
            }
        }

        var regionalItems = await regionalService.GenerateAsync(
            request.ClientId, null, request.IncludeGst, request.IncludeFuelSurcharge, request.Markup, ct);

        var internationalItems = await internationalService.GenerateAsync(
            request.ClientId, request.IncludeGst, request.IncludeFuelSurcharge, request.Markup, ct);

        return new RateScheduleResponse
        {
            ClientName = clientInfo.ClientName,
            FromSuburbName = fromSuburbName,
            PreparedFor = request.PreparedFor ?? clientInfo.ClientName,
            StandardRate = clientInfo.StandardRateAmount * markupMultiplier * gstMultiplier,
            VanRate = clientInfo.VanRateAmount * markupMultiplier * gstMultiplier,
            StartingExcessWeight = clientInfo.StartingWeightExcess,
            Items = items,
            RegionalItems = regionalItems,
            InternationalItems = internationalItems,
            IsProspect = false
        };
    }

    public async Task<RateScheduleResponse> GenerateProspectAsync(ProspectRateRequest request, CancellationToken ct = default)
    {
        await using var db = await contextFactory.CreateDbContextAsync(ct);

        int rateCodeId = request.BaseRateCodeId ?? DefaultProspectRateCodeId;
        decimal baseRateAmount = 0m;

        await db.Database.OpenConnectionAsync(ct);
        try
        {
            using var cmd = db.Database.GetDbConnection().CreateCommand();
            cmd.CommandText = "SELECT ISNULL(UcrcAmount, 0) FROM tucRateCode WHERE UcrcID = @RateCodeID";
            cmd.Parameters.Add(new SqlParameter("@RateCodeID", rateCodeId));
            var result = await cmd.ExecuteScalarAsync(ct);
            baseRateAmount = result != null && result != DBNull.Value ? Convert.ToDecimal(result) : 0m;
        }
        finally
        {
            await db.Database.CloseConnectionAsync();
        }

        decimal gstMultiplier = 1m;
        if (request.IncludeGst)
        {
            var gstRate = await db.TblSettings.Select(s => s.Gstrate).FirstOrDefaultAsync(ct);
            if (gstRate.HasValue && gstRate.Value > 0)
                gstMultiplier = 1m + gstRate.Value;
        }
        decimal markupMultiplier = 1m + ((decimal)request.Markup / 100m);

        var locationNames = request.Locations.Select(l => l.Name).ToList();
        var matchedSuburbs = await db.TucSuburbs
            .Where(s => locationNames.Contains(s.UcsuName))
            .Select(s => new { s.UcsuId, s.UcsuName, s.UcsuArea })
            .ToListAsync(ct);

        int fromSuburbId = matchedSuburbs.FirstOrDefault()?.UcsuId ?? 0;
        string fromSuburbName = matchedSuburbs.FirstOrDefault()?.UcsuName ?? request.Locations.FirstOrDefault()?.Name ?? "Unknown";

        var ratingEnabledGroupIdsProspect = db.TucJobTypeGroupings
            .Where(g => g.RatingEnabled)
            .Select(g => g.GroupingId);

        var jobTypes = await db.TucJobTypes
            .Where(jt => !ExcludedSystemNames.Contains(jt.SystemName)
                      && ratingEnabledGroupIdsProspect.Contains(jt.GroupingId))
            .OrderBy(jt => jt.Minutes)
            .Select(jt => new { jt.UcjtId, jt.ShortName, jt.Minutes, jt.SystemName, jt.GroupingId })
            .ToListAsync(ct);

        var items = new List<RateScheduleItem>();
        var today = DateTime.Today;
        int prospectClientId = 0;

        foreach (var suburb in matchedSuburbs.Skip(1))
        {
            int baseSize = suburb.UcsuId == CbdSuburbId ? 1 : 2;
            bool areaOneCarJob = suburb.UcsuArea == 1 && baseSize == 2;

            foreach (var jobType in jobTypes)
            {
                var (modFromId, modToId, modSize, _, modPedal) =
                    await CallVariableModificationAsync(db, fromSuburbId, suburb.UcsuId, baseSize, jobType.UcjtId, false, ct);

                decimal rawRate = await CallJobRateAsync(
                    db, prospectClientId, modFromId, modToId, jobType.UcjtId,
                    modSize, modPedal, false, 0, today, request.IncludeFuelSurcharge, false, ct);

                string availability = await CallIsValidAsync(
                    db, jobType.UcjtId, modFromId, modToId, prospectClientId, modSize, ct);

                items.Add(new RateScheduleItem
                {
                    ToSuburbId = suburb.UcsuId,
                    ToSuburbName = suburb.UcsuName,
                    JobTypeId = jobType.UcjtId,
                    SpeedName = jobType.ShortName,
                    Minutes = jobType.Minutes,
                    Rate = Math.Round(rawRate * markupMultiplier * gstMultiplier, 2),
                    Availability = availability,
                    AreaOneCarJob = areaOneCarJob,
                    Pedal = modPedal,
                    GroupingId = jobType.GroupingId
                });
            }
        }

        var regionalItems = await regionalService.GenerateAsync(
            prospectClientId, null, request.IncludeGst, request.IncludeFuelSurcharge, request.Markup, ct);

        var internationalItems = await internationalService.GenerateAsync(
            prospectClientId, request.IncludeGst, request.IncludeFuelSurcharge, request.Markup, ct);

        return new RateScheduleResponse
        {
            ClientName = request.CompanyName ?? "Prospect",
            FromSuburbName = fromSuburbName,
            PreparedFor = request.ContactName ?? request.CompanyName ?? "Prospect",
            StandardRate = baseRateAmount * markupMultiplier * gstMultiplier,
            VanRate = 0m,
            StartingExcessWeight = 0,
            Items = items,
            RegionalItems = regionalItems,
            InternationalItems = internationalItems,
            IsProspect = true,
            ProspectCompanyName = request.CompanyName
        };
    }

    private static async Task<ClientRateInfo?> GetClientInfoAsync(DynamicDespatchDbContext db, int clientId, CancellationToken ct)
    {
        const string sql = @"
            SELECT
                c.UcclID           AS ClientId,
                c.SiteID           AS SiteId,
                c.UcclName         AS ClientName,
                ISNULL(c.UcclSuburbID, 0) AS SuburbId,
                ISNULL(s.UcsuName, '')    AS SuburbName,
                c.UcclRate         AS StandardRateCodeId,
                ISNULL(rc1.UcrcAmount, 0)     AS StandardRateAmount,
                c.RateVan          AS VanRateCodeId,
                ISNULL(rc2.UcrcAmount, 0)     AS VanRateAmount,
                c.StartingWeightExcess,
                c.PPDRate          AS PpdRate,
                c.EconomyActive,
                c.EconomyRuns
            FROM tucClient c
            LEFT JOIN tucSuburb s    ON s.UcsuID = c.UcclSuburbID
            LEFT JOIN tucRateCode rc1 ON rc1.UcrcID = c.UcclRate
            LEFT JOIN tucRateCode rc2 ON rc2.UcrcID = c.RateVan
            WHERE c.UcclID = @clientId";

        var connection = db.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open) await db.Database.OpenConnectionAsync(ct);
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.Parameters.Add(new SqlParameter("@clientId", clientId));

        using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;

        return new ClientRateInfo
        {
            ClientId = reader.GetInt32(reader.GetOrdinal("ClientId")),
            SiteId = reader.GetInt32(reader.GetOrdinal("SiteId")),
            ClientName = reader.GetString(reader.GetOrdinal("ClientName")),
            SuburbId = reader.GetInt32(reader.GetOrdinal("SuburbId")),
            SuburbName = reader.GetString(reader.GetOrdinal("SuburbName")),
            StandardRateCodeId = reader.IsDBNull(reader.GetOrdinal("StandardRateCodeId")) ? null : reader.GetInt32(reader.GetOrdinal("StandardRateCodeId")),
            StandardRateAmount = reader.GetDecimal(reader.GetOrdinal("StandardRateAmount")),
            VanRateCodeId = reader.IsDBNull(reader.GetOrdinal("VanRateCodeId")) ? null : reader.GetInt32(reader.GetOrdinal("VanRateCodeId")),
            VanRateAmount = reader.GetDecimal(reader.GetOrdinal("VanRateAmount")),
            StartingWeightExcess = reader.GetInt32(reader.GetOrdinal("StartingWeightExcess")),
            PpdRate = reader.IsDBNull(reader.GetOrdinal("PpdRate")) ? null : reader.GetDecimal(reader.GetOrdinal("PpdRate")),
            EconomyActive = reader.GetBoolean(reader.GetOrdinal("EconomyActive")),
            EconomyRuns = reader.GetBoolean(reader.GetOrdinal("EconomyRuns"))
        };
    }

    private static async Task<(int fromId, int toId, int size, int speed, bool pedal)> CallVariableModificationAsync(
        DynamicDespatchDbContext db, int fromSuburbId, int toSuburbId, int size, int speed, bool pedal, CancellationToken ct)
    {
        var pFrom  = new SqlParameter("@FromSuburbID", fromSuburbId) { Direction = ParameterDirection.InputOutput };
        var pTo    = new SqlParameter("@ToSuburbID",   toSuburbId)   { Direction = ParameterDirection.InputOutput };
        var pSize  = new SqlParameter("@Size",         size)         { Direction = ParameterDirection.InputOutput };
        var pSpeed = new SqlParameter("@Speed",        speed)        { Direction = ParameterDirection.InputOutput };
        var pPedal = new SqlParameter("@Pedal",        pedal)        { SqlDbType = SqlDbType.Bit, Direction = ParameterDirection.InputOutput };

        await db.Database.ExecuteSqlRawAsync(
            "EXEC UTL_stpJob_VariableModification @FromSuburbID OUTPUT, @ToSuburbID OUTPUT, @Size OUTPUT, @Speed OUTPUT, @Pedal OUTPUT",
            new[] { pFrom, pTo, pSize, pSpeed, pPedal }, ct);

        return ((int)pFrom.Value, (int)pTo.Value, (int)pSize.Value, (int)pSpeed.Value, (bool)pPedal.Value);
    }

    // Calls the legacy rating function. Current signature (dbmigrationsv2
    // 20260423144029_ScheduleRerate) is 16 args, positional:
    //   1 ClientID, 2 FromSuburbID, 3 ToSuburbID, 4 Speed(=jobTypeId), 5 Size,
    //   6 Pedal, 7 Return, 8 Weight, 9 Date, 10 Booked(NULL), 11 IncludeFuelSurcharge,
    //   12 OurRef(NULL), 13 ClientRefA(NULL), 14 ClientRefB(NULL), 15 Quantity(1),
    //   16 IncludePpd.
    // Scalar UDFs reject a short arg list even though @IncludePpd has a default,
    // so all 16 must be supplied. The prototype targeted the older 15-arg version.
    private static async Task<decimal> CallJobRateAsync(
        DynamicDespatchDbContext db, int clientId, int fromSuburbId, int toSuburbId, int jobTypeId,
        int size, bool pedal, bool isReturn, int weight, DateTime date,
        bool includeFuelSurcharge, bool includePpd, CancellationToken ct)
    {
        const string sql = @"SELECT dbo.UTL_fncJob_Rate(
            @ClientID, @FromSuburbID, @ToSuburbID, @JobTypeID,
            @Size, @Pedal, @Return, @Weight, @Date,
            NULL, @IncludeFuelSurcharge, NULL, NULL, NULL, 1, @IncludePpd) AS Rate";

        var connection = db.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open) await db.Database.OpenConnectionAsync(ct);
        using var cmd = connection.CreateCommand();
        cmd.CommandText = sql;
        cmd.Parameters.Add(new SqlParameter("@ClientID",            clientId));
        cmd.Parameters.Add(new SqlParameter("@FromSuburbID",        fromSuburbId));
        cmd.Parameters.Add(new SqlParameter("@ToSuburbID",          toSuburbId));
        cmd.Parameters.Add(new SqlParameter("@JobTypeID",           jobTypeId));
        cmd.Parameters.Add(new SqlParameter("@Size",                size));
        cmd.Parameters.Add(new SqlParameter("@Pedal",               pedal));
        cmd.Parameters.Add(new SqlParameter("@Return",              isReturn));
        cmd.Parameters.Add(new SqlParameter("@Weight",              weight));
        cmd.Parameters.Add(new SqlParameter("@Date",                date));
        cmd.Parameters.Add(new SqlParameter("@IncludeFuelSurcharge", includeFuelSurcharge));
        cmd.Parameters.Add(new SqlParameter("@IncludePpd",          includePpd));

        var result = await cmd.ExecuteScalarAsync(ct);
        return result == null || result == DBNull.Value ? 0m : Convert.ToDecimal(result);
    }

    private static async Task<string> CallIsValidAsync(
        DynamicDespatchDbContext db, int jobTypeId, int fromSuburbId, int toSuburbId, int clientId, int size, CancellationToken ct)
    {
        const string sql = "SELECT dbo.REP_fncJob_IsValid(@JobTypeID, @FromSuburbID, @ToSuburbID, @ClientID, @Size, 1) AS Availability";

        var connection = db.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open) await db.Database.OpenConnectionAsync(ct);
        using var cmd = connection.CreateCommand();
        cmd.CommandText = sql;
        cmd.Parameters.Add(new SqlParameter("@JobTypeID",    jobTypeId));
        cmd.Parameters.Add(new SqlParameter("@FromSuburbID", fromSuburbId));
        cmd.Parameters.Add(new SqlParameter("@ToSuburbID",   toSuburbId));
        cmd.Parameters.Add(new SqlParameter("@ClientID",     clientId));
        cmd.Parameters.Add(new SqlParameter("@Size",         size));

        var result = await cmd.ExecuteScalarAsync(ct);
        return result?.ToString() ?? "Unknown";
    }

    private static async Task<bool> CallDirectCanBeAsapAsync(
        DynamicDespatchDbContext db, int jobTypeId, int fromSuburbId, int toSuburbId, int clientId, int size, CancellationToken ct)
    {
        const string sql = "SELECT dbo.UTL_fncJob_DirectCanBeASAP(@JobTypeID, @FromSuburbID, @ToSuburbID, @ClientID, @Size, 1) AS CanBeAsap";

        var connection = db.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open) await db.Database.OpenConnectionAsync(ct);
        using var cmd = connection.CreateCommand();
        cmd.CommandText = sql;
        cmd.Parameters.Add(new SqlParameter("@JobTypeID",    jobTypeId));
        cmd.Parameters.Add(new SqlParameter("@FromSuburbID", fromSuburbId));
        cmd.Parameters.Add(new SqlParameter("@ToSuburbID",   toSuburbId));
        cmd.Parameters.Add(new SqlParameter("@ClientID",     clientId));
        cmd.Parameters.Add(new SqlParameter("@Size",         size));

        var result = await cmd.ExecuteScalarAsync(ct);
        return result != null && result != DBNull.Value && Convert.ToBoolean(result);
    }
}
