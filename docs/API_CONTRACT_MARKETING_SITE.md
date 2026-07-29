# API Contract — sszentronics.com Marketing/Storefront Site

For Atazaz's frontend. Base URL: paywall API (local: `http://localhost:4001`, later `https://paywall-api.quiqtuneup.com`).

Auth model: **JWT** (this frontend is a first-party consumer, same as the rest of paywall's web app) for
login/signup/cart, plus a **dedicated API key** (issued to "SS Zentronics" as its own app in paywall,
same mechanism any third-party vendor app uses) only for the checkout handoff step.

---

## 1. Browse (no auth)

```
GET /store/apps?q=&category=&tag=&sort=featured|recent|popular|top_rated|newest&cursor=&limit=
GET /store/categories
GET /store/search?q=&by=application|developer|organization|category|feature|tag
GET /store/apps/:applicationSlugOrId          -> listing detail, media, changelog, rating
GET /store/apps/:applicationSlugOrId/reviews  -> public reviews
```

## 2. Auth

```
POST /auth/register   { email, password, firstName?, lastName? }
POST /auth/login      { email, password, rememberMe? }  -> { accessToken, user } + refresh cookie
GET  /auth/google      (redirect flow)
GET  /auth/github      (redirect flow)
POST /auth/refresh     (uses refresh cookie, needs CSRF header - see existing web app's api-client.ts)
POST /auth/logout
```

Store `accessToken` in memory, send as `Authorization: Bearer <token>` on everything below.

## 3. Cart → Checkout handoff

There is no server-side "cart" in paywall today — cart is client-side state on the marketing site
(product/plan + quantity the user picked). When the user hits "buy":

1. If not logged in → send to login/register, come back to step 2 after.
2. Your backend calls (using **your app's own API key**, `X-API-Key` header — ask us for one):
   ```
   POST /public/checkout-intents
   { customerEmail, planId, priceId, successUrl?, cancelUrl? }
   -> { id, expiresAt }
   ```
3. Redirect the browser to paywall's hosted checkout page:
   ```
   https://paywall.quiqtuneup.com/checkout/{id}
   ```
   That page shows the price, lets the customer pick a payment method (card/Apple Pay/Google Pay via
   Stripe, or Easypaisa/JazzCash), and redirects to the provider's real checkout. `successUrl`/`cancelUrl`
   bring them back to your site when done.

This is the exact same mechanism a third-party vendor app (e.g. LedGix Expense Tracker) uses — SS
Zentronics's marketing site is just one more app calling it.

## 4. Post-purchase (customer already logged in)

```
GET /customer-portal/me/customers          -> which org/app relationships this user has
GET /organizations/:orgId/...              -> not needed by marketing site; that's the existing
                                               Customer Portal (apps/web /portal/**), which the
                                               logged-in user can already reach directly.
```

Invoices, receipts, saved cards, subscription history are all already built in the existing Customer
Portal (`/portal/invoices`, `/portal/receipts`, `/portal/payment-methods`, `/portal/subscriptions`) —
link to those rather than rebuilding them on the marketing site.

---

## What we still owe you

- An actual API key for "SS Zentronics" as an app in paywall (issued once you're ready to wire step 3).
- Confirm `successUrl`/`cancelUrl` you want (probably your own order-confirmation page).
