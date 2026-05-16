/* eslint-disable @typescript-eslint/no-require-imports */
const { Client } = require("pg");
const { google } = require("googleapis");
const ExcelJS = require("exceljs");
const fs = require("fs");

// Environment Variables required from GitHub Actions
const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;
const GDRIVE_CLIENT_ID = process.env.GDRIVE_CLIENT_ID;
const GDRIVE_CLIENT_SECRET = process.env.GDRIVE_CLIENT_SECRET;
const GDRIVE_REFRESH_TOKEN = process.env.GDRIVE_REFRESH_TOKEN;
const GDRIVE_EXCEL_FOLDER_ID = process.env.GDRIVE_EXCEL_FOLDER_ID;

if (
  !SUPABASE_DB_URL ||
  !GDRIVE_EXCEL_FOLDER_ID ||
  !GDRIVE_CLIENT_ID ||
  !GDRIVE_CLIENT_SECRET ||
  !GDRIVE_REFRESH_TOKEN
) {
  console.error("Missing required environment variables for PostgreSQL/Google Drive.");
  process.exit(1);
}

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


/**
 * Format cell values for Excel readability.
 */
function formatCellValue(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value) || typeof value === "object") {
    return JSON.stringify(value);
  }
  return value;
}

/**
 * Build the Excel workbook with one sheet per table.
 */
async function buildExcelWorkbook(client) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SS Logistics Backup";
  workbook.created = new Date();

  for (const table of TABLES) {
    console.log(`  Fetching: ${table}`);
    const sheetName = table.length > 31 ? table.substring(0, 31) : table;
    const sheet = workbook.addWorksheet(sheetName);

    let lastId = null;
    let hasMore = true;
    let totalRows = 0;
    let columns = null;

    while (hasMore) {
      let query;
      let params;

      if (lastId === null) {
        query = `SELECT * FROM public."${table}" ORDER BY id ASC LIMIT 1000`;
        params = [];
      } else {
        query = `SELECT * FROM public."${table}" WHERE id > $1 ORDER BY id ASC LIMIT 1000`;
        params = [lastId];
      }

      try {
        const result = await client.query(query, params);
        const rows = result.rows;

        if (rows.length === 0) {
          hasMore = false;
          break;
        }

        if (totalRows === 0) {
          columns = Object.keys(rows[0]);
          sheet.columns = columns.map((col) => ({
            header: col,
            key: col,
            width: Math.max(col.length + 2, 15),
          }));

          const headerRow = sheet.getRow(1);
          headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
          headerRow.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF2563EB" },
          };
          headerRow.alignment = { vertical: "middle", horizontal: "center" };
        }

        for (const row of rows) {
          const values = columns.map((col) => formatCellValue(row[col]));
          sheet.addRow(values);
        }

        totalRows += rows.length;
        lastId = rows[rows.length - 1].id;
      } catch (err) {
        console.error(`  Error fetching ${table}:`, err.message);
        hasMore = false;
      }
    }

    console.log(`    → ${totalRows} rows`);

    if (totalRows === 0) {
      sheet.addRow(["(no data)"]);
    } else {
      // Auto-filter on all columns
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: columns.length },
      };
    }
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
  const pad = (n) => n.toString().padStart(2, "0");
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}h${pad(now.getMinutes())}m${pad(now.getSeconds())}s`;
  const fileName = `ss-logistics-data_${dateStr}_${timeStr}.xlsx`;

  // Connect directly to PostgreSQL (same approach as backup.js)
  const client = new Client({
    connectionString: SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log("Connecting to database...");
    await client.connect();
    console.log("Connected ✓\n");

    console.log("========= [1/2] Exporting tables to Excel =========");
    const workbook = await buildExcelWorkbook(client);
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
  } finally {
    await client.end();
  }
}

main();
