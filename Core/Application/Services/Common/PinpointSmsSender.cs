using System;
using System.Threading;
using System.Threading.Tasks;
using Amazon.PinpointSMSVoiceV2;
using Amazon.PinpointSMSVoiceV2.Model;
using DfrntDriveConfigurator.Infrastructure;
using Serilog;

namespace DfrntDriveConfigurator.Core.Application.Services.Common;

/// <summary>
/// AWS Pinpoint SMS sender — mirrors smppservice/Services/SMSService.cs
/// (SendTextMessage, MessageType.TRANSACTIONAL). The IAmazonPinpointSMSVoiceV2
/// client is registered in Program.cs with the same OS-aware credential
/// resolution as IAmazonS3. The origination identity is per-deployment config
/// (AppSettings.SmsOriginationIdentity).
/// </summary>
public class PinpointSmsSender(IAmazonPinpointSMSVoiceV2 client, AppSettings settings) : ISmsSender
{
    public bool IsConfigured => settings.SmsEnabled;

    public async Task<string?> SendAsync(string canonicalMobile, string message, CancellationToken ct = default)
    {
        if (!IsConfigured)
        {
            Log.Warning("SMS not sent — SmsOriginationIdentity is not configured on this deployment.");
            return null;
        }

        var request = new SendTextMessageRequest
        {
            DestinationPhoneNumber = canonicalMobile,
            OriginationIdentity = settings.SmsOriginationIdentity,
            MessageBody = message,
            MessageType = MessageType.TRANSACTIONAL,
        };

        try
        {
            var response = await client.SendTextMessageAsync(request, ct);
            Log.Information("SMS sent to {MobileTail} via Pinpoint (MessageId {MessageId})",
                Tail(canonicalMobile), response.MessageId);
            return response.MessageId;
        }
        catch (Exception ex)
        {
            // Soft-fail: never surface provider detail to the caller. Log the
            // last-4 only (never the code, never the full number).
            Log.Error(ex, "SMS send failed to {MobileTail} via Pinpoint", Tail(canonicalMobile));
            return null;
        }
    }

    private static string Tail(string mobile) =>
        string.IsNullOrEmpty(mobile) || mobile.Length < 4 ? "****" : $"***{mobile[^4..]}";
}
