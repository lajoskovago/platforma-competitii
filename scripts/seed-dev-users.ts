/**
 * LOCAL DEVELOPMENT ONLY: creates demo accounts (password "Parola123!") for
 * every role, plus a few national-championship teams.
 *   npm run seed:dev-users
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!/127\.0\.0\.1|localhost/.test(url)) {
  console.error("Refusing to run against a non-local Supabase.");
  process.exit(1);
}
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
const PASSWORD = "Parola123!";

type Scope = "regional" | "national";
type U = {
  email: string;
  name: string;
  phone: string;
  role?: "master_admin" | "regional_admin";
  region?: "SR5" | "SR6";
  referee?: boolean;
  table?: boolean;
  teams?: [Scope, string, string][]; // scope, category code, team name
  clubs?: string[];
};

// national teams for testing [club, category code, team name]
const NATIONAL_TEAMS: [string, string, string][] = [
  ["U-BT", "L1M", "U-BT Cluj"],
  ["LPS Satu Mare", "U16M", "LPS Satu Mare"],
  ["Valbon Arad", "U16M", "Valbon Arad"],
];

const users: U[] = [
  { email: "admin@test.local", name: "Admin Principal", phone: "0700000000", role: "master_admin" },
  { email: "sr5@test.local", name: "Admin Regional SR5", phone: "0700000005", role: "regional_admin", region: "SR5" },
  { email: "sr6@test.local", name: "Admin Regional SR6", phone: "0700000006", role: "regional_admin", region: "SR6" },
  {
    email: "lps.satumare@test.local",
    name: "Antrenor LPS Satu Mare",
    phone: "0711111111",
    teams: [["regional", "U10M", "LPS Satu Mare"], ["regional", "U12M", "LPS Satu Mare"], ["national", "U16M", "LPS Satu Mare"]],
  },
  {
    email: "css.sighet@test.local",
    name: "Antrenor CSS Sighet",
    phone: "0722222222",
    teams: [["regional", "U10M", "CSS Sighet"], ["regional", "U12M", "CSS Sighet"]],
  },
  { email: "star@test.local", name: "Admin Club ACS Baschet Star", phone: "0733333333", clubs: ["ACS Baschet Star"] },
  { email: "ubt@test.local", name: "Admin Club U-BT", phone: "0744444444", clubs: ["U-BT"] },
  { email: "arbitru5@test.local", name: "Ion Arbitru (SR5)", phone: "0755555551", region: "SR5", referee: true },
  { email: "arbitru5b@test.local", name: "Maria Arbitru (SR5)", phone: "0755555552", region: "SR5", referee: true, table: true },
  { email: "oficial5@test.local", name: "Dan Oficial (SR5)", phone: "0755555553", region: "SR5", table: true },
  { email: "arbitru6@test.local", name: "Vlad Arbitru (SR6)", phone: "0766666661", region: "SR6", referee: true },
];

async function teamId(scope: Scope, code: string, name: string) {
  const { data } = await admin
    .from("teams")
    .select("id, categories!inner(code, scope)")
    .eq("name", name)
    .eq("categories.code", code)
    .eq("categories.scope", scope)
    .maybeSingle();
  return data?.id as string | undefined;
}

async function main() {
  for (const [club, code, name] of NATIONAL_TEAMS) {
    if (await teamId("national", code, name)) continue;
    const { data: c } = await admin.from("clubs").select("id").eq("name", club).single();
    const { data: cat } = await admin.from("categories").select("id").eq("scope", "national").eq("code", code).single();
    if (c && cat) await admin.from("teams").insert({ club_id: c.id, category_id: cat.id, name });
  }

  for (const u of users) {
    let { data: p } = await admin.from("profiles").select("id").eq("email", u.email).maybeSingle();
    if (!p) {
      const { data, error } = await admin.auth.admin.createUser({
        email: u.email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: u.name },
      });
      if (error) throw error;
      p = { id: data.user.id };
    }
    const { error: upErr } = await admin
      .from("profiles")
      .update({
        full_name: u.name,
        phone: u.phone,
        role: u.role ?? "user",
        region: u.region ?? null,
        is_referee: !!u.referee,
        is_table_official: !!u.table,
      })
      .eq("id", p.id);
    if (upErr) throw upErr;

    for (const [scope, code, name] of u.teams ?? []) {
      const id = await teamId(scope, code, name);
      if (id) await admin.from("team_coaches").upsert({ team_id: id, user_id: p.id });
    }
    for (const clubName of u.clubs ?? []) {
      const { data: c } = await admin.from("clubs").select("id").eq("name", clubName).single();
      if (c) await admin.from("club_managers").upsert({ club_id: c.id, user_id: p.id });
    }
    console.log(`${u.email.padEnd(26)} ${u.name}`);
  }
  console.log(`\nPassword for all: ${PASSWORD}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
