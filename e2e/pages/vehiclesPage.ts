import { expect, type Locator, type Page } from "@playwright/test";
import { installVehiclesMocks, SEEDED, type MockApi } from "../fixtures/vehicles.fixtures";
import { humanFill } from "../support/human";

const CREATE = "components-createVehicleModal-createVehicleModal";
const EDIT = "components-editVehicleModal-editVehicleModal";

/** Page object for /admin/vehicles and its document, photo and form dialogs (desktop layout). */
export class VehiclesPage {
  constructor(readonly page: Page) {}

  row(vehicleNumber: string): Locator {
    return this.page.getByRole("row").filter({ hasText: vehicleNumber });
  }

  get dialog(): Locator {
    return this.page.getByRole("dialog");
  }

  async pick(triggerTestId: string, optionName: string): Promise<void> {
    await this.page.getByTestId(triggerTestId).click();
    await this.page.getByRole("option", { name: optionName, exact: true }).click();
  }

  async openAddForm(): Promise<void> {
    await this.page.getByTestId("vehicles-add-btn").click();
    await expect(this.page.getByRole("heading", { name: "Add New Vehicle" })).toBeVisible();
  }

  async fillAddForm(values: {
    number: string;
    type: string;
    owner?: string;
    seats?: string;
  }): Promise<void> {
    await this.pick(`${CREATE}-select-owner-type`, "Own");
    await this.pick(`${CREATE}-select-owner-name`, values.owner ?? "Mock Owner");
    await humanFill(this.page.getByTestId(`${CREATE}-input-vehicle-number`), values.number);
    await this.pick(`${CREATE}-select-vehicle-type`, values.type);
    if (values.seats) {
      await humanFill(this.page.getByTestId(`${CREATE}-input-seating-capacity`), values.seats);
    }
  }

  async saveAddForm(): Promise<void> {
    await this.page.getByTestId(`${CREATE}-button-2`).click();
  }

  async openEditForm(vehicleNumber: string): Promise<void> {
    await this.row(vehicleNumber).getByRole("button", { name: "Edit" }).click();
    await expect(this.page.getByRole("heading", { name: "Edit Vehicle" })).toBeVisible();
  }

  editField(suffix: string): Locator {
    return this.page.getByTestId(`${EDIT}-${suffix}`);
  }

  async saveEditForm(): Promise<void> {
    await this.page.getByTestId(`${EDIT}-button-2`).click();
  }

  async openDocuments(vehicleId: number): Promise<void> {
    await this.page.getByTestId(`desktop-doc-btn-${vehicleId}`).click();
    await expect(this.page.getByRole("heading", { name: "Document Management" })).toBeVisible();
  }

  async openPhotos(vehicleId: number): Promise<void> {
    await this.page.getByTestId(`desktop-images-btn-${vehicleId}`).click();
    await expect(this.page.getByRole("heading", { name: "Vehicle photos" })).toBeVisible();
  }

  /** The card for one document type inside the Document Management dialog. */
  docCard(label: string): Locator {
    return this.page
      .getByRole("dialog")
      .filter({ hasText: "Document Management" })
      .getByRole("heading", { name: label, exact: true })
      // h4 → its wrapper div → the card. Not "nearest ancestor with a button":
      // mid-upload the card shows a skeleton with neither input nor button.
      .locator("xpath=../..");
  }

  /** Date inputs of the FC / Insurance cards (start, then end). */
  dateInputs(label: string): Locator {
    return this.docCard(label).locator("input[type=date]");
  }

  async uploadDocument(label: string, file: { name: string; mimeType: string; buffer: Buffer }): Promise<void> {
    await this.docCard(label).locator("input[type=file]").setInputFiles(file);
  }

  /** Delete → confirm for one document card. */
  async deleteDocument(label: string): Promise<void> {
    const card = this.docCard(label);
    await card.getByRole("button").nth(1).click();
    await this.page.getByRole("dialog").filter({ hasText: "Delete Document" }).getByRole("button", { name: "Delete", exact: true }).click();
  }
}

export async function openVehiclesPage(page: Page): Promise<{ vehicles: VehiclesPage; mocks: MockApi }> {
  const mocks = await installVehiclesMocks(page);
  await page.goto("/admin/vehicles");
  await expect(page.getByTestId("vehicles-add-btn")).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: SEEDED.deletable.number })).toBeVisible();
  return { vehicles: new VehiclesPage(page), mocks };
}
