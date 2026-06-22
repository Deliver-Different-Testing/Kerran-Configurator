using System;
using System.Threading;
using System.Threading.Tasks;
using DfrntDriveConfigurator.API.Filters;
using DfrntDriveConfigurator.Core.Application.Dtos.Portal;
using DfrntDriveConfigurator.Core.Application.Services.Portal;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DfrntDriveConfigurator.API.Controllers.Portal;

// Courier Portal Phase 1 — applicant lightweight auth + resumable application.
//
// Fully [AllowAnonymous]: applicants have no Hub account. The PortalRequestFilter
// stamps the per-deployment tenant override (and, for [PortalAuthorize] actions,
// validates the X-Portal-Token signed session and exposes the applicant id).
//
//   POST /api/portal/applicants/register           — create applicant + send code
//   POST /api/portal/applicants/emailverification  — verify code -> session
//   POST /api/portal/auth/token                     — login (verified) -> session
//   POST /api/portal/auth/refresh                   — re-issue session token
//   GET  /api/portal/applicants                     — me + saved progress  [auth]
//   PUT  /api/portal/applicants                     — save progress        [auth]
//
// State-changing calls still require the X-Requested-With header (global CSRF
// middleware); the frontend portal axios sends it.
[Route("api/portal")]
[ApiController]
[AllowAnonymous]
[ServiceFilter(typeof(PortalRequestFilter))]
public class PortalApplicantsController(PortalApplicantService service) : ControllerBase
{
    [HttpPost("applicants/register")]
    public Task<IActionResult> Register([FromBody] PortalRegisterDto dto, CancellationToken ct) =>
        Run(() => service.RegisterAsync(dto, BaseUrl(), ct), "register applicant");

    [HttpPost("applicants/emailverification")]
    public Task<IActionResult> VerifyEmail([FromBody] PortalVerifyEmailDto dto, CancellationToken ct) =>
        Run(() => service.VerifyEmailAsync(dto, ct), "verify applicant email");

    [HttpPost("auth/token")]
    public Task<IActionResult> Token([FromBody] PortalLoginDto dto, CancellationToken ct) =>
        Run(() => service.LoginAsync(dto, ct), "applicant login");

    [HttpPost("auth/refresh")]
    public Task<IActionResult> Refresh([FromBody] PortalRefreshDto dto, CancellationToken ct) =>
        Run(() => service.RefreshAsync(dto?.Token, ct), "refresh applicant session");

    [HttpGet("applicants")]
    [PortalAuthorize]
    public Task<IActionResult> Me(CancellationToken ct) =>
        Run(() => service.GetMeAsync(ApplicantId(), ct), "fetch applicant profile");

    [HttpPut("applicants")]
    [PortalAuthorize]
    public Task<IActionResult> SaveProgress([FromBody] PortalProgressDto dto, CancellationToken ct) =>
        Run(() => service.SaveProgressAsync(ApplicantId(), dto, ct), "save applicant progress");

    [HttpPost("applicants/submit")]
    [PortalAuthorize]
    public Task<IActionResult> Submit([FromBody] PortalSubmitDto dto, CancellationToken ct) =>
        Run(() => service.SubmitApplicationAsync(ApplicantId(), dto, ct), "submit applicant application");

    // ---- helpers ----------------------------------------------------------

    private string BaseUrl() => $"{Request.Scheme}://{Request.Host}";

    private int ApplicantId() =>
        HttpContext.Items[PortalRequestFilter.ApplicantIdItemsKey] is int id
            ? id
            : throw new InvalidOperationException("Applicant id missing — PortalAuthorize filter did not run.");

    // Uniform wrapper: PortalException -> 400 { message }; unexpected -> 500.
    private async Task<IActionResult> Run<T>(Func<Task<T>> action, string what)
    {
        try
        {
            return Ok(await action());
        }
        catch (PortalException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Portal: failed to {What}", what);
            return StatusCode(500, new { message = "Something went wrong. Please try again." });
        }
    }
}
