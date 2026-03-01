-- ============================================================================
-- 006: AccessorialWorkflowTask — links accessorial charges to workflow steps
-- Phase 3c: Accessorial → Workflow Task injection
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AccessorialWorkflowTask')
BEGIN
    CREATE TABLE AccessorialWorkflowTask (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        AccessorialChargeId INT NOT NULL,       -- Logical FK to AccessorialCharge (table may not exist in all tenant DBs)
        EventTypeId INT NOT NULL,               -- FK to TucEventType (the workflow step type)
        StageId INT NOT NULL,                   -- Which job stage: 1=Enroute to Pickup, 2=Pickup, 3=Enroute to Delivery, 4=Delivery
        Sequence INT NOT NULL DEFAULT 0,
        Required BIT NOT NULL DEFAULT 1,
        ConfigJson NVARCHAR(MAX) NULL,          -- Step-specific config (JSON schema for generic renderer)
        Active BIT NOT NULL DEFAULT 1,
        CONSTRAINT FK_AWT_EventType FOREIGN KEY (EventTypeId) REFERENCES TucEventType(ucetID)
    );

    CREATE INDEX IX_AWT_Accessorial ON AccessorialWorkflowTask(AccessorialChargeId) WHERE Active = 1;

    PRINT 'Created AccessorialWorkflowTask table';
END
ELSE
    PRINT 'AccessorialWorkflowTask table already exists';
GO
