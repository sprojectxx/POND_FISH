# PONDFISH — DEEP DIVE BROWSER QA TEST SUITE & MASTER INSTRUCTION PROMPT

> **Environment**: Live Production Custom Domains  
> **Testing Scope**: Scoped Portals (Worker Tablet, Admin Portal, Public Storefront, In-Store TV, Cross-Portal State Engine)  
> **Exclusions**: Customer Mobile App and OCR Bill Scanning  
> **Execution Depth**: Deep Dive CRUD (creation, verification across portals, cleanup, and audit logging)

---

# PART 1: MASTER PROMPT (COPY-PASTE FOR YOUR NEW CHAT)

```markdown
/browser You are an expert QA Automation and Reliability Engineer. Perform a comprehensive, deep-dive browser QA audit across the PondFish digital ecosystem on live production domains.

### 1. TARGET PORTAL URLS & CREDENTIALS
- **Public Storefront**: https://pondfish.in
- **In-Store TV Portal**: https://pondfish.in/tv
- **Worker Tablet Portal**: https://worker.pondfish.in
  - Mobile: 9876543210
  - Password: Worker@123
- **Admin Management Portal**: https://admin.pondfish.in
  - Email: admin@pondfish.in
  - Password: Admin@123

---

### 2. CORE EXECUTION RULES & SAFETY

1. **LIVE PRODUCTION TESTING & FULL CRUD**:
   - This is a thorough, deep-dive evaluation—not just surface-level page loads.
   - When testing Admin mutations (e.g. creating a test fish variety, updating stock, creating a coupon), make the test data distinct with the prefix `[QA-TEST]`.
   - Verify the mutation propagates to the Public Storefront (`https://pondfish.in/fish`).
   - Clean up / delete any created `[QA-TEST]` items at the end of the test.
   - **MANDATORY**: Record every created, edited, or deleted record in a dedicated "Mutations & Cleanup Audit Log" section in the final report.

2. **STUCK LOOP & FREEZE CIRCUIT BREAKER (CRITICAL)**:
   - If any page, button action, or redirect gets stuck in an infinite spinner, loading loop, or freezes for more than 10 seconds (for example: screen freezes on *"Verifying Administrator Credentials..."* after Sign Out):
     * **DO NOT HANG OR WAIT INDEFINITELY.**
     * Immediately capture a screenshot as evidence.
     * Record the defect under **[P2] Redirection / Loading Loop**.
     * Close the tab or force navigation back to the portal root (`https://admin.pondfish.in/login` or `https://worker.pondfish.in/login`).
     * Continue smoothly to the remaining test cases.

3. **CONCURRENT REAL-TIME VERIFICATION**:
   - When a counter transaction or status change occurs in the Worker Portal, verify whether the In-Store TV Portal (`https://pondfish.in/tv`) receives and renders the live update.
   - Verify customer privacy masking on the TV screen (no full phone numbers or unmasked customer PII displayed).

---

### 3. STEP-BY-STEP TEST EXECUTION CHECKLIST

#### PHASE 1: Public Storefront Discovery (https://pondfish.in)
- [ ] **TC-PUB-01**: Navigate to https://pondfish.in/fish. Verify catalog items, images, freshness badges, pricing, and category filters hydrate.
- [ ] **TC-PUB-02**: Test Search with common terms (e.g. "Rohu", "Catla", lowercase "rohu"). Verify search is case-insensitive.
- [ ] **TC-PUB-03**: Test Category Filters (e.g. Fresh Water, Sea Fish, Live Fish). Verify filter count updates.
- [ ] **TC-PUB-04**: Test Zero-State: Search for a non-existent fish (e.g. "Salmon999"). Verify polite empty state renders and "Clear filters" resets the grid.
- [ ] **TC-PUB-05**: Open a fish detail card. Verify live inventory availability, price per kg, and modal closure.
- [ ] **TC-PUB-06**: Navigate to https://pondfish.in/subscriptions. Verify weekly freshwater fish subscription plans, pricing, and benefits display accurately.

#### PHASE 2: In-Store TV Live Broadcast (https://pondfish.in/tv)
- [ ] **TC-TV-01**: Navigate to https://pondfish.in/tv. Verify TV display loads with live connection badge ("LIVE CONNECTED").
- [ ] **TC-TV-02**: Verify recent transaction hydration cards render properly.
- [ ] **TC-TV-03**: Check privacy masking on transaction cards: Customer name should be masked (e.g. "Raj*** K.") and mobile masked ("98****3210").
- [ ] **TC-TV-04**: Verify zero console errors and check that the WebSocket heartbeat remains stable without status flickering.

#### PHASE 3: Worker Tablet Portal (https://worker.pondfish.in)
- [ ] **TC-WRK-01**: Test Invalid Login: Enter `9876543210` with wrong password. Verify clear error message is shown.
- [ ] **TC-WRK-02**: Test Valid Login: Log in with `9876543210` / `Worker@123`.
- [ ] **TC-WRK-03**: Dashboard Verification: Verify active store badge (`● STORE ACTIVE`), navigation tabs (Bookings, Bills, Customers, Transactions), and shift metrics.
- [ ] **TC-WRK-04**: Customer Lookup: Search by phone number (e.g. `9876543210`). Verify customer profile / booking history loads. Test search for an unregistered number to verify guest/walk-in state.
- [ ] **TC-WRK-05**: Booking Lookup: Search by a sample booking ID or phone. Test not-found and valid states.
- [ ] **TC-WRK-06**: Counter POS Entry: Navigate to manual bill entry. Enter a test bill amount and verify duplicate Bill ID rejection logic.
- [ ] **TC-WRK-07**: Worker Sign Out: Click "Sign Out". Verify session is revoked and page cleanly redirects back to worker login.

#### PHASE 4: Admin Operations & Governance (https://admin.pondfish.in)
- [ ] **TC-ADM-01**: Test Invalid Login: Enter `admin@pondfish.in` with wrong password. Verify error message.
- [ ] **TC-ADM-02**: Test Valid Login: Log in with `admin@pondfish.in` / `Admin@123`. Verify Executive Operations Dashboard hydrates with live metrics (Revenue, Bookings, Active Workers, Inventory).
- [ ] **TC-ADM-03**: Fish Catalog CRUD:
  * Create a test fish variety: `[QA-TEST] Golden Tilapia`, set price (e.g. ₹350/kg), select category, and save.
  * Verify `[QA-TEST] Golden Tilapia` appears on the Admin table.
  * Switch to Public Storefront (`https://pondfish.in/fish`) and verify it renders live.
  * Return to Admin and delete/archive `[QA-TEST] Golden Tilapia`.
  * Confirm deletion on both Admin and Public Storefront.
- [ ] **TC-ADM-04**: Staff Management:
  * View Workers table. Verify worker `9876543210` displays an active store attribution.
  * Inspect worker edit modal and check store assignment controls.
- [ ] **TC-ADM-05**: Live GPS Truck Tracking:
  * Navigate to Journeys tab. Verify active/past delivery truck journeys.
  * Inspect map and status controls.
- [ ] **TC-ADM-06**: Audit & Reports:
  * Open Audit Logs tab. Verify recent admin actions are logged with timestamps, admin ID, and mutation action.
- [ ] **TC-ADM-07**: Admin Sign Out (Freeze Check):
  * Click "Sign Out" in the sidebar.
  * Observe if it redirects to login cleanly or freezes on "Verifying Administrator Credentials...".
  * If frozen > 10 seconds: capture screenshot, record P2 bug, and navigate to `/login`.

---

### 4. DELIVERABLE: COMPREHENSIVE QA REPORT FORMAT
Present the results in this exact structure:

1. **Executive QA Summary**: Total test cases executed, passed, failed, and overall release readiness.
2. **Defect Log**: Ranked by severity:
   * **P0 (Blocker)**: Critical crashes, auth bypass, data corruption.
   * **P1 (Critical)**: Store mismatch, broken checkout, blocked staff handover.
   * **P2 (Major)**: UI loops/freezes, redirect glitches, search case mismatches.
   * **P3 (Minor)**: Visual misalignment, badge flickers.
   *(Each defect must include Portal, Steps to Reproduce, Observed vs Expected, and Screenshot reference).*
3. **UI/UX Breakdown & Enhancement Suggestions**:
   * Inspect visual hierarchy, spacing, typography, mobile responsiveness, and layout breakdowns across each portal.
   * Highlight any confusing button placements, poor contrast, cluttered dashboards, or awkward flows.
   * Provide actionable recommendations on how to improve the interface and user experience.
4. **Mutations & Cleanup Audit Log**:
   * Complete itemized table of any created, modified, or deleted test records.
   * Confirmation of whether all test items were safely removed.
5. **Final Release Recommendation**: Clear Go / No-Go decision with next steps.
```

---

# PART 2: ITEMIZED TEST CASE SPECIFICATION REFERENCE

### Area 1: Worker Tablet Portal
* **TC-WRK-01 (Invalid Auth)**: Rejection on bad password with HTTP 401 and descriptive UI error banner.
* **TC-WRK-02 (Valid Auth)**: Successful session hydration with store attribution badge `STORE ACTIVE`.
* **TC-WRK-03 (Disabled Account)**: HTTP 403 `WORKER_ACCOUNT_DISABLED` for deactivated staff.
* **TC-WRK-04 (Network Resilience)**: Transient network drops trigger retry banner rather than kicking to unauthenticated screen.
* **TC-WRK-05 (Customer Lookup)**: Search walk-in vs. registered customer by 10-digit mobile.
* **TC-WRK-06 (Booking Handover)**: Lookup booking, verify balance due, and simulate item preparation.
* **TC-WRK-07 (QR Cryptographic Verification)**: HMAC-signed `PFQR:...` verification against tampered tokens.
* **TC-WRK-08 (Already Handed Over Race)**: Two workers completing same booking triggers concurrency conflict warning.
* **TC-WRK-09 (Counter POS)**: Manual bill ID validation, duplicate bill block, cash vs UPI selection, atomic inventory commit.
* **TC-WRK-10 (Worker Sign Out)**: Smooth session revocation and redirect to `/login`.

### Area 2: Admin Management Portal
* **TC-ADM-01 (Admin Auth Guard)**: Valid session set via HttpOnly cookie; cross-role access (worker token) fails with 403.
* **TC-ADM-02 (Executive Dashboard)**: Telemetry cards (revenue, active orders, live trucks) hydrate without NaN/undefined.
* **TC-ADM-03 (Catalog CRUD & Public Sync)**: Add `[QA-TEST]` fish $\rightarrow$ verify on public site $\rightarrow$ delete $\rightarrow$ verify removal.
* **TC-ADM-04 (Inventory Management)**: Add harvest quantities, adjust shrinkage, and verify immediate stock update.
* **TC-ADM-05 (Promotions & Coupons)**: Schedule promo discount with start/end date enforcement.
* **TC-ADM-06 (Staff Store Attribution)**: Assign workers to stores; ensure store mismatch fails closed.
* **TC-ADM-07 (GPS Truck Tracking)**: Journey lifecycle: `Draft` $\rightarrow$ `Started` $\rightarrow$ `Live` $\rightarrow$ `Stopped` $\rightarrow$ `Archived`.
* **TC-ADM-08 (Audit Trail)**: Immutable mutation logging with IP, timestamp, and admin ID.
* **TC-ADM-09 (Sign Out Freeze Circuit Breaker)**: Subdomain sign-out redirect verification.

### Area 3: Public Website Storefront
* **TC-PUB-01 (Storefront Hydration)**: Catalog cards, Tamil/English names, prices per kg, stock status.
* **TC-PUB-02 (Search & Filtering)**: Case-insensitive search ("rohu" == "Rohu" == "ROHU") and category tags.
* **TC-PUB-03 (Zero-State & Reset)**: No-match query shows polite message and one-click "Clear filters" restore.
* **TC-PUB-04 (Product Detail & Freshness)**: Live price and availability check; modal open/close animations.
* **TC-PUB-05 (Subscriptions Discovery)**: Weekly fresh fish quota plans and tier benefits showcase.

### Area 4: In-Store TV Live Portal
* **TC-TV-01 (Initial Hydration)**: Loads recent 5-10 counter transactions.
* **TC-TV-02 (Real-Time WebSocket Feed)**: Completing POS order triggers live animated transaction card.
* **TC-TV-03 (Privacy Filter)**: Names masked ("Raj*** K.") and mobile masked ("98****3210").
* **TC-TV-04 (Heartbeat & Reconnect)**: Idle stream debounce eliminates badge flickering on reconnection.

### Area 5: Cross-Portal Synchronization
* **TC-XPORT-01 (Single Source of Truth)**: Central backend validation; zero client-side optimistic guesses.
* **TC-XPORT-02 (Multi-Projection Fan-Out)**: Single transaction concurrently updates POS queue, Admin dashboard, TV display, and Public stock.
* **TC-XPORT-03 (Double Charge Prevention)**: Idempotency keys prevent duplicate payments on retry.
