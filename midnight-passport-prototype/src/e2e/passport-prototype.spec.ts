import { expect, type Page, test } from "@playwright/test";

const issueNationalIdThroughBrowser = async (page: Page): Promise<void> => {
  await page.locator("#initializeWallet").click();
  await page.locator("#issueNationalId").click();
  await page.locator("#uploadDocuments").click();
  await page.locator("#passLiveness").click();
  await page.locator("#approveProfile").click();
  await page.locator("#completeIssuance").click();
  await expect(page.locator("#nationalIdStatus")).toHaveText("Issued");
};

const expectScreeningDenial = async (
  page: Page,
  input: {
    readonly buttonId: "flagSanctions" | "flagPep";
    readonly reason: string;
  },
): Promise<void> => {
  await page.locator(`#${input.buttonId}`).click();
  await expect(page.locator("#issuerProofStatus")).toHaveText("Denied");
  await expect(page.locator("#completeIssuance")).toBeDisabled();
  await expect(page.locator("#issuerEvents li").first()).toContainText(
    input.reason,
  );

  await page.getByLabel("Back to Midnight Passport prototype").click();
  await expect(page.locator("#complianceStatus")).toHaveText("Not issued");
  await expect(page.locator("#prepareProof")).toBeDisabled();
};

test.describe("Midnight Passport prototype browser", () => {
  test.beforeEach(async ({ request }) => {
    await request.post("/api/actions/reset");
  });

  test("drives the approved investment flow through the backend session", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: /prove eligibility/i }),
    ).toBeVisible();
    await expect(page.locator("#issueNationalId")).toBeDisabled();
    await expect(page.locator("#initializeWallet")).toBeEnabled();

    await page.locator("#initializeWallet").click();
    await expect(page.locator("#walletStatus")).toContainText("Initialized");
    await expect(page.locator("#passkeyCredentialId")).toContainText(
      "passkey:alice:device-1",
    );
    await expect(page.locator("#walletSeedHash")).not.toHaveText(
      "Not generated",
    );
    await expect(page.locator("#lockWallet")).toBeEnabled();

    await page.locator("#lockWallet").click();
    await expect(page.locator("#walletStatus")).toContainText("locked");
    await expect(page.locator("#issueNationalId")).toBeDisabled();
    await expect(page.locator("#unlockWallet")).toBeEnabled();

    await page.locator("#unlockWallet").click();
    await expect(page.locator("#walletStatus")).toContainText("unlocked");
    await expect(page.locator("#issueNationalId")).toBeEnabled();

    await page.locator("#issueNationalId").click();
    await expect(page).toHaveURL(/national-id-issuer\.html/);
    await expect(page.locator("#issuerDid")).toHaveText(
      "did:midnight:prototype:national-id-issuer",
    );
    await page.locator("#uploadDocuments").click();
    await page.locator("#passLiveness").click();
    await page.locator("#approveProfile").click();
    await expect(page.locator("#completeIssuance")).toBeEnabled();
    await page.locator("#completeIssuance").click();
    await expect(page.locator("#nationalIdStatus")).toHaveText("Issued");
    await expect(page.locator("#issueCompliance")).toBeEnabled();

    await page.locator("#issueCompliance").click();
    await expect(page).toHaveURL(/request_uri=/);
    await expect(page.locator("#approveScreeningConsent")).toBeEnabled();
    await page.locator("#approveScreeningConsent").click();
    await expect(page).toHaveURL(/screening-issuer\.html/);
    await expect(page.locator("#issuerDid")).toHaveText(
      "did:midnight:prototype:screening-issuer",
    );
    await expect(page.locator("#verifyNationalId")).toContainText("✓");
    await page.locator("#runSanctions").click();
    await page.locator("#runPep").click();
    await page.locator("#approveProfile").click();
    await expect(page.locator("#completeIssuance")).toBeEnabled();
    await page.locator("#completeIssuance").click();
    await expect(page.locator("#complianceStatus")).toHaveText("Issued");
    await expect(page.locator("#prepareProof")).toBeEnabled();

    await page.locator("#prepareProof").click();
    await expect(page.locator("#proofStatus")).toHaveText("Prepared");
    await expect(page.locator("#approveProof")).toBeEnabled();

    await page.locator("#approveProof").click();
    await expect(page.locator("#proofStatus")).toHaveText("Approved");
    await expect(page.locator("#settleInvestment")).toBeEnabled();

    await page.locator("#settleInvestment").click();
    await expect(page.locator("#proofStatus")).toHaveText("Settled");
    await expect(page.locator("#settlementSummary")).toContainText(
      "250 units sent to midnight-treasury",
    );
    await expect(page.locator("#events li").first()).toContainText(
      "External crypto wallet transferred 250 units",
    );
  });

  test("models the compliance denied path without preparing a proof", async ({
    page,
  }) => {
    await page.goto("/");

    await page.locator("#runDeniedPath").click();

    await expect(page.locator("#flowMode")).toHaveText("Denied path");
    await expect(page.locator("#walletStatus")).toContainText("Initialized");
    await expect(page.locator("#nationalIdStatus")).toHaveText("Issued");
    await expect(page.locator("#complianceStatus")).toHaveText("Not issued");
    await expect(page.locator("#proofStatus")).toHaveText("Denied");
    await expect(page.locator("#prepareProof")).toBeDisabled();
    await expect(page.locator("#events li").first()).toContainText(
      "Compliance issuer denied issuance",
    );
  });

  test("models Screening issuer sanctions denial without issuing compliance", async ({
    page,
  }) => {
    await page.goto("/");

    await issueNationalIdThroughBrowser(page);
    await page.locator("#issueCompliance").click();
    await expect(page).toHaveURL(/request_uri=/);
    await page.locator("#approveScreeningConsent").click();
    await expect(page).toHaveURL(/screening-issuer\.html/);

    await expectScreeningDenial(page, {
      buttonId: "flagSanctions",
      reason: "Sanctions screening returned a possible match",
    });
  });

  test("models Screening issuer PEP denial without issuing compliance", async ({
    page,
  }) => {
    await page.goto("/");

    await issueNationalIdThroughBrowser(page);
    await page.locator("#issueCompliance").click();
    await expect(page).toHaveURL(/request_uri=/);
    await page.locator("#approveScreeningConsent").click();
    await expect(page).toHaveURL(/screening-issuer\.html/);

    await expectScreeningDenial(page, {
      buttonId: "flagPep",
      reason: "PEP screening returned a possible match",
    });
  });
});
