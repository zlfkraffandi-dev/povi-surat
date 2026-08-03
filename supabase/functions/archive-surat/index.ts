import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Tidak terautentikasi." }), { status: 401, headers: CORS });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user }, error: userError } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (userError || !user) return new Response(JSON.stringify({ error: "Sesi tidak valid." }), { status: 401, headers: CORS });

    const { data: profile } = await supabase.from("users").select("is_sekretaris").eq("id", user.id).single();
    if (!profile?.is_sekretaris) return new Response(JSON.stringify({ error: "Hanya sekretaris yang dapat mengarsipkan surat." }), { status: 403, headers: CORS });

    const { id } = await req.json();
    if (!id) return new Response(JSON.stringify({ error: "ID surat wajib diisi." }), { status: 400, headers: CORS });

    const { data: letter } = await supabase.from("letter_requests").select("status").eq("id", id).single();
    if (!letter) return new Response(JSON.stringify({ error: "Surat tidak ditemukan." }), { status: 404, headers: CORS });
    if (!["pending", "revisi"].includes(letter.status)) {
      return new Response(JSON.stringify({ error: "Surat hanya bisa diarsipkan saat status Pending atau Revisi." }), { status: 403, headers: CORS });
    }

    const { error } = await supabase.from("letter_requests").update({ archived_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
});
