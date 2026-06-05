namespace DfrntDriveConfigurator.Core.Application.Authorization;

// Unified Permissions addendum §B (CLIENTTYPE-ISOLATION, 2026-06-04) —
// vertical escalation prevention. A caller may only write a ClientTypeId at
// or below their own rung; crossing up the ladder is a 403.
//
// Rung map — Steve's clarifications (2026-06-05):
//   * Courier: NOT a ClientType. A courier is attached to a tenant or NP and
//     takes that type; courier logins carry an empty ClientTypeId claim, so
//     they land on `_ => 0` (denied) — correct, and they don't reach these
//     endpoints anyway. (The addendum's "rung 1 = Courier" was a mislabel.)
//   * ConnectedTenant (ClientTypeId=6): API-only — it has no interactive login,
//     so it is never a CALLER. Its rung is therefore moot for the ladder; kept
//     at NP level (2) for any target-side use. (Addendum's "NP Agent" label was
//     wrong: A1 established NP Agent = ClientTypeId 3 + NpAgentId, not 6.)
//   * Internal (ClientTypeId=1): NOT yet explicitly ruled on by Steve. Kept at
//     rung 4 (just below DF Admin) as a FAIL-SECURE default — Internal is
//     UcclInternal high-privilege, so a tenant/NP must not create or promote to
//     it. Revisit if Steve gives a different placement.
//
// Higher number = more privileged / more sensitive as a write target.
public static class ClientTypeLadder
{
    public const string ForbiddenCode = "CLIENT_TYPE_FORBIDDEN";

    public static int Rung(int clientTypeId) => clientTypeId switch
    {
        5 => 5,  // DF Admin            — full write
        1 => 4,  // Internal            — fail-secure interim (see header)
        4 => 3,  // Tenant Staff
        3 => 2,  // NetworkPartner
        6 => 2,  // ConnectedTenant     — API-only, never a caller (see header)
        2 => 1,  // Customer
        _ => 0,  // Courier (no ClientType) / empty / unknown — denied
    };

    /// <summary>
    /// True if a caller with <paramref name="callerClientTypeId"/> may write a
    /// row carrying <paramref name="requestedClientTypeId"/>. DF Admin (rung 5)
    /// clears everything; an unknown caller (rung 0) clears nothing.
    /// </summary>
    public static bool CanWriteClientType(int callerClientTypeId, int requestedClientTypeId)
        => Rung(callerClientTypeId) >= Rung(requestedClientTypeId);

    /// <summary>True only for DF Admin (ClientTypeId = 5).</summary>
    public static bool IsDfAdmin(int callerClientTypeId) => callerClientTypeId == 5;
}
