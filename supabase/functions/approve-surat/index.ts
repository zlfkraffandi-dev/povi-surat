import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const APPROVED_FOLDER_BY_KATEGORI: Record<string, string> = {
  permohonan: "1RX0ORVa0ssDbbkFvYdkLuIsUqa9WGuJv",
  undangan: "1zwms_tUyCOsun-qrzLDKLqPENYzdJh9o",
};

const KODE_KATEGORI: Record<string, string> = { permohonan: "01", undangan: "02", sertifikat: "03" };
const BULAN_ROMAWI = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
const BULAN_INDONESIA = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

function formatTanggalSurat(date: Date): string {
  return `${date.getDate()} ${BULAN_INDONESIA[date.getMonth()]} ${date.getFullYear()}`;
}

async function generateNomorSurat(supabase: any, jenisKop: string, kategoriSurat: string) {
  const kode = KODE_KATEGORI[kategoriSurat];
  if (!kode) throw new Error(`kategori_surat harus salah satu dari: permohonan, undangan, sertifikat (dapat: ${kategoriSurat})`);
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const monthPadded = String(month).padStart(2, "0");
  const periode = jenisKop === "FS" ? now.toISOString().slice(0, 10) : `${year}-${monthPadded}`;
  const { data: count, error } = await supabase.rpc("increment_surat_counter", { p_jenis_kop: jenisKop, p_kode: kode, p_periode: periode });
  if (error) throw error;
  if (jenisKop === "FS") {
    return `${day}.${month}.${count}/POVI/${kode}/${year}`;
  }
  const nomorPadded = String(count).padStart(3, "0");
  return `${nomorPadded}/POVI/${kode}/${BULAN_ROMAWI[month - 1]}/${year}`;
}

async function resolveSheetName(accessToken: string): Promise<string> {
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_MONITORING}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const meta = await metaRes.json();
  if (!metaRes.ok) throw new Error(`Gagal ambil daftar sheet: ${JSON.stringify(meta)}`);
  const titles: string[] = (meta.sheets || []).map((s: any) => s.properties.title);

  for (const title of titles) {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_MONITORING}/values/${encodeURIComponent(`'${title}'!A1`)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await res.json();
    if (data.values?.[0]?.[0] === "Timestamp Submit") return title;
  }
  throw new Error(`Tidak ada tab dengan header "Timestamp Submit" di kolom A1. Tab yang ada: ${titles.join(", ")}`);
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  try {
    const { docId, namaSurat, templateSlug, jenis_kop, kategori_surat, skipDateFill, lampiran, nomorSurat: existingNomorSurat } = await req.json();
    const approvedTargetFolder = APPROVED_FOLDER_BY_KATEGORI[kategori_surat];
    if (!approvedTargetFolder) {
      return new Response(JSON.stringify({ error: `Folder APPROVED belum disiapkan untuk kategori "${kategori_surat}"` }), { status: 400, headers: CORS_HEADERS });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // skipDateFill means the request already went through "Proses TTD" —
    // mark-ttd already assigned the real nomor surat (same atomic counter)
    // and wrote it + the date into the doc. Generating a second number here
    // would desync the DB from what's actually printed on the document.
    const nomorSurat = skipDateFill && existingNomorSurat
      ? existingNomorSurat
      : await generateNomorSurat(supabase, jenis_kop, kategori_surat);

    const accessToken = await getAccessToken();
    const SHEET_NAME = await resolveSheetName(accessToken);

    const fillRequests = skipDateFill ? [] : [
      { replaceAllText: { containsText: { text: "{{TANGGAL_SURAT}}", matchCase: true }, replaceText: formatTanggalSurat(new Date()) } },
      { replaceAllText: { containsText: { text: "{{TANGGAL_BULAN_TAHUN}}", matchCase: true }, replaceText: formatTanggalSurat(new Date()) } },
      { replaceAllText: { containsText: { text: "{{NOMOR_SURAT}}", matchCase: true }, replaceText: nomorSurat } },
    ];
    if (fillRequests.length > 0) {
      await fetch(
        `https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ requests: fillRequests }),
        }
      );
    }

    // Rename uploaded requester attachments (still carrying their placeholder
    // "LAMPIRAN_(ONPROSES)_..." temp name) to the final numbered pattern now
    // that nomor surat is known. Bukti TTD uploads (already named
    // LAMPIRAN_SEKRETARIS_... in their own dedicated folder) and pasted links
    // are left untouched.
    let renamedLampiran = lampiran;
    if (Array.isArray(lampiran) && lampiran.length > 0) {
      let n = 0;
      renamedLampiran = await Promise.all(
        lampiran.map(async (item: any) => {
          if (item.type !== "file" || !item.driveFileId || !item.name?.startsWith("LAMPIRAN_(ONPROSES)_")) return item;
          n += 1;
          const ext = item.name?.includes(".") ? item.name.slice(item.name.lastIndexOf(".")) : "";
          const newName = `LAMPIRAN_${n}_${namaSurat} - ${nomorSurat}${ext}`;
          await fetch(`https://www.googleapis.com/drive/v3/files/${item.driveFileId}`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ name: newName }),
          });
          return { ...item, name: newName };
        })
      );
    }

    const exportRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${docId}/export?mimeType=application/pdf`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const pdfBytes = new Uint8Array(await exportRes.arrayBuffer());

    const boundary = `povi_${crypto.randomUUID()}`;
    const encoder = new TextEncoder();
    const metadata = {
      name: `${namaSurat} - ${nomorSurat}.pdf`,
      parents: [approvedTargetFolder],
    };
    const preamble = encoder.encode(
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/pdf\r\n\r\n`
    );
    const closing = encoder.encode(`\r\n--${boundary}--`);
    const uploadBody = new Uint8Array(preamble.length + pdfBytes.length + closing.length);
    uploadBody.set(preamble, 0);
    uploadBody.set(pdfBytes, preamble.length);
    uploadBody.set(closing, preamble.length + pdfBytes.length);

    const uploadRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: uploadBody,
      }
    );
    const uploadData = await uploadRes.json();
    const pdfFileId = uploadData.id;
    const pdfUrl = `https://drive.google.com/file/d/${pdfFileId}/view`;
    const pdfFileName = metadata.name;
    const pdfLinkFormula = `=HYPERLINK("${pdfUrl}","${pdfFileName.replace(/"/g, "'")}")`;

    const getRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_MONITORING}/values/${encodeURIComponent(`'${SHEET_NAME}'!M:M`)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const getData = await getRes.json();
    if (!getRes.ok) throw new Error(`Gagal baca sheet monitoring: ${JSON.stringify(getData)}`);
    const rows: string[][] = getData.values || [];
    const rowIndex = rows.findIndex((row) => row[0] === docId);
    if (rowIndex === -1) {
      return new Response(
        JSON.stringify({ error: `Dokumen ${docId} tidak ditemukan di sheet monitoring` }),
        { status: 404, headers: CORS_HEADERS }
      );
    }
    const rowNumber = rowIndex + 1;

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_MONITORING}/values:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          valueInputOption: "USER_ENTERED",
          data: [
            { range: `'${SHEET_NAME}'!B${rowNumber}`, values: [[nomorSurat]] },
            { range: `'${SHEET_NAME}'!H${rowNumber}`, values: [["APPROVED"]] },
            { range: `'${SHEET_NAME}'!L${rowNumber}`, values: [[pdfLinkFormula]] },
          ],
        }),
      }
    );

    return new Response(
      JSON.stringify({ success: true, nomor_surat: nomorSurat, pdf_file_id: pdfFileId, pdf_url: pdfUrl, lampiran: renamedLampiran }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS_HEADERS });
  }
});
