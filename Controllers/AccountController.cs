using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DfrntDriveConfigurator.Controllers;

[AllowAnonymous]
public class AccountController : Controller
{
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync("Identity.Application");
        HttpContext.Session.Clear();
        var publicPath = Environment.GetEnvironmentVariable("PublicPath") ?? "https://deliverdifferent.com/";
        return Redirect(publicPath);
    }
}
