import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { constructWebhookEvent } from "./webhooks";
import { SdkConfigError } from "./errors";

const SECRET = "whsec_test_secret";

function sign(body: string, secret = SECRET) {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

describe("constructWebhookEvent", () => {
  it("verifies a valid signature and parses the payload", () => {
    const body = JSON.stringify({ subscriptionId: "sub_123", status: "ACTIVE" });
    const event = constructWebhookEvent(
      body,
      { signature: sign(body), eventType: "subscription.updated", deliveryId: "del_1" },
      SECRET,
    );

    expect(event).toEqual({
      eventType: "subscription.updated",
      deliveryId: "del_1",
      payload: { subscriptionId: "sub_123", status: "ACTIVE" },
    });
  });

  it("throws SdkConfigError when the signature doesn't match", () => {
    const body = JSON.stringify({ a: 1 });
    expect(() =>
      constructWebhookEvent(
        body,
        { signature: sign(body, "wrong-secret"), eventType: "x", deliveryId: "d" },
        SECRET,
      ),
    ).toThrow(SdkConfigError);
  });

  it("throws when the body was tampered with after signing", () => {
    const original = JSON.stringify({ amount: 100 });
    const signature = sign(original);
    const tampered = JSON.stringify({ amount: 100000 });

    expect(() =>
      constructWebhookEvent(tampered, { signature, eventType: "x", deliveryId: "d" }, SECRET),
    ).toThrow(SdkConfigError);
  });

  it("throws when the signature header is missing", () => {
    expect(() =>
      constructWebhookEvent(
        "{}",
        { signature: undefined, eventType: "x", deliveryId: "d" },
        SECRET,
      ),
    ).toThrow(/Missing X-Webhook-Signature/);
  });

  it("throws when the signature header has an unrecognized format", () => {
    expect(() =>
      constructWebhookEvent(
        "{}",
        { signature: "not-a-real-signature", eventType: "x", deliveryId: "d" },
        SECRET,
      ),
    ).toThrow(/Unrecognized signature header format/);
  });

  it("throws when the event type header is missing", () => {
    const body = "{}";
    expect(() =>
      constructWebhookEvent(
        body,
        { signature: sign(body), eventType: undefined, deliveryId: "d" },
        SECRET,
      ),
    ).toThrow(/Missing X-Webhook-Event/);
  });

  it("throws when the delivery id header is missing", () => {
    const body = "{}";
    expect(() =>
      constructWebhookEvent(
        body,
        { signature: sign(body), eventType: "x", deliveryId: undefined },
        SECRET,
      ),
    ).toThrow(/Missing X-Webhook-Delivery-Id/);
  });

  it("throws when the body is not valid JSON despite a valid signature", () => {
    const body = "not json";
    expect(() =>
      constructWebhookEvent(
        body,
        { signature: sign(body), eventType: "x", deliveryId: "d" },
        SECRET,
      ),
    ).toThrow(/not valid JSON/);
  });
});
