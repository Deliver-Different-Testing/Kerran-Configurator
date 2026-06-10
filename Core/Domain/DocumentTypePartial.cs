// Hand-authored partial for DocumentType — adds the Phase 3b ReviewCriteria
// column (database/041) without touching the EFPT-scaffolded entity, so it
// survives regen. Mapped explicitly in DynamicDespatchDbContext.OnModelCreating.
#nullable disable
namespace DfrntDriveConfigurator.Core.Domain.Despatch;

public partial class DocumentType
{
    // Tenant-defined AI accept/reject criteria for this document type. Null →
    // the AgentDocumentAiReviewer falls back to its built-in default prompt.
    public string ReviewCriteria { get; set; }
}
