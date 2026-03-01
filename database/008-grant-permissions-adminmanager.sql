-- ============================================================================
-- 008-grant-permissions-adminmanager.sql
-- Grants SELECT, INSERT, UPDATE, DELETE on all tables used by the
-- DfrntDrive Configurator app to the AdminManager database user.
-- Run AFTER scripts 001–007 on each tenant database.
-- ============================================================================

-- ---- New tables created by this app ----------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON [dbo].[AppConfig]                TO [AdminManager];
GRANT SELECT, INSERT, UPDATE, DELETE ON [dbo].[JobWorkflowStep]          TO [AdminManager];
GRANT SELECT, INSERT, UPDATE, DELETE ON [dbo].[JobBarcode]               TO [AdminManager];
GRANT SELECT, INSERT, UPDATE, DELETE ON [dbo].[JobPhoto]                 TO [AdminManager];
GRANT SELECT, INSERT, UPDATE, DELETE ON [dbo].[AccessorialWorkflowTask]  TO [AdminManager];

-- ---- Existing tables this app reads / writes --------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON [dbo].[TucEventTemplate]              TO [AdminManager];
GRANT SELECT, INSERT, UPDATE, DELETE ON [dbo].[tucEventTemplateDetail]        TO [AdminManager];
GRANT SELECT, INSERT, UPDATE, DELETE ON [dbo].[TucEventType]                  TO [AdminManager];
GRANT SELECT, INSERT, UPDATE, DELETE ON [dbo].[TucEventTypeGroups]            TO [AdminManager];
GRANT SELECT, INSERT, UPDATE, DELETE ON [dbo].[TucEventType_EventTypeGroups]  TO [AdminManager];
GRANT SELECT                         ON [dbo].[TucJobStatus]                  TO [AdminManager];
GRANT SELECT                         ON [dbo].[TucClient]                     TO [AdminManager];
GRANT SELECT                         ON [dbo].[tblUser]                       TO [AdminManager];
PRINT 'Permissions granted to [AdminManager] for DfrntDrive Configurator tables.';
GO
