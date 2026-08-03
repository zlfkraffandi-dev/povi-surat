import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
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

async function resolveSheet(accessToken: string): Promise<{ title: string; id: number } | null> {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_MONITORING}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) return null;
  for (const sheet of data.sheets || []) {
    const title = sheet.properties.title;
    const header = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_MONITORING}/values/${encodeURIComponent(`'${title}'!A1`)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then((r) => r.json());
    if (header.values?.[0]?.[0] === "Timestamp Submit") return { title, id: sheet.properties.sheetId };
  }
  return null;
}

async function deleteDriveFile(accessToken: string, fileId: string) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404) console.error(`Gagal menghapus file Drive ${fileId}: ${res.status}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const secret = req.headers.get("x-cron-secret");
  if (secret !== Deno.env.get("CRON_SECRET")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });
  }

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: expired } = await supabase
      .from("letter_requests")
      .select("id, google_doc_id, drive_file_id, lampiran")
      .not("archived_at", "is", null)
      .lt("archived_at", cutoff);

    if (!expired || expired.length === 0) {
      return new Response(JSON.stringify({ purged: 0 }), { headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const accessToken = await getAccessToken();
    const sheet = await resolveSheet(accessToken);
    let purged = 0;

    for (const letter of expired) {
      if (sheet && letter.google_doc_id) {
        const values = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_MONITORING}/values/${encodeURIComponent(`'${sheet.title}'!M:M`)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((r) => r.json());
        const rowIndex = (values.values || []).findIndex((row: string[]) => row[0] === letter.google_doc_id);
        if (rowIndex > 0) {
          await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_MONITORING}:batchUpdate`, {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ requests: [{ deleteDimension: { range: { sheetId: sheet.id, dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex + 1 } } }] }),
          });
        }
      }

      const fileIds = new Set<string>([letter.google_doc_id, letter.drive_file_id].filter(Boolean));
      for (const item of Array.isArray(letter.lampiran) ? letter.lampiran : []) {
        if (item?.type === "file" && item.driveFileId) fileIds.add(item.driveFileId);
      }
      for (const fileId of fileIds) await deleteDriveFile(accessToken, fileId);

      await supabase.from("letter_requests").delete().eq("id", letter.id);
      purged++;
    }

    return new Response(JSON.stringify({ purged }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
});
