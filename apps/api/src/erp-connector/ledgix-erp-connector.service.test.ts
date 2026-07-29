import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { LedgixErpConnectorService } from "./ledgix-erp-connector.service";
import type { ERPConnectionCredentials } from "./erp-connection-credentials.interface";

const connection: ERPConnectionCredentials = {
  baseUrl: "https://erp.example.com",
  companyId: "company-1",
  apiVersion: "v1",
  apiKey: "test-key",
};

function mockFetchOnce(body: unknown, status = 200) {
  return vi.fn().mockResolvedValueOnce({
    status,
    text: async () => JSON.stringify(body),
  });
}

describe("LedgixErpConnectorService - multi-line journal postings", () => {
  let service: LedgixErpConnectorService;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    service = new LedgixErpConnectorService();
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it("posts a flat invoice when no commission split is given (non-marketplace sale)", async () => {
    const fetchMock = mockFetchOnce({ id: "inv-1", referenceNumber: "INV-001", status: "open" });
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(fetchMock);

    await service.createInvoice(
      connection,
      { customerReference: "cust-1", amountMinor: 10_000, currency: "USD" },
      "idem-1",
    );

    const [, requestInit] = fetchMock.mock.calls[0];
    const body = JSON.parse(requestInit.body as string);
    expect(body).toMatchObject({ customerReference: "cust-1", amountMinor: 10_000 });
    expect(body.vendorReference).toBeUndefined();
    expect(body.commissionAmountMinor).toBeUndefined();
  });

  it("posts the 3-line journal split when a commission split is given (marketplace sale)", async () => {
    const fetchMock = mockFetchOnce({ id: "inv-2", referenceNumber: "INV-002", status: "open" });
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(fetchMock);

    await service.createInvoice(
      connection,
      {
        customerReference: "cust-1",
        amountMinor: 10_000,
        currency: "USD",
        commissionSplit: {
          vendorReference: "org-1",
          commissionAmountMinor: 1_500,
          vendorPayoutAmountMinor: 8_500,
        },
      },
      "idem-2",
    );

    const [url, requestInit] = fetchMock.mock.calls[0];
    expect(url).toBe("https://erp.example.com/api/v1/invoices");
    const body = JSON.parse(requestInit.body as string);
    expect(body).toMatchObject({
      customerReference: "cust-1",
      amountMinor: 10_000,
      vendorReference: "org-1",
      commissionAmountMinor: 1_500,
      vendorPayoutAmountMinor: 8_500,
    });
  });

  it("posts a receipt (bank debit / customer credit) against the created invoice", async () => {
    const fetchMock = mockFetchOnce({ id: "rcpt-1", referenceNumber: "RCPT-001" });
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(fetchMock);

    await service.createReceipt(
      connection,
      { erpInvoiceId: "inv-2", amountMinor: 10_000, currency: "USD" },
      "idem-3",
    );

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://erp.example.com/api/v1/invoices/inv-2/receipts");
  });

  it("posts a payout (vendor debit / bank credit)", async () => {
    const fetchMock = mockFetchOnce({ id: "payout-1", referenceNumber: "PAYOUT-001" });
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(fetchMock);

    const result = await service.recordPayout(
      connection,
      { vendorReference: "org-1", amountMinor: 8_500, currency: "USD" },
      "idem-4",
    );

    expect(result).toEqual({ erpPayoutId: "payout-1", referenceNumber: "PAYOUT-001" });
    const [url, requestInit] = fetchMock.mock.calls[0];
    expect(url).toBe("https://erp.example.com/api/v1/payouts");
    expect(JSON.parse(requestInit.body as string)).toEqual({
      vendorReference: "org-1",
      amountMinor: 8_500,
      currency: "USD",
    });
  });

  it("retries on failure and eventually throws once attempts are exhausted", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 500, text: async () => "server error" });
    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(fetchMock);

    await expect(
      service.recordPayout(
        connection,
        { vendorReference: "org-1", amountMinor: 100, currency: "USD" },
        "idem-5",
      ),
    ).rejects.toThrow(/failed with status 500/);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  }, 10_000);
});
