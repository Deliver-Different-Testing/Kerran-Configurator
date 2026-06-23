using System.Threading;
using PdfSharp.Fonts;
using PdfSharp.WPFonts;

namespace DfrntDriveConfigurator.Core.PdfOverlay;

// Vendored from PdfOverlay.Core.

/// <summary>
/// A self-contained <see cref="IFontResolver"/> for the PDFsharp Core build, which has no access to
/// system fonts on Linux (and is non-deterministic when it does). It serves the Segoe WP family that
/// ships embedded in the <c>PdfSharp.WPFonts</c> assembly (bundled with the PDFsharp package), so
/// renders are identical on Windows dev, Linux CI, and the deployment pod without sourcing any font file.
/// </summary>
/// <remarks>
/// Every requested family maps to Segoe WP (regular/bold). This trades exact Helvetica metrics for
/// determinism — acceptable for an overlay tool where the admin positions and previews fields.
/// </remarks>
public sealed class BundledFontResolver : IFontResolver
{
    private const string RegularFace = "DD-Overlay#Regular";
    private const string BoldFace = "DD-Overlay#Bold";

    private static readonly Lock Gate = new();
    private static bool _registered;

    /// <summary>
    /// Registers a shared instance as the global font resolver, exactly once per process.
    /// Safe to call repeatedly (e.g. from every render).
    /// </summary>
    public static void EnsureRegistered()
    {
        // Lock-free fast path for the common case (called from every render).
        if (Volatile.Read(ref _registered))
        {
            return;
        }

        lock (Gate)
        {
            if (_registered)
            {
                return;
            }

            // GlobalFontSettings.FontResolver can only be assigned before any font is used; guard it.
            GlobalFontSettings.FontResolver ??= new BundledFontResolver();
            Volatile.Write(ref _registered, true);
        }
    }

    public FontResolverInfo ResolveTypeface(string familyName, bool isBold, bool isItalic) =>
        new(isBold ? BoldFace : RegularFace);

    public byte[] GetFont(string faceName) =>
        faceName == BoldFace ? FontDataHelper.SegoeWPBold : FontDataHelper.SegoeWP;
}
