-- ============================================================================
-- 005-create-job-photo.sql
-- Multi-value photo capture per job (POD)
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[JobPhoto]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[JobPhoto] (
        [Id]            INT            IDENTITY(1,1) NOT NULL,
        [JobId]         INT            NOT NULL,
        [PhotoType]     NVARCHAR(50)   NOT NULL DEFAULT 'delivery',
        [BlobUrl]       NVARCHAR(500)  NOT NULL,
        [ThumbnailUrl]  NVARCHAR(500)  NULL,
        [CapturedAt]    DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
        [CapturedBy]    INT            NULL,
        [GpsLatitude]   DECIMAL(9,6)   NULL,
        [GpsLongitude]  DECIMAL(9,6)   NULL,
        [Notes]         NVARCHAR(500)  NULL,
        CONSTRAINT [PK_JobPhoto] PRIMARY KEY CLUSTERED ([Id])
    );

    CREATE NONCLUSTERED INDEX [IX_JobPhoto_JobId]
        ON [dbo].[JobPhoto] ([JobId]);
END
GO
