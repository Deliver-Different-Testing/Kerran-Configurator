-- ============================================================================
-- 002-create-app-event-type-groups.sql
-- Seeds "App Support" and "App Workflow" groups into TucEventTypeGroups
-- Uses existing table structure — just seed data
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM [dbo].[TucEventTypeGroups] WHERE [Name] = 'App Support')
BEGIN
    INSERT INTO [dbo].[TucEventTypeGroups] ([Name], [Description], [IsActive], [Created], [CreatedBy])
    VALUES ('App Support', 'Event types available as support tasks in the DF Drive mobile app', 1, GETUTCDATE(), 'SYSTEM');
END
GO

IF NOT EXISTS (SELECT 1 FROM [dbo].[TucEventTypeGroups] WHERE [Name] = 'App Workflow')
BEGIN
    INSERT INTO [dbo].[TucEventTypeGroups] ([Name], [Description], [IsActive], [Created], [CreatedBy])
    VALUES ('App Workflow', 'Event types used as workflow steps in the DF Drive mobile app', 1, GETUTCDATE(), 'SYSTEM');
END
GO
