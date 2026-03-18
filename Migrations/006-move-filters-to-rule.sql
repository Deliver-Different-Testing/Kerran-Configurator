-- ============================================================================
-- 006-move-filters-to-rule.sql
-- Move filter columns from AutomationCondition to AutomationRule (scope level).
-- Idempotent — safe to re-run.
-- ============================================================================

-- Job Status filters
IF COL_LENGTH('AutomationRules', 'AllJobStatuses') IS NULL
    ALTER TABLE AutomationRules ADD AllJobStatuses BIT NOT NULL DEFAULT 0;
GO

IF COL_LENGTH('AutomationRules', 'JobStatusIds') IS NULL
    ALTER TABLE AutomationRules ADD JobStatusIds NVARCHAR(2000) NULL;
GO

-- Priority filters
IF COL_LENGTH('AutomationRules', 'AllPriorities') IS NULL
    ALTER TABLE AutomationRules ADD AllPriorities BIT NOT NULL DEFAULT 0;
GO

IF COL_LENGTH('AutomationRules', 'PriorityIds') IS NULL
    ALTER TABLE AutomationRules ADD PriorityIds NVARCHAR(2000) NULL;
GO

-- Origin Site filters
IF COL_LENGTH('AutomationRules', 'AllFromSites') IS NULL
    ALTER TABLE AutomationRules ADD AllFromSites BIT NOT NULL DEFAULT 0;
GO

IF COL_LENGTH('AutomationRules', 'FromSiteIds') IS NULL
    ALTER TABLE AutomationRules ADD FromSiteIds NVARCHAR(2000) NULL;
GO

-- Destination Site filters
IF COL_LENGTH('AutomationRules', 'AllToSites') IS NULL
    ALTER TABLE AutomationRules ADD AllToSites BIT NOT NULL DEFAULT 0;
GO

IF COL_LENGTH('AutomationRules', 'ToSiteIds') IS NULL
    ALTER TABLE AutomationRules ADD ToSiteIds NVARCHAR(2000) NULL;
GO

-- Origin Region filters
IF COL_LENGTH('AutomationRules', 'AllFromRegions') IS NULL
    ALTER TABLE AutomationRules ADD AllFromRegions BIT NOT NULL DEFAULT 0;
GO

IF COL_LENGTH('AutomationRules', 'FromRegionIds') IS NULL
    ALTER TABLE AutomationRules ADD FromRegionIds NVARCHAR(2000) NULL;
GO

-- Destination Region filters
IF COL_LENGTH('AutomationRules', 'AllToRegions') IS NULL
    ALTER TABLE AutomationRules ADD AllToRegions BIT NOT NULL DEFAULT 0;
GO

IF COL_LENGTH('AutomationRules', 'ToRegionIds') IS NULL
    ALTER TABLE AutomationRules ADD ToRegionIds NVARCHAR(2000) NULL;
GO

-- Time Threshold (minutes)
IF COL_LENGTH('AutomationRules', 'TimeThreshold') IS NULL
    ALTER TABLE AutomationRules ADD TimeThreshold INT NULL;
GO

-- ============================================================================
-- 007-remove-change-status-action-type.sql
-- Merge ChangeStatus actions into UpdateJobStatus.
-- FromStatusId already exists on AutomationAction, no schema change needed.
-- ============================================================================

-- Update any existing ChangeStatus actions to UpdateJobStatus
UPDATE [dbo].[AutomationActions]
SET ActionType = 'UpdateJobStatus'
WHERE ActionType = 'ChangeStatus';
GO
