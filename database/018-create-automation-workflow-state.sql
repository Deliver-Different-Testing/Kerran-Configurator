-- Tracks paused workflow executions (wait condition steps).
-- When AutomationProcessor encounters a WaitForCondition action,
-- it creates a row here. On each tick, it checks pending rows and
-- re-evaluates the wait condition. When met, it resumes from NextStepIndex.

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('AutomationWorkflowState') AND type = 'U')
BEGIN
    CREATE TABLE AutomationWorkflowState (
        Id              INT IDENTITY(1,1) PRIMARY KEY,
        RuleId          INT NOT NULL,
        JobId           INT NOT NULL,
        NextStepIndex   INT NOT NULL,           -- The action index to resume from (0-based)
        WaitActionIndex INT NOT NULL,           -- The WaitForCondition action index that paused us
        Status          NVARCHAR(20) NOT NULL DEFAULT 'Waiting',  -- Waiting, Completed, Expired
        CreatedDate     DATETIME NOT NULL DEFAULT GETUTCDATE(),
        CompletedDate   DATETIME NULL,
        ExpiresDate     DATETIME NULL,          -- Optional TTL to prevent stale workflows
        CONSTRAINT FK_WorkflowState_Rule FOREIGN KEY (RuleId) REFERENCES AutomationRules(Id)
    );

    CREATE INDEX IX_WorkflowState_Status ON AutomationWorkflowState (Status) WHERE Status = 'Waiting';
    CREATE INDEX IX_WorkflowState_RuleJob ON AutomationWorkflowState (RuleId, JobId);
END
GO
