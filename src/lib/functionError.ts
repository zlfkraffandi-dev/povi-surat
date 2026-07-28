// supabase.functions.invoke() only gives a generic "non-2xx status code" message by default;
// the actual error detail our edge functions return lives in the response body (fnError.context).
export async function getFunctionErrorMessage(fnError: any, fallback: string): Promise<string> {
  try {
    const body = await fnError?.context?.json?.()
    if (body?.error) return sanitizeErrorMessage(body.error, fallback)
  } catch {}
  const raw = fnError?.message || fallback
  return sanitizeErrorMessage(raw, fallback)
}

// Strips technical noise (stack traces, API tokens, internal errors) so end
// users see a human-readable message instead of raw infra output.
export function sanitizeErrorMessage(raw: string, fallback: string): string {
  const techPatterns = [
    /invalid_grant/i,
    /refresh.*token/i,
    /ECONNREFUSED/i,
    /ETIMEDOUT/i,
    /socket hang up/i,
    /network.*error/i,
    /500 Internal Server/i,
    /503 Service Unavailable/i,
    /upstream/i,
    /stack.*trace/i,
    /at\s+\w+\s+\(/i,
  ]
  if (techPatterns.some((p) => p.test(raw))) {
    return `${fallback} Coba lagi dalam beberapa saat. Jika masalah berlanjut, hubungi sekretaris.`
  }
  return raw
}
