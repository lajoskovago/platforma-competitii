/**
 * Creates (or promotes) an administrator account.
 *   npm run create-admin -- email@example.com "Nume Prenume" [parola]
 * Without a password an invitation email is sent instead.
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from .env.local.
 */
import { createClient } from "@supabase/supabase-js";

const [email, fullName = "", password] = process.argv.slice(2);
if (!email) {
  console.error('Usage: npm run create-admin -- email@example.com "Nume Prenume" [parola]');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY (.env.local)");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  let id = existing?.id as string | undefined;

  if (!id) {
    const res = password
      ? await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } })
      : await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName } });
    if (res.error) throw res.error;
    id = res.data.user!.id;
    console.log(password ? `Created ${email}` : `Invitation sent to ${email}`);
  }

  const { error } = await admin
    .from("profiles")
    .update({ role: "master_admin", ...(fullName ? { full_name: fullName } : {}) })
    .eq("id", id);
  if (error) throw error;
  console.log(`${email} is now the master administrator.`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
