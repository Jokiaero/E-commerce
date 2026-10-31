# Supabase Shop Setup

## Apply the database migration

1. Open the Supabase project used by `EXPO_PUBLIC_SUPABASE_URL` in `.env.local`.
2. Open **SQL Editor** and create a new query.
3. Run every SQL file in `migrations/` in timestamp order, starting with `20261004000000_shop_cart_orders.sql`. Later migrations update the schema and checkout function; applying only the first migration will leave checkout incompatible with the app.
4. Confirm the tables `stores`, `products`, `cart_items`, `orders`, and `order_items` appear in Table Editor. The first migration also creates `profiles`, `addresses`, and `favorites` when they do not already exist.

Do not put a Supabase service-role key in the Expo app. Table access is protected by row-level security and uses the signed-in user's session.

## Password recovery on Expo Web

The login screen's **Lupa kata sandi?** link opens `/reset-password`. The app sends recovery emails with a redirect to `/reset-password` on the same origin as the open app, validates the recovery session from the email, and saves the new password through Supabase Auth.

1. Start Expo Web from `RasaLokal` with `npm run web` and note the actual browser address, including its port.
2. In Supabase **Authentication > URL Configuration**, set **Site URL** to that address. This is also where password reset emails sent directly from the Supabase dashboard will return. Recovery links that land on the home page are forwarded to the reset form.
3. Add the exact recovery address to **Redirect URLs**. For example, if the app runs at `http://localhost:8081`, add `http://localhost:8081/reset-password`. Use the actual host and port if they differ; `localhost` and `127.0.0.1` are different origins.
4. In **Authentication > Email Templates > Reset Password**, the default reset link should use `<a href="{{ .ConfirmationURL }}">Reset kata sandi</a>`. A link to the Site URL alone does not verify the recovery token. Custom templates with `token_hash` must also include `type=recovery` and point to `/reset-password`.
5. Request a new email from **Lupa kata sandi?**, open the latest link while the web server is running, enter matching passwords of at least eight characters, and save. Old or used email links may have expired.

For a deployed web app, add its HTTPS `/reset-password` URL to the redirect allow list and use its origin as Site URL. Localhost links only work on the computer running Expo. For a native build, allow `rasalokal://reset-password`; Expo Go development URLs depend on the current host.

Reference: [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [email templates](https://supabase.com/docs/guides/auth/auth-email-templates).

## Use the shop data

- Create or sign in to a customer account before adding products to the database-backed cart or checking out.
- Sign in with the seller account, open **Pusat Penjual > Pengaturan Toko**, and save the store profile before creating products.
- Add products from **Kelola Produk**. Products marked available appear in the customer catalog.
- Customer checkout creates a separate order for each store in the cart. Sellers only see and update orders for their own store.

Product images can currently be supplied as a public image URL in the seller product form; image upload storage is not configured by this migration.

## Driver GPS tracking

Apply `migrations/20261031000000_driver_tracking.sql` after the earlier migrations, then `migrations/20261031010000_driver_registration.sql`. These add coordinate snapshots, driver-only RPCs, delivery history, preparation-only merchant updates, the `orders` Realtime publication, and self-registration that always waits for administrator activation. Also apply `migrations/20261101000000_driver_order_queue.sql` after the payment migrations to enable the driver task queue and secure task claiming.

Buyer and seller tracking screens have no demo/Next Status buttons. Sellers can only accept, prepare, and mark food ready. Payment confirmation comes from the payment backend; COD orders are confirmed at checkout. After successful payment or COD checkout, an active driver without another active delivery sees a privacy-limited queue card (the app refreshes the queue every five seconds). The card appears before preparation is complete, but a driver can claim the task only after the merchant marks it ready. Claiming is an authenticated, atomic server operation; only then can that driver see the buyer's delivery details. Admin/service-role dispatch remains available as a fallback.

## Simulated payments for a class demo

Bank transfer and e-wallet checkout use a local **simulation**, styled like a payment gateway. No bank, e-wallet, Midtrans account, Edge Function, API secret, transfer, or real funds are involved. The confirmation screen and database record identify the payment as `simulation`/`DEMO-*`; COD remains payable to the driver.

1. Apply `migrations/20261031050000_simulated_payments.sql` after the earlier migrations. It adds `payment_provider`, `payment_channel`, and `payment_reference`, and an authenticated RPC that only lets a buyer simulate payment for their own eligible bank/e-wallet order. Buyers still cannot directly update order payment status.
2. In the app, choose **Transfer Bank** or **E-Wallet**, create a checkout, choose a clearly labelled demo channel, then press **Simulasikan pembayaran**. The order status changes to paid for demonstration only. Cancelling leaves the order unpaid.
3. This intentionally allows an authenticated buyer to simulate payment. It is for a controlled academic demo only—never deploy or represent it as a production payment flow.

Optional Midtrans experiment code is present in `migrations/20261031040000_midtrans_payments.sql` and `functions/`, but the app does not call it in demo mode. There is no need to deploy those Edge Functions or set Midtrans secrets for the class simulation.

To connect a real driver for development:

1. Open **Profil > Pusat Driver**. A new user chooses **Daftar akun driver**, creates their email/password account, then completes the driver form at `/driver-register` with name, phone, vehicle type, and registration plate. An existing signed-in user can complete that form directly. New registrations are stored with `active = false` and show **Menunggu aktivasi admin**. For buyer/driver testing on the same order, use separate buyer and driver accounts.
2. As the project administrator, review the applicant in **Table Editor > delivery_drivers**. Activate only the selected applicant after checking their details. In SQL Editor, replace the sample UUID with that row's `user_id`:

   ```sql
   update public.delivery_drivers
   set active = true
   where user_id = '00000000-0000-0000-0000-000000000001'
   returning user_id, name, vehicle, active;
   ```

   The applicant can press **Periksa status aktivasi**. Once active, the **Pusat Driver** menu opens their tasks at `/driver`. Client sessions cannot insert/update the driver table directly, activate themselves, overwrite a registration by resubmitting, or reactivate a disabled driver. User-editable Auth metadata is never used as evidence of approval.

3. Normal flow: create a paid/COD order and mark it ready from the seller account. It appears in the active driver's **Pesanan** queue; the driver presses **Ambil tugas**. The first active driver to claim it is assigned, and the server prevents that driver from taking another active delivery. Admin/service-role dispatch can still assign a task manually if needed:

   ```sql
   select public.dispatch_order_driver(
     '00000000-0000-0000-0000-000000000002', -- order UUID
     '00000000-0000-0000-0000-000000000001'  -- registered driver UUID
   );
   ```

4. On the driver's device, sign in with that driver account and open **Profil > Pusat Driver**, or `/driver` on the running app (for local Expo Web, for example `http://localhost:8081/driver`). Press **Aktifkan lokasi driver** and allow location access. On a different phone, use the deployed HTTPS application or a native build: the phone's `localhost` refers to the phone itself.
5. Open `/tracking?id=ORDER_UUID` as the corresponding buyer or seller. Position and status are read from the server. An unrelated account cannot read the order or send GPS updates.

The driver page uses foreground GPS and stops the watcher when the page loses navigation focus. This is an initial driver integration, not a background mobile driver service or an automatic driver matching service. Do not put a service-role key in the driver app. Activation and assignment remain administrator/backend operations. A guest, an unregistered account, or a pending driver cannot start the task/GPS interface.

| Driver input | Server behavior |
| --- | --- |
| Assigned driver's first valid GPS away from the shop | `driver_going_to_merchant` |
| GPS within 100 m of pickup, including its accuracy radius | `driver_arrived_merchant` |
| Driver confirms physical collection at pickup with fresh GPS | `picked_up` |
| Next GPS after pickup, away from the customer | `driver_going_to_customer` |
| GPS within 100 m of the saved delivery point | `driver_arrived` |
| Driver confirms handover at the destination with fresh GPS | records `delivered`, then sets `completed`; COD confirmation includes collection of payment |

GPS alone never proves collection, handover, or payment. The server accepts location accuracy up to 50 m, rejects samples older than two minutes or over 30 seconds in the future, ignores out-of-order samples, and requires a location from the last 90 seconds for handover. Completed/cancelled deliveries cannot restart. Addresses and shop points are snapshotted when the order is created; an address edited later does not move an existing delivery. Old orders without an exact matching saved address remain without GPS destination data and cannot be dispatched until an administrator supplies their verified coordinates.

The driver app uses a registered driver's session to call `list_driver_order_queue()` and claim a ready task with `claim_driver_order(p_order_id)`, then calls `record_driver_location(p_order_id, p_latitude, p_longitude, p_accuracy, p_recorded_at)` and `record_driver_handover(p_order_id, p_event)` (`picked_up` or `delivered`). It must never submit an arbitrary order status. Trusted dispatcher integration remains available through `dispatch_order_driver(p_order_id, p_driver_id)` server-side.

### Local tracking checks

The SQL tests run actual migrations and authorization/geofence checks in an isolated PGlite database; they do not change the hosted project. Test tooling stays in the ignored `.expo` directory. With Node 24, run from `RasaLokal`:

```powershell
npm install --prefix .expo/driver-sql-tools --no-save --package-lock=false --ignore-scripts --no-audit --no-fund @electric-sql/pglite
node --test scripts/driver-registration.test.cjs scripts/driver-tracking.test.cjs scripts/driver-tracking-sql.test.cjs
```
