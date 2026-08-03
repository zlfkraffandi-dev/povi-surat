import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

async function getAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!,
      refresh_token: Deno.env.get("GOOGLE_OAUTH_REFRESH_TOKEN")!,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gagal refresh access token: ${JSON.stringify(data)}`);
  return data.access_token;
}

const SHEET_MONITORING = "1bzY2CCADuabSUYTZMd6v_P9Re7LauB2T-A4D7u5q7aU";

const PROGRESS_FOLDER_BY_KATEGORI: Record<string, string> = {
  permohonan: "1AKNLNZWHPGhntESGyGuyDhhE5IusESPG",
  undangan: "1I6Ej9ELLN0Wnjwn8ZOyTuO72rXa9NZy-",
};

function toWaLink(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  const normalized = digits.startsWith("0") ? "62" + digits.slice(1) : digits.startsWith("62") ? digits : "62" + digits;
  return `https://wa.me/${normalized}`;
}

const HARI_INDONESIA = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
const BULAN_INDONESIA = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

function formatTimestamp(date: Date): string {
  const hari = HARI_INDONESIA[date.getDay()];
  const tanggal = date.getDate();
  const bulan = BULAN_INDONESIA[date.getMonth()];
  const tahun = date.getFullYear();
  const jam = String(date.getHours()).padStart(2, "0");
  const menit = String(date.getMinutes()).padStart(2, "0");
  return `${hari}, ${tanggal} ${bulan} ${tahun} ${jam}:${menit}`;
}

function formatTanggalPendek(date: Date): string {
  return `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
}

async function resolveSheetName(accessToken: string): Promise<{ title: string; sheetId: number }> {
  const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_MONITORING}?fields=sheets.properties`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const meta = await metaRes.json();
  if (!metaRes.ok) throw new Error(`Gagal ambil daftar sheet: ${JSON.stringify(meta)}`);
  const sheets = meta.sheets || [];
  for (const s of sheets) {
    const title = s.properties.title;
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_MONITORING}/values/${encodeURIComponent(`'${title}'!A1`)}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await res.json();
    if (data.values?.[0]?.[0] === "Timestamp Submit") return { title, sheetId: s.properties.sheetId };
  }
  throw new Error(`Tidak ada tab dengan header "Timestamp Submit" di kolom A1. Tab yang ada: ${sheets.map((s: any) => s.properties.title).join(", ")}`);
}

const CORS_HEADERS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

// Fills a document's first table with the given rows. Each cell may already
// contain literal placeholder text (e.g. {{NAMA_BARANG}}) instead of being
// empty — that text is deleted before the real value is inserted. Rows/cols
// are processed in reverse so earlier index shifts never affect cells still
// to be filled. `colOffset` skips leading non-placeholder columns.
async function fillDocTable(documentId: string, accessToken: string, dataRows: Record<string, string>[], columnKeys: string[], colOffset = 0) {
  const getDoc = () => fetch(`https://docs.googleapis.com/v1/documents/${documentId}`, { headers: { Authorization: `Bearer ${accessToken}` } }).then((r) => r.json());
  let doc = await getDoc();
  let tableEl = doc.body.content.find((el: any) => el.table);
  if (!tableEl) return;
  const existingDataRows = tableEl.table.tableRows.length - 1;
  if (dataRows.length > existingDataRows) {
    const lastRowIdx = tableEl.table.tableRows.length - 1;
    const insertReqs = Array.from({ length: dataRows.length - existingDataRows }, () => ({
      insertTableRow: { tableCellLocation: { tableStartLocation: { index: tableEl.startIndex }, rowIndex: lastRowIdx, columnIndex: 0 }, insertBelow: true },
    }));
    await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ requests: insertReqs }),
    });
    doc = await getDoc();
    tableEl = doc.body.content.find((el: any) => el.table);
  }
  const fillReqs: any[] = [];
  for (let r = dataRows.length - 1; r >= 0; r--) {
    const tableRow = tableEl.table.tableRows[r + 1];
    for (let c = columnKeys.length - 1; c >= 0; c--) {
      const value = dataRows[r][columnKeys[c]];
      const cellPara = tableRow.tableCells[c + colOffset].content[0];
      const cellStart = cellPara.startIndex;
      const cellEnd = cellPara.endIndex - 1;
      if (cellEnd > cellStart) {
        fillReqs.push({ deleteContentRange: { range: { startIndex: cellStart, endIndex: cellEnd } } });
      }
      if (value) fillReqs.push({ insertText: { text: value, location: { index: cellStart } } });
    }
  }
  if (fillReqs.length > 0) {
    await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ requests: fillReqs }),
    });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  try {
    const { template_doc_id, template_slug, jenis_kop, jenis_surat, kategori_surat, requester, divisi, pic_phone, placeholders, due_date, table_data, notes } = await req.json();

    if (jenis_kop !== "FS" && jenis_kop !== "POVI") {
      return new Response(JSON.stringify({ error: "jenis_kop harus 'FS' atau 'POVI'" }), { status: 400, headers: CORS_HEADERS });
    }
    const targetFolder = PROGRESS_FOLDER_BY_KATEGORI[kategori_surat];
    if (!targetFolder) {
      return new Response(JSON.stringify({ error: `Folder PROGRESS belum disiapkan untuk kategori "${kategori_surat}"` }), { status: 400, headers: CORS_HEADERS });
    }

    const accessToken = await getAccessToken();
    const { title: SHEET_NAME, sheetId } = await resolveSheetName(accessToken);

    const now = new Date();
    const docCopyName = `(ONPROSES) - ${jenis_surat} - ${requester} - ${formatTanggalPendek(now)}`;

    const copyRes = await fetch(`https://www.googleapis.com/drive/v3/files/${template_doc_id}/copy`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: docCopyName, parents: [targetFolder] }),
    });
    const copyData = await copyRes.json();
    if (!copyRes.ok || !copyData.id) {
      throw new Error(`Gagal copy template doc: ${copyRes.status} ${JSON.stringify(copyData)}`);
    }
    const newDocId = copyData.id;

    if (placeholders && Object.keys(placeholders).length > 0) {
      const requests = Object.entries(placeholders).map(([key, value]) => ({
        replaceAllText: { containsText: { text: `{{${key}}}`, matchCase: true }, replaceText: String(value) },
      }));
      await fetch(`https://docs.googleapis.com/v1/documents/${newDocId}:batchUpdate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ requests }),
      });
    }

    if (Array.isArray(table_data) && table_data.length > 0) {
      if (table_data[0].jamMulai !== undefined) {
        const rundownRows = table_data.map((row: Record<string, string>) => ({
          waktu: `${row.jamMulai || ""}-${row.jamSelesai || ""}`,
          kegiatan: row.kegiatan || "",
        }));
        await fillDocTable(newDocId, accessToken, rundownRows, ["waktu", "kegiatan"]);
      } else if (table_data[0].namaBarang !== undefined) {
        // Peminjaman Barang: doc's "No." column is filled with a running row
        // number by us too, rather than relying on static "1."/"2." text in
        // the template (which wouldn't auto-increment as rows are added).
        const barangRows = table_data.map((row: Record<string, string>, i: number) => ({ no: String(i + 1), ...row }));
        await fillDocTable(newDocId, accessToken, barangRows, ["no", "namaBarang", "jumlahHari", "jumlahBarang"]);
      }
    }

    const insertRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_MONITORING}:batchUpdate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{
          insertDimension: {
            range: { sheetId, dimension: "ROWS", startIndex: 1, endIndex: 2 },
            inheritFromBefore: false,
          },
        }],
      }),
    });
    if (!insertRes.ok) {
      throw new Error(`Gagal insert baris sheet monitoring: ${JSON.stringify(await insertRes.json())}`);
    }

    const docUrl = `https://docs.google.com/document/d/${newDocId}/edit`;
    const docLinkFormula = `=HYPERLINK("${docUrl}","${docCopyName.replace(/"/g, "'")}")`;
    const updateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_MONITORING}/values/${encodeURIComponent(`'${SHEET_NAME}'!A2:M2`)}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          values: [[
            formatTimestamp(now),
            "",
            requester,
            divisi || "",
            pic_phone ? toWaLink(pic_phone) : "",
            jenis_kop,
            jenis_surat,
            "PENDING",
            due_date,
            notes || "",
            docLinkFormula,
            "",
            newDocId,
          ]],
        }),
      }
    );
    if (!updateRes.ok) {
      throw new Error(`Gagal update sheet monitoring: ${JSON.stringify(await updateRes.json())}`);
    }

    return new Response(
      JSON.stringify({ success: true, doc_id: newDocId }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS_HEADERS });
  }
});
