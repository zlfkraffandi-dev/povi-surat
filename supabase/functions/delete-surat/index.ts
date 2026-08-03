import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SHEET_MONITORING = "1bzY2CCADuabSUYTZMd6v_P9Re7LauB2T-A4D7u5q7aU";

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
  if (!res.ok) throw new Error(`Gagal autentikasi Google: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function resolveSheet(accessToken: string): Promise<{ title: string; id: number }> {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_MONITORING}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Gagal membaca Google Sheet: ${JSON.stringify(data)}`);
  for (const sheet of data.sheets || []) {
    const title = sheet.properties.title;
    const header = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_MONITORING}/values/${encodeURIComponent(`'${title}'!A1`)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then((r) => r.json());
    if (header.values?.[0]?.[0] === "Timestamp Submit") return { title, id: sheet.properties.sheetId };
  }
  throw new Error("Tab monitoring surat tidak ditemukan.");
}

async function deleteDriveFile(accessToken: string, fileId: string) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404) throw new Error(`Gagal menghapus file Drive ${fileId}.`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Tidak terautentikasi." }), { status: 401, headers: CORS_HEADERS });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = auth.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return new Response(JSON.stringify({ error: "Sesi tidak valid." }), { status: 401, headers: CORS_HEADERS });

    const { data: profile } = await supabase.from("users").select("is_sekretaris").eq("id", user.id).single();
    if (!profile?.is_sekretaris) return new Response(JSON.stringify({ error: "Hanya sekretaris yang dapat menghapus surat." }), { status: 403, headers: CORS_HEADERS });

    const { id } = await req.json();
    if (!id) return new Response(JSON.stringify({ error: "ID surat wajib diisi." }), { status: 400, headers: CORS_HEADERS });
    const { data: letter, error: letterError } = await supabase.from("letter_requests").select("google_doc_id, drive_file_id, lampiran, status").eq("id", id).single();
    if (letterError || !letter) return new Response(JSON.stringify({ error: "Surat tidak ditemukan." }), { status: 404, headers: CORS_HEADERS });
    if (!["pending", "revisi"].includes(letter.status)) return new Response(JSON.stringify({ error: "Surat hanya bisa dihapus saat status Pending atau Revisi." }), { status: 403, headers: CORS_HEADERS });

    const accessToken = await getAccessToken();
    if (letter.google_doc_id) {
      const sheet = await resolveSheet(accessToken);
      const values = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_MONITORING}/values/${encodeURIComponent(`'${sheet.title}'!M:M`)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then((r) => r.json());
      const rowIndex = (values.values || []).findIndex((row: string[]) => row[0] === letter.google_doc_id);
      if (rowIndex > 0) {
        const sheetRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_MONITORING}:batchUpdate`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ requests: [{ deleteDimension: { range: { sheetId: sheet.id, dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex + 1 } } }] }),
        });
        if (!sheetRes.ok) throw new Error("Gagal menghapus baris Google Sheet.");
      }
    }

    const fileIds = new Set<string>([letter.google_doc_id, letter.drive_file_id].filter(Boolean));
    for (const item of Array.isArray(letter.lampiran) ? letter.lampiran : []) {
      if (item?.type === "file" && item.driveFileId) fileIds.add(item.driveFileId);
    }
    for (const fileId of fileIds) await deleteDriveFile(accessToken, fileId);

    const { error: deleteError } = await supabase.from("letter_requests").delete().eq("id", id);
    if (deleteError) throw deleteError;
    return new Response(JSON.stringify({ success: true }), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS_HEADERS });
  }
});
