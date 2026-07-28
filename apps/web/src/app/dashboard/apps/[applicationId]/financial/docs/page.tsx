"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Badge, Card, CardContent } from "@paywall/ui";
import { ProtectedRoute } from "../../../../../../components/protected-route";
import { DashboardNav } from "../../../../../../components/dashboard-nav";
import { AppNav } from "../../../../../../components/app-nav";

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 border-b border-slate-100 py-8 first:pt-0 last:border-0"
    >
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-slate-700">
        {children}
      </div>
    </section>
  );
}

const TOC = [
  ["overview", "Overview"],
  ["prerequisites", "Prerequisites"],
  ["installing", "Installing LedGix ERP"],
  ["creating-a-company", "Creating a Company"],
  ["enabling-api", "Enabling the API Module"],
  ["generating-api-key", "Generating an API Key"],
  ["finding-company-id", "Finding your Company ID"],
  ["connecting", "Connecting to the Platform"],
  ["testing", "Testing the Connection"],
  ["permissions", "Permission Requirements"],
  ["roles", "Recommended Roles"],
  ["security", "Security Best Practices"],
  ["troubleshooting", "Troubleshooting"],
  ["migration", "Migration from Internal Finance"],
  ["faq", "FAQ"],
  ["examples", "API Examples"],
] as const;

function ApplicationFinancialDocsContent() {
  const { applicationId } = useParams<{ applicationId: string }>();

  return (
    <>
      <DashboardNav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <AppNav applicationId={applicationId} />

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">LedGix ERP Documentation</h1>
          <Link
            href={`/dashboard/apps/${applicationId}/financial`}
            className="text-sm text-slate-500 underline"
          >
            Back to Financial
          </Link>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Everything you need to connect this application&apos;s billing to LedGix ERP.
        </p>

        <Card className="mt-6">
          <CardContent className="pt-6">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              On this page
            </p>
            <nav className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              {TOC.map(([id, label]) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="text-slate-600 underline hover:text-slate-900"
                >
                  {label}
                </a>
              ))}
            </nav>
          </CardContent>
        </Card>

        <div className="mt-6">
          <Section id="overview" title="Overview">
            <p>
              LedGix ERP is an external accounting and finance system. When an organization connects
              its LedGix ERP company to this platform, billing activity generated here
              (subscriptions, invoices, receipts, refunds) is emitted as <code>FinancialEvent</code>
              records and synced across to the connected company&apos;s ledger, instead of only
              being tracked internally. This keeps your books in LedGix as the single source of
              truth for accounting, while this platform continues to own subscription and
              entitlement logic.
            </p>
            <p>
              Every organization starts on <Badge variant="outline">INTERNAL</Badge> finance -
              nothing leaves this platform until you explicitly opt in to{" "}
              <Badge variant="success">LEDGIX_ERP</Badge> on the Financial tab of an application.
            </p>
          </Section>

          <Section id="prerequisites" title="Prerequisites">
            <ul className="list-disc pl-5">
              <li>An active LedGix ERP account with administrator access.</li>
              <li>A LedGix company already created (or the ability to create one - see below).</li>
              <li>
                Organization Owner or Administrator role on this platform, so you can manage the
                Financial tab.
              </li>
              <li>
                Network access from this platform&apos;s backend to your LedGix ERP base URL (no
                firewall blocking outbound HTTPS from our infrastructure).
              </li>
            </ul>
          </Section>

          <Section id="installing" title="Installing LedGix ERP">
            <p>
              LedGix ERP is a separate, self-hosted or cloud-hosted product. If you don&apos;t
              already have an instance:
            </p>
            <ol className="list-decimal pl-5">
              <li>
                Sign up for LedGix ERP cloud, or provision a self-hosted instance per LedGix&apos;s
                installation guide.
              </li>
              <li>
                Complete the initial admin account setup and log in to the LedGix ERP admin console.
              </li>
              <li>
                Note the base URL of your instance (e.g.{" "}
                <code>https://yourcompany.getledgix.com</code>) - you&apos;ll need this later.
              </li>
            </ol>
          </Section>

          <Section id="creating-a-company" title="Creating a Company">
            <p>
              Inside LedGix ERP, a &quot;Company&quot; is the accounting entity that owns ledgers,
              currencies, and chart of accounts. To create one:
            </p>
            <ol className="list-decimal pl-5">
              <li>
                In the LedGix admin console, go to <strong>Companies</strong> and choose{" "}
                <strong>New Company</strong>.
              </li>
              <li>Fill in the company name, base currency, and fiscal year settings.</li>
              <li>
                Save - LedGix assigns the company an <strong>External Company ID</strong>, which is
                what this platform calls <code>companyId</code>.
              </li>
            </ol>
            <p>
              If you already run your business&apos;s books in an existing LedGix company, you can
              reuse it instead of creating a new one - just make sure the API module (next section)
              is enabled for that company.
            </p>
          </Section>

          <Section id="enabling-api" title="Enabling the API Module">
            <p>
              LedGix ERP&apos;s API access is a separate module that must be turned on per company:
            </p>
            <ol className="list-decimal pl-5">
              <li>
                From the company dashboard, open{" "}
                <strong>Settings → Integrations → API Access</strong>.
              </li>
              <li>
                Toggle <strong>Enable API Module</strong> on.
              </li>
              <li>
                Choose an API version - this platform records whichever <code>apiVersion</code>{" "}
                LedGix returns once connected.
              </li>
            </ol>
          </Section>

          <Section id="generating-api-key" title="Generating an API Key">
            <ol className="list-decimal pl-5">
              <li>
                Still under <strong>Settings → Integrations → API Access</strong>, choose{" "}
                <strong>Generate API Key</strong>.
              </li>
              <li>
                Give the key a descriptive label, e.g. <code>ssz-platform-production</code>.
              </li>
              <li>
                Copy the key immediately - LedGix only shows the full key once. This platform stores
                only its last four characters (<code>lastFour</code>) for identification; it never
                displays the full key again after you enter it.
              </li>
            </ol>
            <p>
              If you lose the key, you don&apos;t need to reconnect from scratch - generate a new
              key in LedGix and use <strong>Rotate API Key</strong> on the Financial tab instead.
            </p>
          </Section>

          <Section id="finding-company-id" title="Finding your Company ID">
            <p>
              The Company ID (LedGix&apos;s <strong>External Company ID</strong>) is shown on the
              company&apos;s <strong>Settings → General</strong> page, directly under the company
              name. It typically looks like <code>COMP-0001</code> or a UUID, depending on your
              LedGix edition. This is the value you&apos;ll enter as <code>companyId</code> when
              connecting below.
            </p>
          </Section>

          <Section id="connecting" title="Connecting to the Platform">
            <p>
              On the application&apos;s <strong>Financial</strong> tab in this dashboard:
            </p>
            <ol className="list-decimal pl-5">
              <li>
                Select the <strong>Connect LedGix ERP</strong> card under Provider.
              </li>
              <li>
                Fill in the <strong>ERP Base URL</strong> (your LedGix instance URL),{" "}
                <strong>Company ID</strong>, and the <strong>API Key</strong> you generated above.
              </li>
              <li>
                Click <strong>Connect LedGix ERP</strong>. The platform stores the connection and
                only ever keeps the key&apos;s last four characters visible afterward.
              </li>
              <li>
                To change the base URL or company ID later without re-entering the key, use{" "}
                <strong>Save configuration</strong> - it only updates those two fields (
                <code>PATCH</code>). To replace the key itself, use <strong>Rotate API key</strong>.
              </li>
            </ol>
          </Section>

          <Section id="testing" title="Testing the Connection">
            <p>
              After connecting, click <strong>Test connection</strong>. This platform calls LedGix
              using your stored credentials and reports back:
            </p>
            <ul className="list-disc pl-5">
              <li>
                <Badge variant="success">CONNECTED</Badge> - along with the company name and base
                currency LedGix returned, confirming the credentials and company ID are valid.
              </li>
              <li>
                <Badge variant="destructive">FAILED</Badge> - along with an error message describing
                why (see Troubleshooting below).
              </li>
            </ul>
            <p>
              The connection&apos;s status badge on the Financial tab (<code>NOT_CONFIGURED</code> /{" "}
              <code>PENDING_TEST</code> / <code>CONNECTED</code> / <code>FAILED</code> /{" "}
              <code>DISCONNECTED</code>) reflects the most recent test result, and{" "}
              <code>lastTestedAt</code> records when it last ran.
            </p>
          </Section>

          <Section id="permissions" title="Permission Requirements">
            <p>
              The Financial tab&apos;s permissions matrix controls exactly what this integration is
              allowed to do in LedGix, per resource type: Customers, Suppliers, Invoices, Receipts,
              Banks, Payment Gateways, Currencies, Taxes, Company, Chart of Accounts, and Payment
              Methods. For each resource you can grant:
            </p>
            <ul className="list-disc pl-5">
              <li>
                <strong>Read</strong> - the platform may fetch existing records of that type.
              </li>
              <li>
                <strong>Write</strong> - the platform may create or update records of that type (for
                example, posting a new invoice when one is issued here).
              </li>
            </ul>
            <p>
              <strong>There is deliberately no delete permission anywhere in this system.</strong>{" "}
              This integration can never delete data in your LedGix company, regardless of the
              permissions you grant - deletion is simply not a supported capability of the sync
              pipeline. If you need to remove a record, do it directly in LedGix.
            </p>
          </Section>

          <Section id="roles" title="Recommended Roles">
            <p>For a typical setup, we recommend:</p>
            <ul className="list-disc pl-5">
              <li>
                <strong>Invoices, Receipts, Customers</strong> - Read + Write, since this platform
                generates these as subscriptions are billed.
              </li>
              <li>
                <strong>Payment Gateways, Payment Methods, Banks, Currencies, Taxes</strong> - Read
                only, so the platform can map subscriptions to the right accounts without altering
                your ERP-side configuration.
              </li>
              <li>
                <strong>Company, Chart of Accounts</strong> - Read only, used purely for validation
                and display (e.g. showing the connected company name and base currency).
              </li>
              <li>
                <strong>Suppliers</strong> - typically not needed for a billing integration; leave
                unchecked unless you have a specific reconciliation workflow that requires it.
              </li>
            </ul>
          </Section>

          <Section id="security" title="Security Best Practices">
            <ul className="list-disc pl-5">
              <li>
                <strong>Rotate your API key periodically</strong> (e.g. every 90 days) using the
                Rotate API Key action - this replaces the stored key without any connection
                downtime, and the old key can be revoked from LedGix&apos;s side immediately after.
              </li>
              <li>
                <strong>Grant least-privilege permissions</strong> - only enable Write for the
                resources this integration actually needs to create or update, per the Recommended
                Roles above.
              </li>
              <li>
                Use a LedGix API key scoped to a dedicated integration user where LedGix supports
                it, rather than a personal admin account&apos;s key.
              </li>
              <li>
                Review the connection&apos;s <strong>Sync Status</strong> and{" "}
                <strong>Sync History</strong> periodically for unexpected dead-lettered events,
                which can indicate a misconfigured permission or an expired key.
              </li>
              <li>
                If you suspect a key has been compromised, rotate it immediately and check
                LedGix&apos;s own audit log for unauthorized activity.
              </li>
            </ul>
          </Section>

          <Section id="troubleshooting" title="Troubleshooting">
            <p>
              Common causes of a <Badge variant="destructive">FAILED</Badge> test result:
            </p>
            <ul className="list-disc pl-5">
              <li>
                <strong>Wrong base URL</strong> - double check for typos, a missing{" "}
                <code>https://</code> scheme, or a trailing path segment that shouldn&apos;t be
                there. The base URL should point at the root of your LedGix instance.
              </li>
              <li>
                <strong>Expired or revoked key</strong> - if the key was rotated or deleted on the
                LedGix side without updating it here, generate a new key in LedGix and use{" "}
                <strong>Rotate API Key</strong>.
              </li>
              <li>
                <strong>Network or firewall issues</strong> - if your LedGix instance is self-hosted
                behind a firewall, confirm it allows inbound HTTPS from this platform&apos;s
                outbound IP ranges.
              </li>
              <li>
                <strong>Wrong Company ID</strong> - verify it against Settings → General inside the
                LedGix company, not the company&apos;s display name.
              </li>
              <li>
                <strong>API module disabled</strong> - confirm the API module is still toggled on
                for that company; it can be disabled independently of the key itself.
              </li>
            </ul>
          </Section>

          <Section id="migration" title="Migration from Internal Finance">
            <p>
              Switching an organization&apos;s provider from <code>INTERNAL</code> to{" "}
              <code>LEDGIX_ERP</code> (or back) is a forward-looking change only.
            </p>
            <p>
              <strong>It does not retroactively re-sync past history.</strong> Existing{" "}
              <code>PaymentInvoice</code> and <code>PaymentReceipt</code> records created while on
              internal finance stay exactly as they are - they are not backfilled into LedGix when
              you switch. Only new <code>FinancialEvent</code>s emitted after the switch flow to the
              newly selected provider.
            </p>
            <p>
              In practice this means: if you connect LedGix ERP mid-month, that month&apos;s
              invoices issued before the switch will only exist in this platform&apos;s internal
              records, while invoices issued afterward will also sync to LedGix. Plan your migration
              date accordingly, and use LedGix&apos;s own import tools if you need historical data
              present in your ERP company.
            </p>
          </Section>

          <Section id="faq" title="FAQ">
            <p>
              <strong>Can I connect more than one LedGix company to the same application?</strong>
            </p>
            <p>
              No - each organization has exactly one financial integration configuration, pointing
              at exactly one LedGix company at a time.
            </p>

            <p>
              <strong>What happens to in-flight syncs if I disconnect?</strong>
            </p>
            <p>
              Disconnecting removes the stored credentials. Events that already synced keep their
              ERP reference numbers; anything still pending or retrying at disconnect time will fail
              and appear in Sync History rather than silently disappearing.
            </p>

            <p>
              <strong>Can I switch back to Internal Finance after connecting LedGix?</strong>
            </p>
            <p>
              Yes, at any time, from the same Provider selector. As with the forward migration, this
              is not retroactive - see Migration above.
            </p>

            <p>
              <strong>Does the customer portal show ERP data directly?</strong>
            </p>
            <p>
              Customers see their own invoices, receipts, and transactions through the Customer
              Portal regardless of provider - where available, transaction rows also show sync
              status and the ERP reference number once an event has synced.
            </p>

            <p>
              <strong>Who can configure this?</strong>
            </p>
            <p>
              Only organization staff with sufficient permissions on the Developer Portal&apos;s
              Financial tab - customers cannot change an organization&apos;s financial provider.
            </p>
          </Section>

          <Section id="examples" title="API Examples">
            <p>These examples show the exact request/response shapes used by the Financial tab.</p>

            <p className="font-medium text-slate-900">1. Connect a LedGix ERP company</p>
            <pre className="overflow-x-auto rounded-md bg-slate-900 p-3 text-xs text-slate-50">
              {`POST /organizations/org_8f2c/financial-integration/erp-connection
Content-Type: application/json

{
  "baseUrl": "https://yourcompany.getledgix.com",
  "companyId": "COMP-0001",
  "apiKey": "ledgix_live_5f9a...redacted"
}`}
            </pre>
            <pre className="overflow-x-auto rounded-md bg-slate-900 p-3 text-xs text-slate-50">
              {`200 OK

{
  "id": "erpconn_3n1k",
  "baseUrl": "https://yourcompany.getledgix.com",
  "companyId": "COMP-0001",
  "lastFour": "a3fq",
  "apiVersion": "2024-06",
  "status": "PENDING_TEST",
  "lastTestedAt": null,
  "lastSyncedAt": null,
  "company": null,
  "configuration": { "permissions": [] }
}`}
            </pre>

            <p className="font-medium text-slate-900">2. Test the connection</p>
            <pre className="overflow-x-auto rounded-md bg-slate-900 p-3 text-xs text-slate-50">
              {`POST /organizations/org_8f2c/financial-integration/erp-connection/test`}
            </pre>
            <pre className="overflow-x-auto rounded-md bg-slate-900 p-3 text-xs text-slate-50">
              {`200 OK  (success)

{
  "status": "CONNECTED",
  "testedAt": "2026-07-28T14:32:10.000Z",
  "company": {
    "externalCompanyId": "COMP-0001",
    "name": "SS Zentronics Pvt Ltd",
    "baseCurrency": "USD"
  }
}`}
            </pre>
            <pre className="overflow-x-auto rounded-md bg-slate-900 p-3 text-xs text-slate-50">
              {`200 OK  (failure)

{
  "status": "FAILED",
  "testedAt": "2026-07-28T14:32:10.000Z",
  "error": "401 Unauthorized: the provided API key is invalid or has been revoked."
}`}
            </pre>

            <p className="font-medium text-slate-900">3. Set resource permissions</p>
            <pre className="overflow-x-auto rounded-md bg-slate-900 p-3 text-xs text-slate-50">
              {`PUT /organizations/org_8f2c/financial-integration/erp-connection/permissions
Content-Type: application/json

{
  "permissions": [
    { "resource": "INVOICES", "canRead": true, "canWrite": true },
    { "resource": "RECEIPTS", "canRead": true, "canWrite": true },
    { "resource": "CUSTOMERS", "canRead": true, "canWrite": true },
    { "resource": "CURRENCIES", "canRead": true, "canWrite": false },
    { "resource": "COMPANY", "canRead": true, "canWrite": false }
  ]
}`}
            </pre>
          </Section>
        </div>
      </main>
    </>
  );
}

export default function ApplicationFinancialDocsPage() {
  return (
    <ProtectedRoute>
      <ApplicationFinancialDocsContent />
    </ProtectedRoute>
  );
}
