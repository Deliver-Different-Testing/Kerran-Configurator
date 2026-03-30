-- Add JobRelationship column to AutomationRules table
-- Allows scoping automations to parent jobs, child jobs, standalone, or all
-- Values: NULL/'all' = all jobs, 'parent_only', 'child_only', 'standalone_only'

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AutomationRules') AND name = 'JobRelationship')
BEGIN
    ALTER TABLE AutomationRules ADD JobRelationship NVARCHAR(50) NULL;
END
GO
