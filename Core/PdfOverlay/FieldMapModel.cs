using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace DfrntDriveConfigurator.Core.PdfOverlay;

// Vendored from the standalone PDF Overlay Tool (PdfOverlay.Core). The pure field-map model:
// the placement instructions for stamping data onto a customer PDF. Wire format = field-map.json
// (camelCase, string enums). See Core/PdfOverlay/README note in PdfOverlayServiceRegistration.

/// <summary>
/// The kind of value a <see cref="FieldMapping"/> stamps onto the template.
/// Serialised as camelCase strings (e.g. <c>"multiline"</c>) to match field-map.json.
/// </summary>
public enum FieldType
{
    /// <summary>Single line of text.</summary>
    Text,

    /// <summary>Word-wrapped text clipped to the field's width and height.</summary>
    Multiline,

    /// <summary>A date/time value formatted with <see cref="FieldMapping.Format"/>.</summary>
    Date,

    /// <summary>An image drawn into the field rectangle. The renderer accepts image bytes only.</summary>
    Image,

    /// <summary>Reserved for a future barcode/QR field type. Not yet rendered.</summary>
    Barcode
}

/// <summary>Horizontal alignment of stamped text within its field rectangle.</summary>
public enum TextAlignment
{
    Left,
    Center,
    Right
}

/// <summary>
/// One placement instruction: where on the template to stamp a value, and how to render it.
/// Mirrors a single entry of the <c>fields[]</c> array in field-map.json.
/// </summary>
/// <remarks>
/// Coordinates (<see cref="X"/>, <see cref="Y"/>, <see cref="W"/>, <see cref="H"/>) are in PDF
/// points (1/72") using a <b>top-left</b> origin — the natural origin for the admin UI. The renderer
/// converts to PDF's bottom-left space internally.
/// </remarks>
public sealed class FieldMapping
{
    /// <summary>Stable identifier. Also the key the renderer looks up in the data dictionary.</summary>
    public required string Id { get; init; }

    /// <summary>Human-friendly label shown in the admin UI. Not rendered.</summary>
    public string? Label { get; init; }

    /// <summary>1-based page number the field is placed on.</summary>
    public int Page { get; init; } = 1;

    /// <summary>Left edge, PDF points from the page's top-left.</summary>
    public double X { get; init; }

    /// <summary>Top edge, PDF points from the page's top-left.</summary>
    public double Y { get; init; }

    /// <summary>Width in PDF points.</summary>
    public double W { get; init; }

    /// <summary>Height in PDF points.</summary>
    public double H { get; init; }

    /// <summary>How the bound value is rendered.</summary>
    public FieldType Type { get; init; } = FieldType.Text;

    /// <summary>
    /// Source path the consumer/service used to resolve the value (e.g. <c>shipment.podName</c>).
    /// Informational only — the renderer keys off <see cref="Id"/>, not this.
    /// </summary>
    public string? DataBinding { get; init; }

    /// <summary>Font size in points for text-like fields.</summary>
    public double FontSize { get; init; } = 10;

    /// <summary>Font family name. Must be resolvable by the registered font resolver.</summary>
    public string FontFamily { get; init; } = "Helvetica";

    /// <summary>Horizontal text alignment within the field rectangle.</summary>
    public TextAlignment Alignment { get; init; } = TextAlignment.Left;

    /// <summary>
    /// Format string for <see cref="FieldType.Date"/> values (e.g. <c>HH:mm</c>, <c>yyyy-MM-dd</c>).
    /// Applied with the invariant culture.
    /// </summary>
    public string? Format { get; init; }

    /// <summary>
    /// Optional name of an AcroForm field on the template. When the template carries a matching
    /// form field, the renderer stamps the value at that field's own rectangle (authoritative
    /// position — no coordinate drift) instead of at <see cref="X"/>/<see cref="Y"/>. Defaults to
    /// <see cref="Id"/> when not set.
    /// </summary>
    public string? AcroField { get; init; }
}

/// <summary>
/// The full set of placement instructions for one template version.
/// Deserialised from field-map.json.
/// </summary>
public sealed class FieldMap
{
    /// <summary>The fields to stamp, in document order.</summary>
    public IReadOnlyList<FieldMapping> Fields { get; init; } = [];

    /// <summary>
    /// Validates the map for authoring: every field must carry a non-blank <see cref="FieldMapping.Id"/>
    /// (the renderer's data key) and ids must be unique. Returns one message per problem; an empty list
    /// means the map is valid. Pure — callers decide how to surface failures (the controller returns 400).
    /// </summary>
    public IReadOnlyList<string> Validate()
    {
        var errors = new List<string>();
        var seen = new HashSet<string>(StringComparer.Ordinal);

        for (var i = 0; i < Fields.Count; i++)
        {
            var id = Fields[i].Id;
            if (string.IsNullOrWhiteSpace(id))
            {
                errors.Add($"Field at index {i} has a blank id.");
                continue;
            }

            if (!seen.Add(id))
            {
                errors.Add($"Duplicate field id '{id}'.");
            }
        }

        return errors;
    }
}

/// <summary>
/// (De)serializes <see cref="FieldMap"/> to/from the field-map.json wire format used by S3 and the
/// controller. camelCase property names; enums as camelCase strings (e.g. <c>"multiline"</c>).
/// </summary>
public static class FieldMapJson
{
    /// <summary>Shared options defining the field-map.json contract.</summary>
    public static readonly JsonSerializerOptions Options = CreateOptions();

    private static JsonSerializerOptions CreateOptions()
    {
        var options = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true,
            WriteIndented = true
        };
        options.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
        return options;
    }

    /// <summary>Parses field-map.json into a <see cref="FieldMap"/>.</summary>
    public static FieldMap Deserialize(string json) =>
        JsonSerializer.Deserialize<FieldMap>(json, Options)
        ?? throw new JsonException("field-map.json deserialised to null.");

    /// <summary>Serializes a <see cref="FieldMap"/> back to the field-map.json wire format.</summary>
    public static string Serialize(FieldMap map) =>
        JsonSerializer.Serialize(map, Options);
}
