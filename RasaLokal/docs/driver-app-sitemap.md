# RasaLokal Driver — Sitemap & Prototype Flow

Driver UI uses RasaLokal's existing orange identity, rounded cards, Indonesian copy, and Android-friendly touch targets. The prototype targets a 393 × 852 dp phone layout. It borrows familiar delivery-app patterns without using another service's logo, artwork, or screenshots.

## Global navigation

- **Beranda** → online preview, map, shift summary, performance, shortcuts.
- **Pesanan** → assigned tasks, live task status, GPS, pickup, delivery proof, COD.
- **Pendapatan** → wallet preview, transactions, daily/weekly/monthly summaries, incentives.
- **Notifikasi** → order, incentive, and account updates → notification detail.
- **Akun** → driver identity, vehicle/documents, settings, academy, support, legal, sign-out.
- Every detail page has an in-app back action; bottom navigation remains available on main destinations.

## Sitemap

### 01 — Authentication & onboarding

`Splash → Intro 1 → Intro 2 → Intro 3 → Login phone → Password → OTP → Home`

- Recovery: `Forgot password → Reset password → Success`
- Driver application: `Driver registration → Personal details → KTP → SIM → Vehicle → STNK → Document review → Approval status`
- First-use permissions: `Security PIN → Location → Notifications → Login success`
- Shared states: loading, invalid input, OTP error, rejected documents, pending approval, approved.
- **Existing app routes:** splash, account login/signup, password recovery, driver registration, admin-pending approval. Document uploads, OTP and PIN remain future onboarding screens.

### 02 — Driver home

- Offline ↔ online preview; searching, active trip, GPS unavailable and offline-network states.
- Driver header, ID, notification entry, map/location preview, today's earning and delivery metrics, rating/performance.
- Shortcuts: orders, wallet, history, incentives and help.
- Online toggle in the current prototype is a presentation state; dispatch/availability is not yet a server feature.

### 03 — Orders & delivery

`Waiting → Incoming offer → Offer detail/countdown → Accept → Merchant route → Arrived → Pickup confirmation → Receipt proof → Customer route → Customer chat/call → Arrival → COD confirmation → POD photo → Complete → Earnings summary`

- Additional branches: cancel/reason, issue report, multi-order, failed upload/GPS, empty list.
- Existing server-backed workflow: paid/COD checkout → order appears in the active driver's limited queue → merchant preparation → driver claims after ready → GPS/geofence stages → pickup → delivery proof → COD collection → completion.
- Queue cards disclose only store/order summary data. Customer contact and delivery details are visible only after a driver claims a ready task.
- Merchant/customer chat, offer acceptance/decline, cancellation controls, and multi-order dispatch are not connected to backend yet.

### 04 — Maps & navigation

- Route to merchant/customer; current driver marker, pickup/dropoff, distance/time, recenter.
- External navigation choice, location permission/GPS error, offline map state.
- Existing: GPS tracking and Google Maps deep links. Full-screen native route map and ETA provider remain future integrations.

### 05 — History

- Main history → today/week/month filters → completed/cancelled → order detail → earnings detail.
- Date filter and empty state.
- Current prototype has history entry points; persistent driver earnings/history data requires a backend ledger.

### 06 — Wallet & finances

- Wallet overview/balance → balance detail → top-up method/instructions → transactions/detail → payment notes.
- Daily/weekly/monthly income, chart, deductions, success/failure states.
- Wallet, top-up and earnings are UI previews until a finance ledger is implemented.

### 07 — Incentives & performance

- Incentive overview → daily/weekly target → progress/terms/history.
- Orders, completion/acceptance rates, rating/reviews, hub and operational area.
- Metrics are prototype values until a driver performance service exists.

### 08 — Chat & notifications

- Inbox → conversation → quick reply → order detail/call.
- Notifications by order/incentive/account → detail; empty/loading/error states.
- Current notifications are in-app prototype examples; customer chat/call infrastructure is not connected.

### 09 — Driver profile & settings

- Profile → personal details/edit/photo → vehicle and documents → bank account.
- Password/PIN, notification, language, privacy, security.
- Driver academy, help/FAQ/contact, issue ticket, terms/privacy, logout confirmation, account deletion.
- Current registration captures name, phone and vehicle/plate; other identity/banking workflows need product/backend approval.

## Primary user flows

1. **Delivery:** login → approved driver → home online preview → task → navigate/pick up → upload proof → navigate/customer → COD (if applicable) → finish → history/earnings.
2. **Finance:** home → wallet preview → top-up/instructions → transactions.
3. **Incentives:** home → incentives → target → terms/history.
4. **Support:** task → issue/chat entry; account → help/FAQ/ticket.
5. **Account:** profile → edit details/settings/documents → save.

## Design and engineering notes

- Brand: RasaLokal orange (`#FF5A00` / `#FF7A00`), pale orange, white cards, neutral app background, success green.
- Interactions use large accessible targets; demo values and non-connected features must be labelled as previews.
- No payment is represented as real unless a payment provider confirms it.
- GPS stops when the task screen loses focus; location permission is requested in context.
- The sitemap is a product blueprint, not a claim that every listed backend-dependent feature is already implemented.
