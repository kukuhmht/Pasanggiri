# Implementation Plan

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Authenticated User Without Valid Membership Gets Redirect Loop
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Setup**: Install `vitest` and `fast-check` as devDependencies in `apps/web` since no test framework exists yet. Create `vitest.config.ts` with proper TypeScript path aliases matching `tsconfig.json`.
  - **Scoped PBT Approach**: Scope the property to concrete failing cases from `isBugCondition`:
    - Case 1: `membershipCount == 0` (user authenticated, no memberships) — mock Supabase `.single()` to return `{ data: null, error: ... }`
    - Case 2: `membershipCount > 1` (user authenticated, multiple memberships) — mock `.single()` to return error for multiple rows
    - Case 3: `membershipCount == 1 AND orgData IS NULL` (membership exists but org data is null) — mock membership with `organizations: null`
  - **Test Details**: Mock `createServerSupabase` to return a mock Supabase client. For each bug condition case:
    - Call `getAuthContext()` on UNFIXED code
    - Assert that `getAuthContext()` returns a partial context (NOT null) with `{ user, org: null, orgId: null, role: null }` for authenticated users
    - This assertion will FAIL on unfixed code because current `getAuthContext()` returns `null` for all these cases
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists: `getAuthContext()` returns `null` instead of partial context for authenticated users without valid membership)
  - Document counterexamples found (e.g., "getAuthContext() returns null for authenticated user with 0 memberships, causing redirect loop")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Normal User Dashboard Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - **Observe behavior on UNFIXED code for non-buggy inputs** (cases where `isBugCondition` returns false):
    - Observe: `getAuthContext()` with 1 valid membership + valid org returns `{ user, org, orgId, role }` — full context object
    - Observe: `getAuthContext()` with no authenticated user (null user) returns `null`
    - Observe: `isOrgActive(org)` with `status: 'active'` and valid `berlaku_hingga` returns `true`
    - Observe: `isOrgActive(org)` with `status: 'expired'` returns `false`
    - Observe: `isOrgActive(org)` with `status: 'suspended'` returns `false`
    - Observe: `isOrgActive(null)` returns `false`
  - **Write property-based tests** using `fast-check`:
    - Property: For all non-buggy inputs (authenticated user with exactly 1 membership and valid org data), `getAuthContext()` returns a full context with `user`, `org` (non-null OrgContext), `orgId` (string), and `role` (string)
    - Property: For unauthenticated users (no Supabase session), `getAuthContext()` returns `null`
    - Property: For all valid org configurations with `status ∈ {active, trial}` and non-expired `berlaku_hingga`, `isOrgActive(org)` returns `true`
    - Property: For all org configurations with `status ∈ {expired, suspended}`, `isOrgActive(org)` returns `false`
    - Property: Grace period logic — `isPastGracePeriod` and `isInGracePeriod` produce consistent results for arbitrary dates
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 3. Fix for blank dashboard on authenticated user without valid membership

  - [ ] 3.1 Update `getAuthContext()` in `apps/web/src/lib/auth.ts`
    - Replace `.single()` with `.maybeSingle()` on the memberships query (line ~24) to avoid throwing error on 0 rows
    - When `membership` is null (0 rows): return partial context `{ user, org: null, orgId: null, role: null }` instead of `return null`
    - When membership exists but `membership.organizations` is null: return partial context `{ user, org: null, orgId: membership.org_id, role: membership.role }`
    - Add null guard before `org.berlaku_hingga` access in grace period logic: `if (org && isPastGracePeriod(org.berlaku_hingga) && ...)`
    - Keep returning `null` ONLY when `user` is null (truly not authenticated)
    - _Bug_Condition: isBugCondition(input) where input.user IS NOT NULL AND (input.membershipCount == 0 OR input.membershipCount > 1 OR (input.membershipCount == 1 AND input.orgData IS NULL))_
    - _Expected_Behavior: Return partial context { user, org: null, orgId: null, role: null } for authenticated users without valid membership, instead of null_
    - _Preservation: User with 1 valid membership + org returns full context unchanged; unauthenticated user returns null_
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2_

  - [ ] 3.2 Update `AdminLayout` in `apps/web/src/app/(admin)/app/layout.tsx`
    - Change `if (!ctx) redirect('/login')` to differentiate between "not authenticated" (`ctx === null`) and "authenticated but no membership" (`ctx.org === null`)
    - When `ctx === null`: continue to redirect to `/login` (unchanged behavior for unauthenticated users)
    - When `ctx.org === null`: render a new `NoOrganizationPage` error component instead of redirecting
    - The error component should display: "Akun Anda belum terhubung ke organisasi manapun. Hubungi admin untuk didaftarkan." with a logout button
    - Style consistently with existing design (Tailwind classes: `bg-krem`, `text-coklat`, `text-hijau-tua`, `border-emas`, `font-[family-name:var(--font-cinzel)]`)
    - _Bug_Condition: ctx is non-null but ctx.org is null — authenticated user without membership_
    - _Expected_Behavior: Show informative error page, NOT redirect to /login_
    - _Preservation: ctx === null still redirects to /login; ctx with valid org renders dashboard unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2_

  - [ ] 3.3 Update `AdminDashboard` in `apps/web/src/app/(admin)/app/page.tsx`
    - Update `if (!ctx) redirect('/login')` to match the new pattern: only redirect when `ctx === null`
    - The `org: null` case is already partially handled (the `!org` branch exists showing "Organisasi belum ditemukan"), but verify it works correctly with the new partial context
    - Ensure `isOrgActive(org)` handles `org: null` gracefully (already does per `org-status.ts`)
    - _Requirements: 2.1, 2.2, 3.1_

  - [ ] 3.4 Create `NoOrganizationPage` component
    - Create `apps/web/src/app/(admin)/app/_components/no-organization-page.tsx`
    - Props: `email: string` (user's email for display)
    - Display informative message explaining the user is not connected to any organization
    - Include logout button (call Supabase signOut + redirect to `/login`)
    - Include contact admin instructions
    - Style consistently with existing design system (putih-gading, hijau-tua, emas, coklat, cinzel font)
    - _Requirements: 2.1, 2.2_

  - [ ] 3.5 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Authenticated User Without Valid Membership Gets Partial Context
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior: `getAuthContext()` returns partial context (not null) for authenticated users without valid membership
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed — `getAuthContext()` now returns partial context, layout shows error page instead of redirect loop)
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.6 Verify preservation tests still pass
    - **Property 2: Preservation** - Normal User Dashboard Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions — normal users still get full context, unauthenticated users still redirect to login, org status logic unchanged)
    - Confirm all tests still pass after fix (no regressions)

- [ ] 4. Checkpoint - Ensure all tests pass
  - Run full test suite with `vitest --run` in `apps/web`
  - Verify all property-based tests pass (both bug condition and preservation)
  - Run `turbo build` to ensure no TypeScript compilation errors
  - Ensure all tests pass, ask the user if questions arise.
