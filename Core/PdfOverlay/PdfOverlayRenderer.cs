using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using PdfSharp.Drawing;
using PdfSharp.Drawing.Layout;
using PdfSharp.Pdf;
using PdfSharp.Pdf.IO;

namespace DfrntDriveConfigurator.Core.PdfOverlay;

// Vendored from PdfOverlay.Core — the pure renderer. No I/O, storage, or network access.

/// <summary>
/// Stamps data values onto a template PDF at the positions defined in a <see cref="FieldMap"/>.
/// Pure function of its inputs — no I/O, storage, or network access. The interface keeps the
/// underlying PDF library swappable.
/// </summary>
public interface IPdfOverlayRenderer
{
    /// <summary>
    /// Returns a new PDF with each field's value stamped onto <paramref name="templateBytes"/>.
    /// Image fields expect <c>byte[]</c> or <c>Stream</c> bytes (never a URL — callers resolve URLs
    /// to bytes first). Fields with no entry (or a null value) are skipped.
    /// </summary>
    byte[] Render(byte[] templateBytes, FieldMap map, IReadOnlyDictionary<string, object?> data);
}

/// <summary>
/// PDFsharp-based implementation of <see cref="IPdfOverlayRenderer"/>.
/// Prefers filling a matching AcroForm field (authoritative position, then flatten); otherwise
/// draws the value at the mapped coordinates.
/// </summary>
public sealed class PdfOverlayRenderer : IPdfOverlayRenderer
{
    public byte[] Render(byte[] templateBytes, FieldMap map, IReadOnlyDictionary<string, object?> data)
    {
        ArgumentNullException.ThrowIfNull(templateBytes);
        ArgumentNullException.ThrowIfNull(map);
        ArgumentNullException.ThrowIfNull(data);

        BundledFontResolver.EnsureRegistered();

        using var input = new MemoryStream(templateBytes, writable: false);
        using var document = PdfReader.Open(input, PdfDocumentOpenMode.Modify);

        var acroFieldNames = GetAcroFieldNames(document);

        // Resolve the fields that actually have data, validating page bounds up front.
        var renderable = new List<(FieldMapping Field, object Value)>();
        foreach (var field in map.Fields)
        {
            if (!data.TryGetValue(field.Id, out var value) || value is null)
            {
                continue; // No data for this field — defined no-op.
            }

            if (field.Page < 1 || field.Page > document.PageCount)
            {
                throw new ArgumentOutOfRangeException(
                    nameof(map),
                    $"Field '{field.Id}' targets page {field.Page}, but the template has {document.PageCount} page(s).");
            }

            renderable.Add((field, value));
        }

        // One XGraphics per page: opening it per field would re-append to the page's content stream
        // for every field. Grouping keeps it to a single graphics context per page.
        foreach (var group in renderable.GroupBy(r => r.Field.Page))
        {
            var page = document.Pages[group.Key - 1];
            using var gfx = XGraphics.FromPdfPage(page);

            foreach (var (field, value) in group)
            {
                // Prefer the template's own AcroForm field rectangle (authoritative position — no
                // coordinate drift) and stamp our text there. Falls back to the mapped coordinates for
                // flat templates or fields we can't place.
                var acroName = field.AcroField ?? field.Id;
                var rect = field.Type == FieldType.Image || !acroFieldNames.Contains(acroName)
                    ? new XRect(field.X, field.Y, field.W, field.H)
                    : ResolveAcroRect(document, acroName, page) ?? new XRect(field.X, field.Y, field.W, field.H);

                StampField(gfx, field, value, rect);
            }
        }

        using var output = new MemoryStream();
        document.Save(output);
        return output.ToArray();
    }

    private static HashSet<string> GetAcroFieldNames(PdfDocument document)
    {
        var names = new HashSet<string>(StringComparer.Ordinal);

        // PdfDocument.AcroForm throws when no form exists, so probe the catalogue dictionary first.
        if (!document.Internals.Catalog.Elements.ContainsKey("/AcroForm"))
        {
            return names;
        }

        var form = document.AcroForm;

        foreach (var name in form.Fields.Names)
        {
            names.Add(name);
        }

        return names;
    }

    /// <summary>
    /// Returns the AcroForm field's rectangle in XGraphics (top-left) space, or null if it has no
    /// usable <c>/Rect</c>. Using the field's own rectangle removes coordinate drift between the
    /// admin map and the template.
    /// </summary>
    private static XRect? ResolveAcroRect(PdfDocument document, string acroName, PdfPage page)
    {
        if (document.AcroForm.Fields[acroName] is not { } field)
        {
            return null;
        }

        var pdfRect = field.Elements.GetRectangle("/Rect");
        if (pdfRect.IsZero)
        {
            return null;
        }

        // /Rect is in PDF bottom-left space; convert the top edge to distance-from-top.
        var top = page.Height.Point - pdfRect.Y2;
        return new XRect(pdfRect.X1, top, pdfRect.Width, pdfRect.Height);
    }

    private static void StampField(XGraphics gfx, FieldMapping field, object value, XRect rect)
    {
        switch (field.Type)
        {
            case FieldType.Image:
                DrawImage(gfx, rect, value);
                break;

            case FieldType.Multiline:
                DrawMultiline(gfx, rect, field, FormatValue(field, value));
                break;

            case FieldType.Barcode:
                // Reserved — not rendered yet.
                break;

            case FieldType.Text:
            case FieldType.Date:
            default:
                DrawText(gfx, rect, field, FormatValue(field, value));
                break;
        }
    }

    private static void DrawText(XGraphics gfx, XRect rect, FieldMapping field, string text)
    {
        // A single-line text field can't show line breaks (they'd render as missing-glyph boxes), so
        // collapse any to a comma list — e.g. a multi-line address mapped to a text field degrades to
        // "line1, line2, line3" instead of tofu. (Use a Multiline field to stack them properly.)
        text = CollapseNewlines(text);
        if (text.Length == 0)
        {
            return;
        }

        var font = CreateFont(field);
        var format = new XStringFormat
        {
            // Vertically centre the text within the field box — the admin sizes/places the box over the
            // line and the text sits on it. (Top-anchor floated tall boxes high; centre reads best.)
            LineAlignment = XLineAlignment.Center,
            Alignment = field.Alignment switch
            {
                TextAlignment.Center => XStringAlignment.Center,
                TextAlignment.Right => XStringAlignment.Far,
                _ => XStringAlignment.Near
            }
        };
        gfx.DrawString(text, font, XBrushes.Black, rect, format);
    }

    private static string CollapseNewlines(string text) =>
        text.Contains('\n')
            ? string.Join(", ", text.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            : text;

    private static void DrawMultiline(XGraphics gfx, XRect rect, FieldMapping field, string text)
    {
        if (text.Length == 0)
        {
            return;
        }

        var font = CreateFont(field);
        var formatter = new XTextFormatter(gfx)
        {
            Alignment = field.Alignment switch
            {
                TextAlignment.Center => XParagraphAlignment.Center,
                TextAlignment.Right => XParagraphAlignment.Right,
                _ => XParagraphAlignment.Left
            }
        };

        // XTextFormatter wraps on width and clips to the rectangle.
        formatter.DrawString(text, font, XBrushes.Black, rect, XStringFormats.TopLeft);
    }

    private static void DrawImage(XGraphics gfx, XRect rect, object value)
    {
        var bytes = value switch
        {
            byte[] b => b,
            ReadOnlyMemory<byte> rom => rom.ToArray(),
            Stream s => ReadAll(s),
            _ => throw new ArgumentException(
                $"Image field value must be byte[] or Stream, was {value.GetType().Name}. " +
                "Resolve image URLs to bytes before calling Render.")
        };

        using var imageStream = new MemoryStream(bytes, writable: false);
        using var image = XImage.FromStream(imageStream);
        gfx.DrawImage(image, rect.X, rect.Y, rect.Width, rect.Height);
    }

    private static XFont CreateFont(FieldMapping field) =>
        new(field.FontFamily, field.FontSize, XFontStyleEx.Regular);

    private static string FormatValue(FieldMapping field, object value)
    {
        if (field.Type != FieldType.Date)
        {
            return value as string ?? Convert.ToString(value, CultureInfo.InvariantCulture) ?? string.Empty;
        }

        var dt = value switch
        {
            DateTime d => d,
            DateTimeOffset dto => dto.DateTime,
            string s when DateTime.TryParse(s, CultureInfo.InvariantCulture,
                DateTimeStyles.RoundtripKind, out var parsed) => parsed,
            _ => (DateTime?)null
        };

        if (dt is { } when)
        {
            return string.IsNullOrEmpty(field.Format)
                ? when.ToString(CultureInfo.InvariantCulture)
                : when.ToString(field.Format, CultureInfo.InvariantCulture);
        }

        return value as string ?? Convert.ToString(value, CultureInfo.InvariantCulture) ?? string.Empty;
    }

    private static byte[] ReadAll(Stream stream)
    {
        if (stream is MemoryStream ms)
        {
            return ms.ToArray();
        }

        using var buffer = new MemoryStream();
        stream.CopyTo(buffer);
        return buffer.ToArray();
    }
}
