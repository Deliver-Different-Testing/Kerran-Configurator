-- Add wait condition columns to AutomationActions table
-- Supports workflow chaining: action → wait for condition → action
-- When ActionType = 'WaitForCondition', these fields define what to wait for

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AutomationActions') AND name = 'WaitConditionType')
BEGIN
    ALTER TABLE AutomationActions ADD WaitConditionType NVARCHAR(50) NULL;
    ALTER TABLE AutomationActions ADD WaitStatusMode NVARCHAR(50) NULL;
    ALTER TABLE AutomationActions ADD WaitStatusId INT NULL;
    ALTER TABLE AutomationActions ADD WaitScheduledTimeField NVARCHAR(50) NULL;
    ALTER TABLE AutomationActions ADD WaitOffsetValue INT NULL;
    ALTER TABLE AutomationActions ADD WaitOffsetUnit NVARCHAR(20) NULL;
    ALTER TABLE AutomationActions ADD WaitScanTypes NVARCHAR(500) NULL;
END
GO
