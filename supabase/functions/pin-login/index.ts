// Supabase Edge Function: individual 4-digit PIN login.
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APP_ORIGIN.
// Never bundle the service-role key into the browser app.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.3";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const allowedOrigins = (Deno.env.get("APP_ORIGIN") ?? "https://doughflow.soothingrainofficial.workers.dev")
  .split(",").map((s) => s.trim()).filter(Boolean);

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

function responseJson(status: number, body: Record<string, unknown>, origin = "") {
  const permitted = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] ?? "null";
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Pragma": "no-cache",
      "Access-Control-Allow-Origin": permitted,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
      "Vary": "Origin",
    },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  if (req.method === "OPTIONS") {
    const permitted = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] ?? "null";
    return new Response(null, {status:204, headers:{
      "Access-Control-Allow-Origin": permitted,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    }});
  }
  if (origin && !allowedOrigins.includes(origin)) return responseJson(403, { error: "Origin not allowed" }, origin);
  if (req.method !== "POST") return responseJson(405, { error: "Method not allowed" }, origin);
  if (!supabaseUrl || !serviceKey) return responseJson(500, { error: "PIN login is not configured on the server" }, origin);

  let body: { username?: unknown; pin?: unknown };
  try { body = await req.json(); } catch { return responseJson(400, { error: "Invalid request" }, origin); }

  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const pin = typeof body.pin === "string" ? body.pin : "";
  if (!/^[a-z0-9][a-z0-9._-]{1,31}$/.test(username) || !/^\d{4}$/.test(pin)) {
    return responseJson(400, { error: "Enter a username and a four-digit PIN" }, origin);
  }

  const { data: rows, error: verifyError } = await admin.rpc("verify_pin_login", {
    p_alias: username,
    p_pin: pin,
  });
  if (verifyError) {
    console.error("PIN verification service failure:", verifyError.message);
    return responseJson(500, { error: "PIN login service unavailable" }, origin);
  }

  const result = Array.isArray(rows) ? rows[0] : rows;
  if (!result?.success) {
    const lockedUntil = result?.retry_after ? Date.parse(result.retry_after) : 0;
    if (lockedUntil > Date.now()) {
      const seconds = Math.max(1, Math.ceil((lockedUntil - Date.now()) / 1000));
      return responseJson(429, { error: "Too many attempts. Try again later.", retryAfterSeconds: seconds }, origin);
    }
    return responseJson(401, { error: "Username or PIN is incorrect" }, origin);
  }

  // The PIN is validated server-side; the one-time magic-link token exchanges
  // for a normal Supabase session, preserving the existing RLS model.
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: result.authenticated_email,
  });
  const tokenHash = linkData?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    console.error("PIN session issuance failure:", linkError?.message ?? "Missing token hash");
    return responseJson(500, { error: "Could not start a secure session" }, origin);
  }

  return responseJson(200, { token_hash: tokenHash, type: "magiclink" }, origin);
});
