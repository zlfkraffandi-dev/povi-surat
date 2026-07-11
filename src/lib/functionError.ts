// supabase.functions.invoke() only gives a generic "non-2xx status code" message by default;
// the actual error detail our edge functions return lives in the response body (fnError.context).
export async function getFunctionErrorMessage(fnError: any, fallback: string): Promise<string> {
  try {
    const body = await fnError?.context?.json?.()
    if (body?.error) return body.error
  } catch {}
  return fnError?.message || fallback
}
