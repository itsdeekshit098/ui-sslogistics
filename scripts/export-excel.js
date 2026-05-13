/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require("@supabase/supabase-js");
const ws = require("ws");
const { google } = require("googleapis");
const ExcelJS = require("exceljs");
const fs = require("fs");

// ─── Environment Variables ───
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GDRIVE_CLIENT_ID = process.env.GDRIVE_CLIENT_ID;
const GDRIVE_CLIENT_SECRET = process.env.GDRIVE_CLIENT_SECRET;
const GDRIVE_REFRESH_TOKEN = process.env.GDRIVE_REFRESH_TOKEN;
const GDRIVE_EXCEL_FOLDER_ID = process.env.GDRIVE_EXCEL_FOLDER_ID;

if (
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_KEY ||
  !GDRIVE_EXCEL_FOLDER_ID ||
  !GDRIVE_CLIENT_ID ||
  !GDRIVE_CLIENT_SECRET ||
  !GDRIVE_REFRESH_TOKEN
) {
  console.error(
    "Missing required environment variables. Need: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET, GDRIVE_REFRESH_TOKEN, GDRIVE_EXCEL_FOLDER_ID",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  realtime: { transport: ws },
});

// ─── Tables to export (each becomes a sheet) ───
const TABLES = [
  "vehicles",
  "diesel_records",
  "repair_records",
  "drivers",
  "technicians",
  "external_trips",
  "specialization_options",
  "activity_log",
];

const PAGE_SIZE = 1000;

/**
 * Fetch all rows from a table (handles pagination so we never miss rows).
 */
async function fetchAllRows(table) {
  let allRows = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error(`  Error fetching ${table}:`, error.message);
      return allRows;
    }

    if (!data || data.length === 0) break;

    allRows.push(...data);

    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return allRows;
}

/**
 * Format cell values for Excel readability.
 */
function formatCellValue(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value) || typeof value === "object") {
    return JSON.stringify(value);
  }
  return value;
}

/**
 * Build the Excel workbook with one sheet per table.
 */
async function buildExcelWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SS Logistics Backup";
  workbook.created = new Date();

  for (const table of TABLES) {
    console.log(`  Fetching: ${table}`);
    const rows = await fetchAllRows(table);
    console.log(`    → ${rows.length} rows`);

    // Sheet name max 31 chars in Excel
    const sheetName = table.length > 31 ? table.substring(0, 31) : table;
    const sheet = workbook.addWorksheet(sheetName);

    if (rows.length === 0) {
      sheet.addRow(["(no data)"]);
      continue;
    }

    // Header row from the first row's keys
    const columns = Object.keys(rows[0]);
    sheet.columns = columns.map((col) => ({
      header: col,
      key: col,
      width: Math.max(col.length + 2, 15),
    }));

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2563EB" },
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };

    // Data rows
    for (const row of rows) {
      const values = columns.map((col) => formatCellValue(row[col]));
      sheet.addRow(values);
    }

    // Auto-filter on all columns
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columns.length },
    };
  }

  return workbook;
}

/**
 * Upload the Excel file to Google Drive.
 */
async function uploadToGoogleDrive(filePath) {
  console.log("Authenticating with Google Drive...");

  const oauth2Client = new google.auth.OAuth2(
    GDRIVE_CLIENT_ID,
    GDRIVE_CLIENT_SECRET,
    "https://developers.google.com/oauthplayground",
  );

  oauth2Client.setCredentials({
    refresh_token: GDRIVE_REFRESH_TOKEN,
  });

  const drive = google.drive({ version: "v3", auth: oauth2Client });

  const fileName = filePath.split("/").pop();

  console.log(`Uploading ${fileName} to Google Drive...`);

  const fileMetadata = {
    name: fileName,
    parents: [GDRIVE_EXCEL_FOLDER_ID],
  };

  const media = {
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    body: fs.createReadStream(filePath),
  };

  try {
    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id, name",
    });
    console.log(`Upload successful! File ID: ${file.data.id}`);
  } catch (err) {
    console.error("Error uploading to Google Drive:", err.message);
    if (err.response && err.response.data) {
      console.error(err.response.data);
    }
    process.exit(1);
  }
}

async function main() {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const fileName = `ss-logistics-data-${timestamp}.xlsx`;

  try {
    console.log("========= [1/2] Exporting tables to Excel =========");
    const workbook = await buildExcelWorkbook();
    await workbook.xlsx.writeFile(fileName);
    console.log(`Excel file created: ${fileName}`);

    console.log("\n========= [2/2] Uploading to Google Drive =========");
    await uploadToGoogleDrive(fileName);

    // Cleanup
    fs.unlinkSync(fileName);

    console.log("\n✅ Excel export completed successfully!");
  } catch (error) {
    console.error("Export failed:", error);
    process.exit(1);
  }
}

main();
