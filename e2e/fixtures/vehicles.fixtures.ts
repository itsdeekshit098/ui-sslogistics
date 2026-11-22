import { type Page, type Request } from "@playwright/test";
import { successfulJson, failJson } from "./mockEnvelope";

/**
 * In-memory mock for the Vehicles flows exercised by vehicles.spec.ts: list /
 * create / edit / delete (/api/vehicles), document upload + delete + preview
 * (/api/vehicles/documents), and the photo gallery (/api/attachments).
 *
 * The rules the real routes enforce and the spec depends on are mirrored here,
 * each read off src/app/api/vehicles/route.ts rather than guessed: a seat count
 * for seated types, a 409 on a duplicate number, a status from the allowed list,
 * a plausible year and start <= end on the validity dates (compared with the
 * stored date when only one is sent), dates only once the document exists, and
 * the two delete gates (attached records, then the manual unlock).
 */

export const OWNER = { id: 1, name: "Mock Owner", owner_type: "OWN" };

export const SEEDED = {
  /** Deletes cleanly. */
  deletable: { id: 601, number: "MK01DEL0001" },
  /** Still has a diesel record and a trip booking. */
  linked: { id: 602, number: "MK01LINK002" },
  /** No linked records, but allow_permanent_delete is false. */
  locked: { id: 603, number: "MK01LOCK003" },
};

const STATUSES = ["Active", "Maintenance", "Idle"];
const SEATED_TYPES = ["CAR", "BUS", "TEMPO_TRAVELLER"];
const ALLOWED_MIME = ["image/png", "image/jpeg", "application/pdf"];

/** A real 1x1 PNG, so <img> previews decode. */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

export type MockApi = {
  requests: Request[];
  payloads: Array<{ url: string; method: string; body: unknown }>;
  /** Parsed JSON bodies of PUT /api/vehicles, in order. */
  vehiclePuts: () => Array<Record<string, unknown>>;
  /** Count of POSTs that reached /api/vehicles/documents. */
  documentUploads: () => number;
  vehicles: Map<number, MockVehicle>;
};

type MockVehicle = Record<string, unknown> & {
  id: number;
  vehicle_number: string;
  vehicle_type: string;
  linked_records?: string;
  allow_permanent_delete?: boolean;
};

type Attachment = {
  id: number;
  vehicle_id: number;
  client_entry_id: null;
  loan_id: null;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  caption: null;
  created_at: string;
};

const DOC_DATES: Record<string, [string, string]> = {
  fc_url: ["fc_start_date", "fc_end_date"],
  insurance_url: ["insurance_start_date", "insurance_end_date"],
};
const DATE_PAIRS: Array<[string, string, string, string]> = [
  ["fc_start_date", "fc_end_date", "fc_url", "FC"],
  ["insurance_start_date", "insurance_end_date", "insurance_url", "Insurance"],
];

function vehicleRow(
  id: number,
  vehicle_number: string,
  extra: Partial<MockVehicle> = {},
): MockVehicle {
  return {
    id,
    vehicle_number,
    vehicle_type: "TRUCK",
    truck_type: "OPEN",
    company: "Tata",
    model: "407",
    status: "Active",
    fuel_type: "DIESEL",
    owner_type: "OWN",
    owner_name: OWNER.name,
    owner_entity_id: OWNER.id,
    fc_url: null,
    fc_start_date: null,
    fc_end_date: null,
    insurance_url: null,
    insurance_start_date: null,
    insurance_end_date: null,
    rc_url: null,
    permit_url: null,
    pollution_url: null,
    tax_url: null,
    ...extra,
  };
}

function json(status: number, body: unknown) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

/** Multipart text field, read off the raw request body. */
function formField(raw: string, name: string): string | null {
  const match = raw.match(new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]*)`));
  return match ? match[1] : null;
}

function formFileType(raw: string): string | null {
  const match = raw.match(/name="file"; filename="[^"]*"\r\nContent-Type: ([^\r]*)/);
  return match ? match[1] : null;
}

export async function installVehiclesMocks(page: Page): Promise<MockApi> {
  const requests: Request[] = [];
  const payloads: MockApi["payloads"] = [];
  const vehicles = new Map<number, MockVehicle>();
  const attachments: Attachment[] = [];
  let nextVehicleId = 7001;
  let nextAttachmentId = 8001;
  let uploads = 0;

  const seed = (v: MockVehicle) => vehicles.set(v.id, v);
  seed(vehicleRow(SEEDED.deletable.id, SEEDED.deletable.number, { allow_permanent_delete: true }));
  seed(vehicleRow(SEEDED.linked.id, SEEDED.linked.number, { linked_records: "1 diesel record and 1 trip booking" }));
  seed(vehicleRow(SEEDED.locked.id, SEEDED.locked.number, { allow_permanent_delete: false }));

  /** Mirrors validateDocumentDates + validateDateOrderAgainstStored + the document prerequisite. */
  function validateDates(body: Record<string, unknown>, stored: MockVehicle | null): string | null {
    const has = (v: unknown) => v !== null && v !== undefined && v !== "";
    for (const [startKey, endKey, urlKey, label] of DATE_PAIRS) {
      for (const key of [startKey, endKey]) {
        if (!has(body[key])) continue;
        const d = new Date(String(body[key]));
        if (isNaN(d.getTime()) || d.getUTCFullYear() < 1900 || d.getUTCFullYear() > 2100) {
          return `Invalid date for ${key}`;
        }
      }
      if (!has(body[startKey]) && !has(body[endKey])) continue;

      const hasDoc = has(body[urlKey]) || (!(urlKey in body) && has(stored?.[urlKey]));
      if (!hasDoc) return `Upload the ${label} document before setting its validity dates`;

      const start = startKey in body ? body[startKey] : stored?.[startKey];
      const end = endKey in body ? body[endKey] : stored?.[endKey];
      if (has(start) && has(end) && new Date(String(end)).getTime() < new Date(String(start)).getTime()) {
        return `${label} end date must be on or after the start date`;
      }
    }
    return null;
  }

  function expiryStatus(end: unknown): string | null {
    if (!end) return null;
    const days = (new Date(String(end)).getTime() - Date.now()) / 86_400_000;
    if (days < 0) return "expired";
    return days <= 30 ? "expiring_soon" : "valid";
  }

  function withStatuses(v: MockVehicle) {
    return {
      ...v,
      fc_status: expiryStatus(v.fc_end_date),
      insurance_status: expiryStatus(v.insurance_end_date),
    };
  }

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    requests.push(request);
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    const isMultipart = (request.headers()["content-type"] ?? "").startsWith("multipart/");
    let body: unknown = null;
    if (method !== "GET" && method !== "DELETE") {
      if (isMultipart) {
        body = request.postData();
      } else {
        try {
          body = request.postDataJSON();
        } catch {
          body = request.postData();
        }
      }
    }
    payloads.push({ url: `${path}${url.search}`, method, body });

    if (path === "/api/auth/session" && method === "GET") {
      return route.fulfill(
        json(200, successfulJson({ id: "mock-user", email: "mock@example.test", role: "admin", displayName: "Mock Admin" })),
      );
    }

    if (path === "/api/system/maintenance-stream" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: `data: ${JSON.stringify({ maintenanceMode: false, message: null })}\n\n`,
      });
    }
    if (path === "/api/notifications/stream" && method === "GET") {
      return route.fulfill({ status: 200, contentType: "text/event-stream", body: "" });
    }

    if (path === "/api/vehicle-owners" && method === "GET") {
      return route.fulfill(json(200, successfulJson([OWNER])));
    }

    // ── Vehicles ─────────────────────────────────────────────────────────
    if (path === "/api/vehicles" && method === "GET") {
      const search = (url.searchParams.get("search") ?? "").toLowerCase();
      const rows = [...vehicles.values()]
        .filter((v) => !search || v.vehicle_number.toLowerCase().includes(search))
        .map(withStatuses);
      return route.fulfill(
        json(200, successfulJson({ data: rows, total: rows.length, stats: null })),
      );
    }

    if (path === "/api/vehicles" && method === "POST") {
      const values = body as Record<string, unknown>;
      if (SEATED_TYPES.includes(String(values.vehicle_type)) && !values.seating_capacity) {
        return route.fulfill(json(400, failJson("Seating Capacity is required for this vehicle type")));
      }
      if (values.status && !STATUSES.includes(String(values.status))) {
        return route.fulfill(json(400, failJson(`Invalid status. Allowed values: ${STATUSES.join(", ")}`)));
      }
      const number = String(values.vehicle_number ?? "").trim();
      if ([...vehicles.values()].some((v) => v.vehicle_number.toLowerCase() === number.toLowerCase())) {
        return route.fulfill(json(409, failJson("A vehicle with this number already exists")));
      }
      const created = vehicleRow(nextVehicleId++, number, { ...values, vehicle_number: number } as Partial<MockVehicle>);
      seed(created);
      return route.fulfill(json(201, successfulJson({ id: created.id }, "Vehicle created successfully")));
    }

    if (path === "/api/vehicles" && method === "PUT") {
      const values = body as Record<string, unknown>;
      const stored = vehicles.get(Number(values.id));
      if (!stored) return route.fulfill(json(404, failJson("Vehicle not found")));
      if (values.status && !STATUSES.includes(String(values.status))) {
        return route.fulfill(json(400, failJson(`Invalid status. Allowed values: ${STATUSES.join(", ")}`)));
      }
      const dateError = validateDates(values, stored);
      if (dateError) return route.fulfill(json(400, failJson(dateError)));
      const { id: _id, ...changes } = values;
      void _id;
      Object.assign(stored, changes);
      return route.fulfill(json(200, successfulJson({ id: stored.id }, "Vehicle updated successfully")));
    }

    if (path === "/api/vehicles" && method === "DELETE") {
      const id = Number(url.searchParams.get("id"));
      const target = vehicles.get(id);
      if (!target) return route.fulfill(json(404, failJson("Vehicle not found")));
      if (target.linked_records) {
        return route.fulfill(
          json(400, failJson(`Cannot delete "${target.vehicle_number}" because it still has ${target.linked_records}. Remove those first.`)),
        );
      }
      if (!target.allow_permanent_delete) {
        return route.fulfill(
          json(400, {
            success: false,
            code: "VEHICLE_DELETE_LOCKED",
            error: `"${target.vehicle_number}" is locked against permanent deletion. An admin has to enable it in the database first.`,
          }),
        );
      }
      vehicles.delete(id);
      return route.fulfill(json(200, successfulJson(null, "Vehicle deleted successfully")));
    }

    // ── Documents ────────────────────────────────────────────────────────
    if (path === "/api/vehicles/documents/view" && method === "GET") {
      return route.fulfill({ status: 200, contentType: "image/png", body: PNG_1X1 });
    }

    if (path === "/api/vehicles/documents" && method === "POST") {
      uploads += 1;
      const raw = String(body ?? "");
      const mime = formFileType(raw);
      if (!mime || !ALLOWED_MIME.includes(mime)) {
        return route.fulfill(json(400, failJson("Invalid file type. Allowed: JPEG, PNG, GIF, WebP, HEIC, PDF, Excel")));
      }
      const target = vehicles.get(Number(formField(raw, "vehicleId")));
      const documentType = formField(raw, "documentType") ?? "";
      if (!target || !(documentType in { fc_url: 1, insurance_url: 1, rc_url: 1, permit_url: 1, pollution_url: 1, tax_url: 1 })) {
        return route.fulfill(json(400, failJson("Invalid document type")));
      }
      const filePath = `${target.vehicle_number}/${documentType}.png`;
      target[documentType] = filePath;
      return route.fulfill(json(200, successfulJson({ filePath }, "Document uploaded")));
    }

    if (path === "/api/vehicles/documents" && method === "DELETE") {
      const raw = request.postDataJSON() as { vehicleId: number; documentType: string };
      const target = vehicles.get(Number(raw.vehicleId));
      if (!target) return route.fulfill(json(404, failJson("Vehicle not found")));
      target[raw.documentType] = null;
      // Same as the real route: a deleted document takes its validity dates with it.
      const dates = DOC_DATES[raw.documentType];
      if (dates) {
        target[dates[0]] = null;
        target[dates[1]] = null;
      }
      return route.fulfill(json(200, successfulJson(null, "Document deleted successfully")));
    }

    // ── Photos ───────────────────────────────────────────────────────────
    if (path === "/api/attachments/view" && method === "GET") {
      return route.fulfill({ status: 200, contentType: "image/png", body: PNG_1X1 });
    }

    if (path === "/api/attachments" && method === "GET") {
      const ownerId = Number(url.searchParams.get("owner_id"));
      return route.fulfill(
        json(200, successfulJson({ data: attachments.filter((a) => a.vehicle_id === ownerId) })),
      );
    }

    if (path === "/api/attachments" && method === "POST") {
      const raw = String(body ?? "");
      const fileName = raw.match(/name="file"; filename="([^"]*)"/)?.[1] ?? "photo.png";
      const attachment: Attachment = {
        id: nextAttachmentId++,
        vehicle_id: Number(formField(raw, "owner_id")),
        client_entry_id: null,
        loan_id: null,
        storage_path: `vehicles/${fileName}`,
        file_name: fileName,
        mime_type: formFileType(raw) ?? "image/png",
        size_bytes: 68,
        caption: null,
        created_at: new Date().toISOString(),
      };
      attachments.push(attachment);
      return route.fulfill(json(201, successfulJson(attachment)));
    }

    if (path === "/api/attachments" && method === "DELETE") {
      const id = Number(url.searchParams.get("id"));
      const index = attachments.findIndex((a) => a.id === id);
      if (index >= 0) attachments.splice(index, 1);
      return route.fulfill(json(200, successfulJson(null)));
    }

    if (path.startsWith("/api/")) {
      return route.fulfill(json(200, successfulJson({})));
    }

    throw new Error(`Unexpected non-API request passed to API mock: ${request.url()}`);
  });

  return {
    requests,
    payloads,
    vehicles,
    vehiclePuts: () =>
      payloads
        .filter((p) => p.method === "PUT" && p.url === "/api/vehicles")
        .map((p) => p.body as Record<string, unknown>),
    documentUploads: () => uploads,
  };
}
