-- ============================================================================
-- 007: Add MirrorToAgentPortal flag to TucEventTemplate (workflow templates)
-- When enabled, the workflow is exposed to the Agent Portal (InboundAgent)
-- so Network Partners see the same steps as drivers.
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('TucEventTemplate') AND name = 'UcetMirrorToAgentPortal')
BEGIN
    ALTER TABLE TucEventTemplate
    ADD UcetMirrorToAgentPortal BIT NOT NULL DEFAULT 0;

    PRINT 'Added UcetMirrorToAgentPortal column to TucEventTemplate';
END
ELSE
    PRINT 'UcetMirrorToAgentPortal column already exists';
GO
