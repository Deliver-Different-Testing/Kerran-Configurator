-- ============================================================================
-- 003-create-job-workflow-step.sql
-- Records courier's completion of workflow steps for a job
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[JobWorkflowStep]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[JobWorkflowStep] (
        [Id]                INT            IDENTITY(1,1) NOT NULL,
        [JobId]             INT            NOT NULL,
        [TemplateDetailId]  INT            NOT NULL,
        [CompletedAt]       DATETIME2      NULL,
        [CompletedBy]       INT            NULL,
        [DataType]          NVARCHAR(20)   NULL,
        [TextData]          NVARCHAR(MAX)  NULL,
        [BlobUrl]           NVARCHAR(500)  NULL,
        [GpsLatitude]       DECIMAL(9,6)   NULL,
        [GpsLongitude]      DECIMAL(9,6)   NULL,
        CONSTRAINT [PK_JobWorkflowStep] PRIMARY KEY CLUSTERED ([Id]),
        CONSTRAINT [FK_JobWorkflowStep_TemplateDetail] FOREIGN KEY ([TemplateDetailId])
            REFERENCES [dbo].[tucEventTemplateDetail] ([ucetdID])
    );

    CREATE NONCLUSTERED INDEX [IX_JobWorkflowStep_JobId]
        ON [dbo].[JobWorkflowStep] ([JobId]);
END
GO
