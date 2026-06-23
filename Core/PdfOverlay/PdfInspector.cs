using System;
using System.IO;
using PdfSharp.Pdf.IO;

namespace DfrntDriveConfigurator.Core.PdfOverlay;

// Vendored from PdfOverlay.Api.Rendering.

/// <summary>Validates PDFs and reads basic metadata without rendering.</summary>
public static class PdfInspector
{
    /// <summary>
    /// Returns true and the page count for a readable, non-encrypted PDF; false for anything the
    /// renderer can't open (corrupt, non-PDF, or password-protected).
    /// </summary>
    public static bool TryGetPageCount(byte[] pdf, out int pageCount)
    {
        pageCount = 0;
        try
        {
            using var ms = new MemoryStream(pdf, writable: false);
            using var doc = PdfReader.Open(ms, PdfDocumentOpenMode.Import);
            pageCount = doc.PageCount;
            return pageCount > 0;
        }
        catch (Exception)
        {
            return false; // corrupt, non-PDF, or password-protected
        }
    }
}
