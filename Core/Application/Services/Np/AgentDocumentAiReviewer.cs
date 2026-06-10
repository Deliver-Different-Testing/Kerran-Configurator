using System;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.Core.Application.Services.Common;
using DfrntDriveConfigurator.Core.Domain;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Serilog;

namespace DfrntDriveConfigurator.Core.Application.Services.Np;

/// <summary>
/// Advisory AI review of an uploaded agent business document (Phase 3). Sends the
/// document to Claude and records an expiry-date extraction + accept/reject
/// SUGGESTION onto the tucAgentDocument row (the Ai* columns). It never changes
/// VerifyStatus — tenant staff still make the final call; this is a hint only.
///
/// Key-optional: with no ANTHROPIC_API_KEY in the environment it is a no-op, so
/// uploads keep working before the key is provisioned. Only PDFs and images are
/// sent (other types are skipped). All failures are swallowed + logged — an AI
/// problem must never fail the upload.
///
/// Uses the documented Messages API wire format over HttpClient (rather than the
/// C# SDK) because the SDK's content-block/tool-use union bindings could not be
/// verified at build time; the wire JSON is stable (anthropic-version 2023-06-01).
/// </summary>
public interface IAgentDocumentAiReviewer
{
    Task ReviewAsync(int agentDocumentId, CancellationToken ct = default);
}

public class AgentDocumentAiReviewer(
    IDbContextFactory<DynamicDespatchDbContext> contextFactory,
    IS3StorageService storage,
    IHttpClientFactory httpClientFactory) : BaseService(contextFactory), IAgentDocumentAiReviewer
{
    private const string DefaultModel = "claude-opus-4-8";
    private const string AnthropicVersion = "2023-06-01";
    private const string MessagesEndpoint = "https://api.anthropic.com/v1/messages";

    public async Task ReviewAsync(int agentDocumentId, CancellationToken ct = default)
    {
        var apiKey = Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY");
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            Log.Information("AI review skipped for agent document {Id} — ANTHROPIC_API_KEY not configured.", agentDocumentId);
            return;
        }

        var doc = await Context.TucAgentDocuments
            .Include(d => d.DocumentType)
            .FirstOrDefaultAsync(d => d.UcadId == agentDocumentId, ct);
        if (doc is null) return;

        var block = ResolveMediaBlock(doc.ContentType);
        if (block is null)
        {
            Log.Information("AI review skipped for agent document {Id} — content type {ContentType} is not a reviewable image/PDF.", agentDocumentId, doc.ContentType);
            return;
        }

        // Pull the bytes back from S3.
        string base64;
        var s3 = await storage.GetAsync(doc.S3Key, ct);
        if (s3 is null)
        {
            Log.Warning("AI review skipped for agent document {Id} — S3 object missing (key {Key}).", agentDocumentId, doc.S3Key);
            return;
        }
        await using (s3.Content)
        using (var ms = new MemoryStream())
        {
            await s3.Content.CopyToAsync(ms, ct);
            base64 = Convert.ToBase64String(ms.ToArray());
        }

        var model = Environment.GetEnvironmentVariable("ANTHROPIC_MODEL") ?? DefaultModel;
        var docTypeName = doc.DocumentType?.Name ?? "business document";
        var criteria = ResolveCriteria(doc.DocumentType?.Name);

        JObject? input;
        try
        {
            input = await CallClaudeAsync(apiKey, model, block.Value.BlockType, block.Value.MediaType, base64, docTypeName, criteria, ct);
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "AI review call failed for agent document {Id}.", agentDocumentId);
            return;
        }
        if (input is null) return;

        // Map the structured suggestion onto the row. Never touches VerifyStatus.
        doc.AiSuggestedDecision = NormaliseDecision((string?)input["decision"]);
        doc.AiSuggestedExpiry = ParseDate((string?)input["expiryDate"]);
        doc.AiRationale = JoinReasons(input["reasons"]);
        doc.AiModel = model;
        doc.AiReviewedDate = DateTime.UtcNow;
        doc.ModifiedDate = DateTime.UtcNow;

        try
        {
            await Context.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "Failed to persist AI review for agent document {Id}.", agentDocumentId);
        }
    }

    // ─── Claude call (documented Messages API wire format) ────────────────

    private async Task<JObject?> CallClaudeAsync(
        string apiKey, string model, string blockType, string mediaType,
        string base64, string docTypeName, string criteria, CancellationToken ct)
    {
        var body = new JObject
        {
            ["model"] = model,
            ["max_tokens"] = 1024,
            ["system"] =
                "You are a compliance reviewer for a courier-network platform. You assess a single " +
                "uploaded Network-Partner business document against the tenant's criteria and produce an " +
                "ADVISORY recommendation only — a human approves the final decision. Extract the document's " +
                "expiry date if present. Be conservative: if the document is illegible, the wrong type, or " +
                "you are unsure, recommend needs_review rather than accept.",
            ["messages"] = new JArray
            {
                new JObject
                {
                    ["role"] = "user",
                    ["content"] = new JArray
                    {
                        new JObject
                        {
                            ["type"] = blockType,    // "document" (PDF) or "image"
                            ["source"] = new JObject
                            {
                                ["type"] = "base64",
                                ["media_type"] = mediaType,
                                ["data"] = base64,
                            },
                        },
                        new JObject
                        {
                            ["type"] = "text",
                            ["text"] =
                                $"This document was uploaded as a \"{docTypeName}\". Review it against these criteria:\n{criteria}\n\n" +
                                "Then call record_review with your expiry-date extraction and accept/reject recommendation.",
                        },
                    },
                },
            },
            ["tools"] = new JArray
            {
                new JObject
                {
                    ["name"] = "record_review",
                    ["description"] = "Record the extracted expiry date and the advisory accept/reject recommendation.",
                    ["input_schema"] = new JObject
                    {
                        ["type"] = "object",
                        ["properties"] = new JObject
                        {
                            ["expiryDate"] = new JObject
                            {
                                ["type"] = new JArray { "string", "null" },
                                ["description"] = "The document's expiry date as ISO yyyy-MM-dd, or null if it has none / cannot be read.",
                            },
                            ["decision"] = new JObject
                            {
                                ["type"] = "string",
                                ["enum"] = new JArray { "accept", "reject", "needs_review" },
                            },
                            ["reasons"] = new JObject
                            {
                                ["type"] = "array",
                                ["items"] = new JObject { ["type"] = "string" },
                                ["description"] = "Short bullet reasons for the recommendation.",
                            },
                        },
                        ["required"] = new JArray { "decision", "reasons" },
                    },
                },
            },
            ["tool_choice"] = new JObject { ["type"] = "tool", ["name"] = "record_review" },
        };

        var client = httpClientFactory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, MessagesEndpoint)
        {
            Content = new StringContent(body.ToString(Formatting.None), Encoding.UTF8, "application/json"),
        };
        request.Headers.TryAddWithoutValidation("x-api-key", apiKey);
        request.Headers.TryAddWithoutValidation("anthropic-version", AnthropicVersion);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var response = await client.SendAsync(request, ct);
        var json = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
        {
            Log.Warning("Anthropic API returned {Status} for AI review: {Body}", (int)response.StatusCode, Truncate(json, 500));
            return null;
        }

        // Find the forced tool_use block and return its input object.
        var parsed = JObject.Parse(json);
        if (parsed["content"] is JArray content)
        {
            foreach (var blk in content)
            {
                if ((string?)blk["type"] == "tool_use" && (string?)blk["name"] == "record_review")
                {
                    return blk["input"] as JObject;
                }
            }
        }
        Log.Warning("Anthropic AI review response had no record_review tool_use block.");
        return null;
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    private static (string BlockType, string MediaType)? ResolveMediaBlock(string? contentType)
    {
        if (string.IsNullOrWhiteSpace(contentType)) return null;
        var ct = contentType.Trim().ToLowerInvariant();
        if (ct == "application/pdf") return ("document", "application/pdf");
        if (ct is "image/jpeg" or "image/jpg") return ("image", "image/jpeg");
        if (ct == "image/png") return ("image", "image/png");
        if (ct == "image/gif") return ("image", "image/gif");
        if (ct == "image/webp") return ("image", "image/webp");
        return null;
    }

    // Default per-doc-type criteria. Phase 3b adds an editable DocumentTypes.ReviewCriteria
    // column + admin UI; until then this generic-but-targeted prompt is used.
    private static string ResolveCriteria(string? docTypeName)
    {
        var name = string.IsNullOrWhiteSpace(docTypeName) ? "the required document" : docTypeName;
        return
            $"- The document must genuinely be a {name} (not a different document type).\n" +
            "- It must be legible and complete (not a blank template, screenshot of an error, or cropped page).\n" +
            "- If it carries an expiry/validity date, it must not be in the past.\n" +
            "- If anything is unclear or the document looks invalid, recommend needs_review.";
    }

    private static string? NormaliseDecision(string? decision) => decision?.Trim().ToLowerInvariant() switch
    {
        "accept" => "accept",
        "reject" => "reject",
        "needs_review" => "needs_review",
        _ => "needs_review",
    };

    private static DateOnly? ParseDate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return DateOnly.TryParse(value, out var d) ? d : (DateOnly?)null;
    }

    private static string? JoinReasons(JToken? reasons)
    {
        if (reasons is not JArray arr || arr.Count == 0) return null;
        var joined = string.Join("; ", arr.Values<string>());
        return Truncate(joined, 2000);
    }

    private static string Truncate(string s, int max) =>
        string.IsNullOrEmpty(s) || s.Length <= max ? s : s.Substring(0, max);
}
