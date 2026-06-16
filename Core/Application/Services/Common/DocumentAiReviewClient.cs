using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Serilog;

namespace DfrntDriveConfigurator.Core.Application.Services.Common;

// Shared, entity-agnostic AI document review (P3). Extracted from
// AgentDocumentAiReviewer so courier + applicant + agent documents all share one
// Anthropic call + parse. Pure: takes the document bytes + content type + the
// (optional) tenant criteria and returns an advisory recommendation. No DB, no
// S3 — callers load the bytes and persist the result onto their own entity.
//
// Key-optional: returns null (no-op) when ANTHROPIC_API_KEY is unset, the content
// type isn't a reviewable PDF/image, or the call fails — so uploads never break.
// Uses the documented Messages API wire format over HttpClient (anthropic-version
// 2023-06-01), same as the original agent reviewer.

public sealed record AiReviewResult(string Model, string? Decision, DateOnly? Expiry, string? Rationale);

public interface IDocumentAiReviewClient
{
    Task<AiReviewResult?> ReviewAsync(byte[] bytes, string contentType, string docTypeName, string? reviewCriteria, CancellationToken ct = default);
}

public class DocumentAiReviewClient(IHttpClientFactory httpClientFactory) : IDocumentAiReviewClient
{
    private const string DefaultModel = "claude-opus-4-8";
    private const string AnthropicVersion = "2023-06-01";
    private const string MessagesEndpoint = "https://api.anthropic.com/v1/messages";

    public async Task<AiReviewResult?> ReviewAsync(byte[] bytes, string contentType, string docTypeName, string? reviewCriteria, CancellationToken ct = default)
    {
        var apiKey = Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY");
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            Log.Information("AI review skipped — ANTHROPIC_API_KEY not configured.");
            return null;
        }

        var block = ResolveMediaBlock(contentType);
        if (block is null)
        {
            Log.Information("AI review skipped — content type {ContentType} is not a reviewable image/PDF.", contentType);
            return null;
        }

        if (bytes is null || bytes.Length == 0) return null;
        var base64 = Convert.ToBase64String(bytes);
        var model = Environment.GetEnvironmentVariable("ANTHROPIC_MODEL") ?? DefaultModel;
        var name = string.IsNullOrWhiteSpace(docTypeName) ? "document" : docTypeName;
        var criteria = !string.IsNullOrWhiteSpace(reviewCriteria) ? reviewCriteria : DefaultCriteria(name);

        JObject? input;
        try
        {
            input = await CallClaudeAsync(apiKey, model, block.Value.BlockType, block.Value.MediaType, base64, name, criteria, ct);
        }
        catch (Exception ex)
        {
            Log.Warning(ex, "AI review call failed.");
            return null;
        }
        if (input is null) return null;

        return new AiReviewResult(
            model,
            NormaliseDecision((string?)input["decision"]),
            ParseDate((string?)input["expiryDate"]),
            JoinReasons(input["reasons"]));
    }

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
                "uploaded document against the tenant's criteria and produce an ADVISORY recommendation " +
                "only — a human approves the final decision. Extract the document's expiry date if present. " +
                "Be conservative: if the document is illegible, the wrong type, or you are unsure, recommend " +
                "needs_review rather than accept.",
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

        var parsed = JObject.Parse(json);

        // Per-review token usage + an Opus-4.8-rate cost estimate (input $5/M, output $25/M).
        if (parsed["usage"] is JObject usage)
        {
            var inTok = (int?)usage["input_tokens"] ?? 0;
            var outTok = (int?)usage["output_tokens"] ?? 0;
            var estCost = inTok / 1_000_000m * 5m + outTok / 1_000_000m * 25m;
            Log.Information("AI review usage (model {Model}): input={In} output={Out} est_cost=${Cost:F4}", model, inTok, outTok, estCost);
        }

        if (parsed["content"] is JArray content)
        {
            foreach (var blk in content)
            {
                if ((string?)blk["type"] == "tool_use" && (string?)blk["name"] == "record_review")
                    return blk["input"] as JObject;
            }
        }
        Log.Warning("Anthropic AI review response had no record_review tool_use block.");
        return null;
    }

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

    private static string DefaultCriteria(string docTypeName) =>
        $"- The document must genuinely be a {docTypeName} (not a different document type).\n" +
        "- It must be legible and complete (not a blank template, screenshot of an error, or cropped page).\n" +
        "- If it carries an expiry/validity date, it must not be in the past.\n" +
        "- If anything is unclear or the document looks invalid, recommend needs_review.";

    private static string? NormaliseDecision(string? decision) => decision?.Trim().ToLowerInvariant() switch
    {
        "accept" => "accept",
        "reject" => "reject",
        "needs_review" => "needs_review",
        _ => "needs_review",
    };

    private static DateOnly? ParseDate(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : DateOnly.TryParse(value, out var d) ? d : null;

    private static string? JoinReasons(JToken? reasons)
    {
        if (reasons is not JArray arr || arr.Count == 0) return null;
        return Truncate(string.Join("; ", arr.Values<string>()), 2000);
    }

    private static string Truncate(string s, int max) =>
        string.IsNullOrEmpty(s) || s.Length <= max ? s : s.Substring(0, max);
}
