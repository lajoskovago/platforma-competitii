import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Chips } from "@/components/game-list";
import { Badge, Card, Field, PageTitle, SectionTitle, inputClass } from "@/components/ui";
import { UserRoleFields } from "@/components/user-role-fields";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, sevenDaysAgo } from "@/lib/format";
import { createSupabaseAdmin, createSupabaseServer } from "@/lib/supabase/server";
import { inviteUser } from "../actions";

const TYPES = [
  { key: "", label: "Toți" },
  { key: "new", label: "Noi (7 zile)" },
  { key: "admin", label: "Administratori" },
  { key: "club", label: "Admin club" },
  { key: "coach", label: "Antrenori" },
  { key: "referee", label: "Arbitri" },
  { key: "table", label: "Oficiali de masă" },
];

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/utilizatori">) {
  const me = await requireAdmin();
  const { q = "", tip = "" } = (await searchParams) as Record<string, string | undefined>;
  const supabase = await createSupabaseServer();
  const admin = createSupabaseAdmin();

  const [{ data: profiles }, { data: coaches }, { data: managers }, { data: authUsers }, { data: clubs }] = await Promise.all([
    supabase.from("profiles").select("*").order("full_name"),
    supabase.from("team_coaches").select("user_id, team:teams(name, category:categories(code, scope))"),
    supabase.from("club_managers").select("user_id, club:clubs(name)"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    supabase.from("clubs").select("id, name").order("name"),
  ]);

  const lastSignIn = new Map((authUsers?.users ?? []).map((u) => [u.id, u.last_sign_in_at]));
  const needle = q.toLowerCase();
  const weekAgo = sevenDaysAgo();
  const list = (profiles ?? []).filter((p) => {
    if (needle && !p.full_name.toLowerCase().includes(needle) && !p.email.toLowerCase().includes(needle)) return false;
    if (tip === "new") return new Date(p.created_at).getTime() > weekAgo;
    if (tip === "admin") return p.role !== "user";
    if (tip === "club") return (managers ?? []).some((m) => m.user_id === p.id);
    if (tip === "coach") return (coaches ?? []).some((c) => c.user_id === p.id);
    if (tip === "referee") return p.is_referee;
    if (tip === "table") return p.is_table_official;
    return true;
  });
  if (tip === "new") list.sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <>
      <PageTitle sub={`${profiles?.length ?? 0} conturi`}>Utilizatori</PageTitle>

      <Card>
        <details>
          <summary className="cursor-pointer py-1 font-semibold text-orange-700">+ Invită un utilizator</summary>
          <ActionForm action={inviteUser} className="mt-3 space-y-3">
            <Field label="Email">
              <input name="email" type="email" required className={inputClass} />
            </Field>
            <Field label="Nume și prenume">
              <input name="full_name" required className={inputClass} />
            </Field>
            <Field label="Telefon (opțional)">
              <input name="phone" type="tel" className={inputClass} />
            </Field>
            <Field label="Administrator de club (opțional)" hint="Poate adăuga antrenori și organiza pentru echipele clubului">
              <select name="club_id" defaultValue="" className={inputClass}>
                <option value="">— nu —</option>
                {(clubs ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <UserRoleFields isMaster={me.isMaster} />
            <p className="text-xs text-slate-500">
              Utilizatorul primește un email cu un link pentru a-și seta parola. Echipele (pentru antrenori) se asociază
              după creare.
            </p>
            <SubmitButton>Trimite invitația</SubmitButton>
          </ActionForm>
        </details>
      </Card>

      <p className="mt-3 text-sm text-slate-600">
        Arbitrii și oficialii se pot înregistra singuri la{" "}
        <Link href="/inregistrare-oficiali" className="text-orange-700 underline">
          /inregistrare-oficiali
        </Link>
        .
      </p>

      <SectionTitle>Conturi</SectionTitle>
      <Chips
        items={TYPES}
        active={tip}
        href={(k) => {
          const p = new URLSearchParams();
          if (k) p.set("tip", k);
          if (q) p.set("q", q);
          const s = p.toString();
          return s ? `/admin/utilizatori?${s}` : "/admin/utilizatori";
        }}
      />
      <form className="mb-3">
        {tip && <input type="hidden" name="tip" value={tip} />}
        <input name="q" defaultValue={q} placeholder="Caută după nume sau email…" className={inputClass} />
      </form>

      <Card className="divide-y divide-slate-100 p-0!">
        {list.map((p) => {
          const teams = (coaches ?? []).filter((c) => c.user_id === p.id);
          const clubsOf = (managers ?? []).filter((m) => m.user_id === p.id);
          const active = !!lastSignIn.get(p.id);
          return (
            <Link key={p.id} href={`/admin/utilizatori/${p.id}`} className="block px-4 py-3 active:bg-slate-50">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{p.full_name || p.email}</span>
                <span className="flex flex-wrap justify-end gap-1">
                  {p.role === "master_admin" && <Badge tone="blue">admin principal</Badge>}
                  {p.role === "regional_admin" && <Badge tone="blue">admin {p.region}</Badge>}
                  {p.is_referee && <Badge tone="green">arbitru {p.region}</Badge>}
                  {p.is_table_official && <Badge tone="green">oficial {p.region}</Badge>}
                  {!active && <Badge tone="amber">invitat</Badge>}
                </span>
              </div>
              <div className="text-xs text-slate-500">
                {p.email} · creat {formatDateTime(p.created_at)}
              </div>
              {(teams.length > 0 || clubsOf.length > 0) && (
                <div className="mt-1 text-xs text-slate-600">
                  {clubsOf.map((c) => `🏢 ${c.club?.name}`).join(" · ")}
                  {clubsOf.length > 0 && teams.length > 0 && " · "}
                  {teams
                    .map((t) => `${t.team?.category?.scope === "national" ? "N-" : ""}${t.team?.category?.code} ${t.team?.name}`)
                    .join(" · ")}
                </div>
              )}
            </Link>
          );
        })}
        {list.length === 0 && <p className="px-4 py-3 text-sm text-slate-500">Niciun rezultat.</p>}
      </Card>
    </>
  );
}
