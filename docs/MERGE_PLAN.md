# SS Zentronics Merge Plan

Base = `paywall` (this repo). zentronics.com's FastAPI backend is reference-only
(`reference-zentronics/`), not run. Marketing frontend is Atazaz's, calls our API.

Every checkpoint: **build → test → you say okay → git push → next checkpoint.**
No checkpoint starts until the previous one is pushed.

---

### 1. GitHub login

Add GitHub OAuth (same pattern as existing Google login), backend + web button.
**Test:** log in with GitHub end to end.

### 2. Commission ledger schema

`commission_rules`, `commission_ledger`, `payouts` tables. SS Zentronics = owner,
gets platform commission on every sale. Postgres-first (matches existing pattern).
**Test:** unit test the split math (gross → commission → vendor payout).

### 3. Wire commission into payment flow

On `PAYMENT_SUCCEEDED`, snapshot commission split into the ledger (rate never
re-read later, so past sales don't move if rates change).
**Test:** fake a payment, check ledger rows are correct.

### 4. LedGix multi-line journal postings

Extend LedGix connector: sale = customer debit / revenue credit (commission %) /
vendor credit (rest). Receipt = bank debit / customer credit. Payout = vendor
debit / bank credit. Still Postgres-first, LedGix async, fallback on outage
(already how the sync engine works — just feeding it richer entries).
**Test:** mock LedGix server, confirm 3 entry types post correctly, confirm
outage → queued → catches up later.

### 5. Payout flow (manual for now)

Admin screen: view accrued commission per vendor, mark payout as paid.
No automated bank transfer yet.
**Test:** accrue → mark paid → ledger reflects it.

### 6. Embeddable checkout widget (developer front)

Public hosted checkout (`paywall.quiqtuneup.com` style) any app can call: fetch
plans → pick one → pay via Stripe (incl. Apple Pay / Google Pay wallet buttons)
or Easypaisa/JazzCash.
**Test:** a dummy "LedGix Expense Tracker" test page completes a purchase
end-to-end.

### 7. API contract for Atazaz

Write up (not code) the exact endpoints marketing site needs: login/signup,
browse store, "send me to checkout" handoff. Hand it off.
**Test:** you review it, confirm it's enough for him to build against.

### 8. Marketing → checkout handoff wiring

Once his frontend calls it: unauthenticated user hits "buy" → signup/login →
cart → checkout on our side, session carries through.
**Test:** full click-through from sszentronics.com (or local stand-in) to a
completed purchase.

### 9. Go-live prep

Real Easypaisa/JazzCash/card-processor merchant accounts (your side, external).
Swap sandbox creds for real ones in prod env on the intel box.
**Test:** one real small transaction, all three (invoice/receipt/emails/ledger)
fire correctly.

---

Not doing yet unless you ask: automated payouts, refund self-service, anything
beyond what's listed above.
