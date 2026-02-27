-- ============================================================================
-- 001-create-app-config.sql
-- Creates AppConfig table for per-tenant app configuration (DF Drive)
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AppConfig]') AND type = N'U')
BEGIN
    CREATE TABLE [dbo].[AppConfig] (
        [Id]              INT            IDENTITY(1,1) NOT NULL,
        [ConfigKey]       NVARCHAR(100)  NOT NULL,
        [ConfigValue]     NVARCHAR(MAX)  NULL,
        [DataType]        NVARCHAR(20)   NOT NULL DEFAULT 'string',
        [Category]        NVARCHAR(50)   NOT NULL DEFAULT 'feature',
        [Description]     NVARCHAR(255)  NULL,
        [IsActive]        BIT            NOT NULL DEFAULT 1,
        [Created]         DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
        [CreatedBy]       NVARCHAR(50)   NULL,
        [LastModified]    DATETIME2      NULL,
        [LastModifiedBy]  NVARCHAR(50)   NULL,
        CONSTRAINT [PK_AppConfig] PRIMARY KEY CLUSTERED ([Id]),
        CONSTRAINT [UQ_AppConfig_ConfigKey] UNIQUE ([ConfigKey])
    );
END
GO

-- Seed default feature flags
IF NOT EXISTS (SELECT 1 FROM [dbo].[AppConfig] WHERE [ConfigKey] = 'feature.smartParcelCapture')
BEGIN
    INSERT INTO [dbo].[AppConfig] ([ConfigKey], [ConfigValue], [DataType], [Category], [Description], [IsActive], [CreatedBy])
    VALUES
        ('feature.smartParcelCapture', 'false', 'bool', 'feature', 'Enable smart parcel capture with AI-assisted photo detection', 1, 'SYSTEM'),
        ('feature.barcodeScan',        'false', 'bool', 'feature', 'Enable barcode scanning for parcel identification', 1, 'SYSTEM'),
        ('feature.scheduling',         'false', 'bool', 'feature', 'Enable job scheduling and time-slot management', 1, 'SYSTEM'),
        ('feature.gpsUpdate',          'true',  'bool', 'feature', 'Enable GPS location tracking and updates', 1, 'SYSTEM'),
        ('feature.liveChat',           'false', 'bool', 'feature', 'Enable live chat between courier and dispatch', 1, 'SYSTEM'),
        ('feature.signatureCapture',   'true',  'bool', 'feature', 'Enable electronic signature capture on delivery', 1, 'SYSTEM'),
        ('feature.photoProofOfDelivery','false', 'bool', 'feature', 'Enable photo proof of delivery capture', 1, 'SYSTEM'),
        ('feature.multiBarcode',       'false', 'bool', 'feature', 'Enable scanning multiple barcodes per job', 1, 'SYSTEM'),
        ('branding.primaryColor',      '#1976D2', 'string', 'branding', 'Primary brand color for the mobile app', 1, 'SYSTEM'),
        ('branding.logoUrl',           '',       'string', 'branding', 'URL to the company logo displayed in the app', 1, 'SYSTEM'),
        ('branding.appTitle',          'DF Drive', 'string', 'branding', 'App title displayed in the header', 1, 'SYSTEM');
END
GO
