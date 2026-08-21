# Courier modal fix — code editing, top-bar actions, and Openforce number

**For:** Kerran / Garry  
**Date:** 2026-08-21  
**Surface:** Kerran Configurator courier create/edit flow  
**Priority:** high

## What needs fixing

The courier flow is close, but once a courier exists the modal/detail screen still blocks a few operational edits and keeps the navigation/actions in the wrong place.

The main issues:

1. courier code currently defaults to an old **long alpha** generation path in parts of the stack
2. courier code is **read-only** in the courier edit modal
3. the bottom action buttons make navigation clumsy on a long courier screen
4. Openforce number is not surfaced clearly enough for manual courier setup
5. when Openforce webhook creation is switched on, it must use the **same courier-code allocator** as the manual path

This is not a greenfields redesign. It is a targeted fix across the existing courier create/edit flow.

---

## Current implementation points

### Frontend

- `wwwroot/app/react/pages/np/AddCourier.tsx`
  - Quick Add create form
  - currently requires operator-entered `code`
- `wwwroot/app/react/pages/np/CourierSetup.tsx`
  - edit/detail screen for an existing courier
  - currently renders **Code** as readonly on the Profile tab
  - currently keeps `Save Changes / Cancel / Back to Fleet` in the footer
  - currently binds `tslNo` on the Licensing tab, labelled **DOT Number**

### Backend

- `API/Controllers/Np/NpFleetController.cs`
  - `POST /api/v1/np/fleet`
  - `PUT /api/v1/np/fleet/{id}`
- `Core/Application/Dtos/Np/NpFleetDtos.cs`
  - `NpFleetCourierUpdateDto` currently **drops Code**, so the edit flow cannot save code changes
- `Core/Application/Services/Np/NpFleetService.cs`
  - manual courier create/update path
  - already maps `dto.TslNo` ⇄ `tucCourier.OpenForceNumber`
- `Core/Application/Services/Np/NpApplicantService.cs`
  - approval / applicant → courier path
  - still contains `GenerateCourierCode(...)` using first-initial + surname alpha logic
- `Core/Domain/Despatch/TucCourier.cs`
  - has `OpenForceNumber`
- `Core/Domain/Despatch/DespatchContext.cs`
  - `tucCourier.Code` has index `IX_tucCourier_Code`
  - `tucCourier.OpenForceNumber` already mapped

---

## Problem detail

### 1) Courier code generation is inconsistent with the new operational requirement

The old fallback path in `NpApplicantService.GenerateCourierCode(...)` builds codes like:

- first initial + surname
- uppercase alphanumeric only
- numeric suffix on collision

That is exactly the long alpha pattern Steve wants to move away from.

For manual courier setup, the default should now be:

- **numeric first**
- by default, use the courier's `tucCourier.uccrID` / CourierID as the code
- if that code already exists, allocate the next allowed numeric code instead

### 2) OTG needs a safer numeric range

The OTG sheet Steve linked already contains low-number codes and mixed historical values.

Practical call:

- for OTG, start generated codes from **2000** rather than from low legacy numbers
- that avoids collision with the existing imported/legacy range
- the exact allocator should still check live DB uniqueness before saving

So the rule is:

- standard tenants / fleets: default to `CourierID` if free, otherwise next free numeric code
- OTG-specific path: start from `2000`, then allocate the next free numeric code from there

Do not hardcode this in React only. The allocator must live server-side.

### 3) The courier code is not editable after creation

In `CourierSetup.tsx`, the Profile tab currently renders:

- `FormField label="Code" value={c.code} readonly />`

That is the wrong constraint now.

Operators need to be able to correct or normalise a courier code after the courier exists.

This means:

- frontend must make the field editable
- update DTO must include `Code`
- update service must validate uniqueness and persist the change safely

### 4) Openforce number is already in the backend, but the UX is wrong

The stack already maps `NpFleetCourierDto.TslNo` to `tucCourier.OpenForceNumber`.

Today the courier edit screen shows it as:

- **DOT Number** on the Licensing tab

That is misleading for this workflow.

For manual courier setup, the operator needs a clearly-labelled:

- **Openforce Number**

This should be treated as an explicit editable courier field in the Configurator courier modal/setup flow.

### 5) Footer actions belong in the top action bar

`CourierSetup.tsx` currently leaves these actions at the bottom:

- Save Changes
- Cancel
- Back to Fleet

On a long courier page, that makes operators scroll too far just to navigate or save.

Move the primary actions into the top bar so they stay easy to reach.

---

## Required changes

## A. Replace alpha default code generation with a shared numeric allocator

Create a shared server-side courier-code allocator used by **all** courier-creation paths.

### Required behaviour

1. if operator enters a code manually, use that value after validation
2. if no code is entered, allocate a numeric code automatically
3. default numeric code should mirror `CourierID` when possible
4. if that value already exists in `tucCourier.Code`, allocate the next free numeric code
5. OTG should use a floor of **2000** before checking upward
6. uniqueness must be checked against live `tucCourier.Code`

### Important design rule

Do **not** keep one code path for manual create and a different code path for applicant/Openforce courier creation.

There should be one shared allocator, used by:

- `NpFleetService.CreateAsync(...)`
- `NpApplicantService.ApproveAsync(...)`
- `NpApplicantService.ProcessOpenforceContractActivatedAsync(...)` / courier creation from webhook
- any future Openforce direct-create path

### Suggested service shape

```csharp
public interface ICourierCodeAllocator
{
    Task<string> AllocateAsync(CourierCodeAllocationRequest request, CancellationToken cancellationToken = default);
    Task EnsureAvailableAsync(string code, int? excludeCourierId = null, CancellationToken cancellationToken = default);
}

public sealed class CourierCodeAllocationRequest
{
    public int? PreferredCourierId { get; init; }
    public string? RequestedCode { get; init; }
    public int? NpAgentId { get; init; }
    public int? TenantId { get; init; }
    public bool UseOtgFloor { get; init; }
    public int OtgStartFrom { get; init; } = 2000;
}
```

### Allocation rules

#### Manual requested code present

- trim
- validate allowed characters
- validate uniqueness
- save it as-is

#### Manual requested code blank / null

- if OTG range applies, start at `2000`
- else prefer `courierId` once the insert has an ID available
- if preferred value already exists as a code, increment until free

### Practical implementation note

If you need the generated code to mirror `CourierID`, the cleanest path is:

1. insert courier
2. get `uccrID`
3. calculate preferred numeric code from the inserted ID
4. if free, update `Code`
5. if not free, allocate next free code and update `Code`

That is fine as long as the whole operation stays transactional and uniqueness is validated server-side.

---

## B. Make courier code editable in the courier modal/setup screen

### Frontend

In `wwwroot/app/react/pages/np/CourierSetup.tsx`:

- change the Identity field from readonly to editable
- keep it in the top identity section / Profile tab, not hidden lower down
- if the operator changes it, mark the form dirty like any other editable field

### DTO/API

In `Core/Application/Dtos/Np/NpFleetDtos.cs`:

- add `Code` to `NpFleetCourierUpdateDto`

Today the comment explicitly says identity fields are dropped from update DTOs. That needs to change for `Code`.

### Service validation

In `NpFleetService.UpdateAsync(...)`:

- trim the incoming code
- reject blank if code is required for all couriers
- reject duplicates using `excludeCourierId = current courier`
- preserve the current code if the payload omits it only if we intentionally keep partial-update semantics

### Acceptance criteria

- operator can edit courier code from the existing courier modal/setup screen
- duplicate code save is blocked with a clear message
- unchanged code saves cleanly
- manual correction from alpha code → numeric code works without DB-side surprises

---

## C. Add Openforce Number explicitly to the courier modal

### Current gap

The backend already stores `tucCourier.OpenForceNumber`, but the UI currently presents `tslNo` as **DOT Number**.

That is the wrong label for this workflow.

### Required change

In `CourierSetup.tsx`:

- surface **Openforce Number** as an explicit editable field
- bind it to the same DTO field currently mapped to `OpenForceNumber`
- place it where operators will expect it during manual courier setup

### Recommended UX

Use:

- label: `Openforce Number`
- helper text: `Used when this courier is linked to Openforce / contractor onboarding.`

If DOT/TSL is still needed separately for other tenants, do **not** silently overload one visible label to mean two different things. Split the concepts properly if both are real business fields. But for this requested fix, the field shown in the courier modal must clearly expose the **Openforce number**.

---

## D. Move footer actions into the top bar

### Current buttons to relocate

- Save Changes
- Cancel
- Back to Fleet

### Required behaviour

Move these actions into the top bar / header action area so the operator can:

- save without scrolling to the bottom
- cancel quickly
- navigate back to fleet quickly

### UX guidance

Recommended top-bar order:

- left: back affordance / breadcrumb
- right: `Cancel` secondary, `Save Changes` primary

If `Back to Fleet` becomes the breadcrumb/back action, do not duplicate it again in the footer.

### Optional cleanup

After moving the actions to the top bar:

- remove the footer button row entirely
- or leave only lightweight status banners at the bottom

The goal is one obvious action zone, not two competing ones.

---

## E. Side note for Garry — Openforce webhook path must reuse the same code allocator

When Openforce webhook courier creation is active, do **not** let it fall back to the old alpha code generation.

Use the exact same allocator and validation rules as manual courier setup.

That applies to:

- applicant approval path
- webhook `contract_activated` courier creation path
- any future “send to Openforce then create courier” path

If manual create generates numeric codes but webhook create still generates `JSMITH2`, operations will end up with a split code system immediately.

That would be the wrong result.

---

## Recommended implementation steps

1. add a shared backend `ICourierCodeAllocator`
2. replace `NpApplicantService.GenerateCourierCode(...)` usage with the shared allocator
3. wire the shared allocator into `NpFleetService.CreateAsync(...)`
4. wire the same allocator into Openforce courier creation path
5. extend `NpFleetCourierUpdateDto` to include `Code`
6. update `NpFleetService.UpdateAsync(...)` to validate + persist code edits
7. update `CourierSetup.tsx` so Code is editable
8. update `CourierSetup.tsx` so Openforce Number is clearly surfaced and labelled correctly
9. move Save / Cancel / Back actions into the top bar
10. regression-test manual create, edit, applicant approval, and Openforce-created courier flows

---

## Acceptance criteria

### Courier code

- [ ] new courier can default to a numeric code instead of alpha code
- [ ] default numeric code mirrors `CourierID` where possible
- [ ] collision path allocates the next free numeric code
- [ ] OTG-generated codes start from `2000` upward
- [ ] operator can edit code after courier creation
- [ ] duplicate codes are blocked cleanly

### Openforce consistency

- [ ] Openforce/manual/applicant courier creation all use the same code allocator
- [ ] webhook-created couriers do not fall back to old alpha generation
- [ ] Openforce number is visible and editable in the courier modal/setup flow

### Navigation / usability

- [ ] Save / Cancel / Back are available in the top action bar
- [ ] operator does not need to scroll to the bottom to save or navigate

---

## Explicit non-goals

This fix does **not** require:

- reworking the entire courier modal information architecture
- changing courier uniqueness rules beyond code edit validation
- redesigning the whole applicant or Openforce onboarding journey

This is a focused operational fix:

- better default courier code behaviour
- editable courier code
- clear Openforce number handling
- easier top-bar navigation

---

## Short version

The core call is:

**replace the old alpha courier-code fallback with one shared numeric allocator, let operators edit the code in the courier modal, move the action buttons into the top bar, and explicitly expose Openforce Number in the manual courier setup/edit flow.**
