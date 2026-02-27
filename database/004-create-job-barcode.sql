-- ============================================================================
-- 004-create-job-barcode.sql
-- Multi-value barcode capture per job (POD)
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[JobBarcode]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[JobBarcode] (
        [Id]            INT            IDENTITY(1,1) NOT NULL,
        [JobId]         INT            NOT NULL,
        [BarcodeValue]  NVARCHAR(500)  NOT NULL,
        [BarcodeType]   NVARCHAR(50)   NULL,
        [ScannedAt]     DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
        [ScannedBy]     INT            NULL,
        [GpsLatitude]   DECIMAL(9,6)   NULL,
        [GpsLongitude]  DECIMAL(9,6)   NULL,
        CONSTRAINT [PK_JobBarcode] PRIMARY KEY CLUSTERED ([Id])
    );

    CREATE NONCLUSTERED INDEX [IX_JobBarcode_JobId]
        ON [dbo].[JobBarcode] ([JobId]);
END
GO
