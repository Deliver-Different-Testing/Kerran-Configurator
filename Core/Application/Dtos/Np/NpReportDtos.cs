using System;
using System.Collections.Generic;
using DfrntDriveConfigurator.Core.Application.Dtos.Common;

namespace DfrntDriveConfigurator.Core.Application.Dtos.Np;

// Shape matches the React ReportData type at np_reportService.ts.
public class NpReportDailyVolumeDto
{
    public string Day { get; set; } = string.Empty;
    public int Value { get; set; }
}

public class NpReportDataDto
{
    public int JobsCompleted { get; set; }
    public double OnTimePercent { get; set; }
    public string Revenue { get; set; } = "$0";
    public List<NpReportDailyVolumeDto> DailyVolume { get; set; } = new();
}

public class NpReportDataResponse : BaseResponse
{
    public NpReportDataResponse(Guid messageId) : base(messageId) { }
    public NpReportDataDto Data { get; set; } = new();
}
