-- Add AttachReportKey column to AutomationActions table
-- Stores the report key (e.g. 'pod') for email attachment generation

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AutomationActions') AND name = 'AttachReportKey')
BEGIN
    ALTER TABLE AutomationActions ADD AttachReportKey NVARCHAR(100) NULL;
END
GO
