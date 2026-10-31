import { expect, test } from "@playwright/test";
import { SEEDED } from "../../fixtures/vehicles.fixtures";
import { openVehiclesPage } from "../../pages/vehiclesPage";
import { typeDate } from "../../support/dateInput";

/**
 * Vehicles: add / edit / delete, document upload + validity dates + preview +
 * delete, photos, and the two delete gates. Fully mocked (see
 * e2e/fixtures/vehicles.fixtures.ts) — the mock mirrors the rules of
 * src/app/api/vehicles/route.ts, so a UI regression and a server-rule
 * regression are caught by the route unit tests and this spec respectively.
 *
 * en-GB for date text the app formats itself. It does NOT decide whether a
 * date input is day-first or month-first (the operating system does), so the
 * typed-date test below asks the browser (support/dateInput.ts) rather than
 * assuming dd/mm/yyyy — a Mac in India and a Linux CI runner differ.
 */
test.use({ locale: "en-GB" });

const PNG = { name: "doc.png", mimeType: "image/png", buffer: Buffer.from("png-bytes") };

test.describe("Vehicles — add and edit (mocked API)", () => {
  test("add form validates, then saves a bus with its seat count", async ({ page }) => {
    const { vehicles, mocks } = await openVehiclesPage(page);
    await vehicles.openAddForm();

    // Empty submit shows every required field.
    await vehicles.saveAddForm();
    await expect(page.getByText("Owner Type is required")).toBeVisible();
    await expect(page.getByText("Owner Name is required")).toBeVisible();
    await expect(page.getByText("Vehicle Number is required")).toBeVisible();
    await expect(page.getByText("Vehicle Type is required")).toBeVisible();

    // A bus brings a required seat count.
    await vehicles.fillAddForm({ number: "MK09NEW0001", type: "Bus" });
    await vehicles.saveAddForm();
    await expect(page.getByText(/seating capacity is required/i)).toBeVisible();
    expect(mocks.payloads.some((p) => p.method === "POST" && p.url === "/api/vehicles")).toBe(false);

    await page.getByTestId("components-createVehicleModal-createVehicleModal-input-seating-capacity").fill("40");
    await vehicles.saveAddForm();

    await expect(page.getByRole("heading", { name: "Add New Vehicle" })).toBeHidden();
    await expect(vehicles.row("MK09NEW0001")).toBeVisible();
    await expect(vehicles.row("MK09NEW0001")).toContainText("40-Seater");

    const created = mocks.payloads.find((p) => p.method === "POST" && p.url === "/api/vehicles");
    expect(created?.body).toMatchObject({
      vehicle_number: "MK09NEW0001",
      vehicle_type: "BUS",
      owner_name: "Mock Owner",
    });
  });

  test("a duplicate vehicle number is refused with a clear message", async ({ page }) => {
    const { vehicles } = await openVehiclesPage(page);
    await vehicles.openAddForm();
    await vehicles.fillAddForm({ number: SEEDED.deletable.number, type: "Car", seats: "5" });
    await vehicles.saveAddForm();

    await expect(page.getByText("A vehicle with this number already exists")).toBeVisible();
    // The form stays open so the number can be corrected.
    await expect(page.getByRole("heading", { name: "Add New Vehicle" })).toBeVisible();
  });

  test("edit prefills the form and saves the change", async ({ page }) => {
    const { vehicles, mocks } = await openVehiclesPage(page);
    await vehicles.openEditForm(SEEDED.deletable.number);

    const model = vehicles.editField("input-model");
    await expect(model).toHaveValue("407");
    await model.fill("709");
    await vehicles.saveEditForm();

    await expect(page.getByRole("heading", { name: "Edit Vehicle" })).toBeHidden();
    await expect(vehicles.row(SEEDED.deletable.number)).toContainText("709");
    expect(mocks.vehiclePuts().at(-1)).toMatchObject({ id: SEEDED.deletable.id, model: "709" });
  });
});

test.describe("Vehicles — documents (mocked API)", () => {
  test("every document slot accepts an upload, previews it and deletes it", async ({ page }) => {
    const { vehicles, mocks } = await openVehiclesPage(page);
    await vehicles.openDocuments(SEEDED.deletable.id);

    const slots = [
      "Fitness Certificate (FC)",
      "Insurance",
      "Registration (RC)",
      "Permit",
      "Pollution (PUC)",
      "Road Tax",
    ];
    for (const label of slots) {
      await vehicles.uploadDocument(label, PNG);
      await expect(vehicles.docCard(label).getByRole("button", { name: "View" })).toBeVisible();
    }
    expect(mocks.documentUploads()).toBe(slots.length);

    // Preview opens and the image streams through the app's own route.
    await vehicles.docCard("Registration (RC)").getByRole("button", { name: "View" }).click();
    const preview = page.getByRole("dialog").filter({ hasText: "Download" });
    await expect(preview.locator("img")).toBeVisible();
    await expect.poll(() => preview.locator("img").evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
    await preview.locator("button:not(:has-text('Download'))").click();
    await expect(preview).toBeHidden();

    for (const label of slots) {
      await vehicles.deleteDocument(label);
      await expect(vehicles.docCard(label).locator("input[type=file]")).toBeAttached();
    }
    for (const label of slots) {
      expect(mocks.vehicles.get(SEEDED.deletable.id)?.[docKey(label)]).toBeNull();
    }
  });

  test("a file type the server refuses shows its message and adds nothing", async ({ page }) => {
    const { vehicles, mocks } = await openVehiclesPage(page);
    await vehicles.openDocuments(SEEDED.deletable.id);

    await vehicles.uploadDocument("Permit", { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hi") });

    await expect(page.getByText(/Invalid file type/)).toBeVisible();
    await expect(vehicles.docCard("Permit").locator("input[type=file]")).toBeAttached();
    expect(mocks.vehicles.get(SEEDED.deletable.id)?.permit_url).toBeNull();
  });

  test("a file over 10 MB is stopped in the browser before any upload", async ({ page }) => {
    const { vehicles, mocks } = await openVehiclesPage(page);
    await vehicles.openDocuments(SEEDED.deletable.id);

    await vehicles.uploadDocument("Road Tax", {
      name: "huge.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
    });

    await expect(page.getByText('"huge.pdf" exceeds the 10 MB limit')).toBeVisible();
    expect(mocks.documentUploads()).toBe(0);
  });

  test("validity dates need the document first, and a typed date saves only once complete", async ({ page }) => {
    const { vehicles, mocks } = await openVehiclesPage(page);
    await vehicles.openDocuments(SEEDED.deletable.id);

    // No document yet → the date inputs are disabled.
    await expect(vehicles.dateInputs("Fitness Certificate (FC)").first()).toBeDisabled();

    await vehicles.uploadDocument("Fitness Certificate (FC)", PNG);
    const [start, end] = [
      vehicles.dateInputs("Fitness Certificate (FC)").nth(0),
      vehicles.dateInputs("Fitness Certificate (FC)").nth(1),
    ];
    await expect(start).toBeEnabled();

    // Type the way a user does: the day and month, then the four year digits,
    // in the order this browser's date field expects. The year passes through
    // 0002, 0020, 0202 on the way, and none of those may reach the server (the
    // field used to save on every keystroke).
    await typeDate(page, start, "2025-11-16");
    await typeDate(page, end, "2026-11-15");

    await expect.poll(() => mocks.vehicles.get(SEEDED.deletable.id)?.fc_start_date).toBe("2025-11-16");
    await expect.poll(() => mocks.vehicles.get(SEEDED.deletable.id)?.fc_end_date).toBe("2026-11-15");
    await expect(start).toHaveValue("2025-11-16");
    await expect(end).toHaveValue("2026-11-15");

    const sentDates = mocks
      .vehiclePuts()
      .flatMap((b) => Object.entries(b))
      .filter(([k]) => k.endsWith("_date"))
      .map(([, v]) => String(v));
    expect(sentDates.every((d) => Number(d.slice(0, 4)) >= 1900)).toBe(true);
  });

  test("an end date before the start date is refused and the field goes back", async ({ page }) => {
    const { vehicles } = await openVehiclesPage(page);
    await vehicles.openDocuments(SEEDED.deletable.id);
    await vehicles.uploadDocument("Insurance", PNG);

    const [start, end] = [vehicles.dateInputs("Insurance").nth(0), vehicles.dateInputs("Insurance").nth(1)];
    await start.fill("2026-03-10");
    await expect(start).toHaveValue("2026-03-10");
    await end.fill("2026-01-01");

    await expect(page.getByText("Insurance end date must be on or after the start date")).toBeVisible();
    await expect(end).toHaveValue("");
  });

  test("emptying a date field and leaving it does not clear it; the clear button does", async ({ page }) => {
    const { vehicles, mocks } = await openVehiclesPage(page);
    await vehicles.openDocuments(SEEDED.deletable.id);
    await vehicles.uploadDocument("Insurance", PNG);

    const start = vehicles.dateInputs("Insurance").nth(0);
    await start.fill("2026-03-10");
    await expect.poll(() => mocks.vehicles.get(SEEDED.deletable.id)?.insurance_start_date).toBe("2026-03-10");

    // The browser reports "" while a segment is being retyped. Neither a pause
    // nor tabbing away may wipe the stored date; the field shows it again.
    await start.fill("");
    await page.waitForTimeout(1200);
    await start.blur();
    await expect(start).toHaveValue("2026-03-10");
    expect(mocks.vehicles.get(SEEDED.deletable.id)?.insurance_start_date).toBe("2026-03-10");

    // Clearing on purpose is the button.
    await vehicles.docCard("Insurance").getByRole("button", { name: "Clear date" }).first().click();
    await expect(start).toHaveValue("");
    await expect.poll(() => mocks.vehicles.get(SEEDED.deletable.id)?.insurance_start_date).toBeNull();
  });

  test("a date typed just before the dialog closes is still saved", async ({ page }) => {
    const { vehicles, mocks } = await openVehiclesPage(page);
    await vehicles.openDocuments(SEEDED.deletable.id);
    await vehicles.uploadDocument("Fitness Certificate (FC)", PNG);

    await vehicles.dateInputs("Fitness Certificate (FC)").nth(0).fill("2026-02-02");
    // Escape closes the dialog without blurring the field, inside the save delay.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "Document Management" })).toBeHidden();

    await expect.poll(() => mocks.vehicles.get(SEEDED.deletable.id)?.fc_start_date).toBe("2026-02-02");
  });

  test("deleting a document clears its dates in the dialog, even when reopened with dates saved", async ({ page }) => {
    const { vehicles, mocks } = await openVehiclesPage(page);
    await vehicles.openDocuments(SEEDED.deletable.id);
    await vehicles.uploadDocument("Fitness Certificate (FC)", PNG);

    const soon = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    const [start, end] = [
      vehicles.dateInputs("Fitness Certificate (FC)").nth(0),
      vehicles.dateInputs("Fitness Certificate (FC)").nth(1),
    ];
    await start.fill("2025-01-01");
    await expect(start).toHaveValue("2025-01-01");
    await end.fill(soon);
    await expect(end).toHaveValue(soon);
    await expect.poll(() => mocks.vehicles.get(SEEDED.deletable.id)?.fc_end_date).toBe(soon);

    // Reopen so the dialog starts from a vehicle that already carries the
    // dates (the case where it used to re-sync to the old ones after a delete).
    await page.getByRole("dialog").filter({ hasText: "Document Management" }).getByRole("button", { name: "Close" }).first().click();
    await vehicles.openDocuments(SEEDED.deletable.id);
    await expect(vehicles.dateInputs("Fitness Certificate (FC)").nth(1)).toHaveValue(soon);

    await vehicles.deleteDocument("Fitness Certificate (FC)");

    await expect(vehicles.dateInputs("Fitness Certificate (FC)").nth(0)).toHaveValue("");
    await expect(vehicles.dateInputs("Fitness Certificate (FC)").nth(1)).toHaveValue("");
    expect(mocks.vehicles.get(SEEDED.deletable.id)?.fc_end_date).toBeNull();
  });
});

test.describe("Vehicles — photos (mocked API)", () => {
  test("upload shows the photos, viewer opens, delete removes one", async ({ page }) => {
    const { vehicles } = await openVehiclesPage(page);
    await vehicles.openPhotos(SEEDED.deletable.id);

    const input = page.getByRole("dialog").locator("input[type=file]");
    await input.setInputFiles([
      { name: "front.png", mimeType: "image/png", buffer: Buffer.from("a") },
      { name: "side.png", mimeType: "image/png", buffer: Buffer.from("b") },
    ]);
    const gallery = page.getByRole("dialog").filter({ hasText: "Vehicle photos" });
    await expect(gallery.locator("img")).toHaveCount(2);

    // Delete one (the icon shows on hover on desktop).
    const photo = gallery.locator("img").first();
    await photo.hover();
    await gallery.getByRole("button", { name: "Delete" }).first().click({ force: true });
    await page
      .getByRole("dialog")
      .filter({ hasText: "Delete Attachment" })
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await expect(gallery.locator("img")).toHaveCount(1);
  });
});

test.describe("Vehicles — delete (mocked API)", () => {
  async function tryDelete(page: import("@playwright/test").Page, number: string) {
    const { vehicles } = await openVehiclesPage(page);
    await vehicles.row(number).getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("heading", { name: "Delete Vehicle" })).toBeVisible();
    await page.getByTestId("vehicles-delete-confirm-btn").click();
    return vehicles;
  }

  test("a vehicle with nothing attached and the delete unlock is removed", async ({ page }) => {
    const vehicles = await tryDelete(page, SEEDED.deletable.number);
    await expect(vehicles.row(SEEDED.deletable.number)).toHaveCount(0);
  });

  test("a vehicle that still has records says what is attached and stays", async ({ page }) => {
    const vehicles = await tryDelete(page, SEEDED.linked.number);
    await expect(page.getByText(/still has 1 diesel record and 1 trip booking/)).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(vehicles.row(SEEDED.linked.number)).toBeVisible();
  });

  test("a vehicle that is not unlocked in the database explains why it can't be deleted", async ({ page }) => {
    const vehicles = await tryDelete(page, SEEDED.locked.number);
    await expect(page.getByText(/locked against permanent deletion/)).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(vehicles.row(SEEDED.locked.number)).toBeVisible();
  });
});

function docKey(label: string): string {
  return (
    {
      "Fitness Certificate (FC)": "fc_url",
      Insurance: "insurance_url",
      "Registration (RC)": "rc_url",
      Permit: "permit_url",
      "Pollution (PUC)": "pollution_url",
      "Road Tax": "tax_url",
    } as Record<string, string>
  )[label];
}
