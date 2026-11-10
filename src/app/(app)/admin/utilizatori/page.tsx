import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { AutoFilterForm } from "@/components/auto-filter-form";
import { Chips } from "@/components/game-list";
import { Badge, Card, Field, PageTitle, SectionTitle, inputClass } from "@/components/ui";
import { UserRoleFields } from "@/components/user-role-fields";
import { requireAdmin } from "@/lib/auth";
import { TABLE_SKILLS, TABLE_SKILL_LABEL, formatDateTime, sevenDaysAgo, type TableSkill } from "@/lib/format";
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
  { key: "delegates", label: "Pot nominaliza" },
];

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/utilizatori">) {
  const me = await requireAdmin();
  const { q = "", tip = "", regiune = "", oras = "", calificare = "" } = (await searchParams) as Record<
    string,
    string | undefined
  >;
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
  const norm = (v: string) =>
    v
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim();
  const cities = [...new Set((profiles ?? []).map((p) => p.city?.trim()).filter(Boolean) as string[])].sort((a, b) =>
    a.localeCompare(b, "ro"),
  );
  const list = (profiles ?? []).filter((p) => {
    if (needle && !p.full_name.toLowerCase().includes(needle) && !p.email.toLowerCase().includes(needle)) return false;
    if (regiune && p.region !== regiune) return false;
    if (oras && norm(p.city ?? "") !== norm(oras)) return false;
    if (calificare && !(p.table_skills ?? []).includes(calificare)) return false;
    if (tip === "new") return new Date(p.created_at).getTime() > weekAgo;
    if (tip === "admin") return p.role !== "user";
    if (tip === "club") return (managers ?? []).some((m) => m.user_id === p.id);
    if (tip === "coach") return (coaches ?? []).some((c) => c.user_id === p.id);
    if (tip === "referee") return p.is_referee;
    if (tip === "table") return p.is_table_official;
    if (tip === "delegates") return p.can_nominate;
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
          if (regiune) p.set("regiune", regiune);
          if (oras) p.set("oras", oras);
          if (calificare) p.set("calificare", calificare);
          const s = p.toString();
          return s ? `/admin/utilizatori?${s}` : "/admin/utilizatori";
        }}
      />
      <AutoFilterForm className="mb-3 space-y-2" showClear={!!(q || regiune || oras || calificare)}>
        {tip && <input type="hidden" name="tip" value={tip} />}
        <input name="q" type="search" defaultValue={q} placeholder="Caută după nume sau email…" className={inputClass} />
        <div className="grid grid-cols-3 gap-2">
          <select name="regiune" defaultValue={regiune} aria-label="Regiune" className={inputClass}>
            <option value="">Regiune</option>
            <option value="SR5">SR5</option>
            <option value="SR6">SR6</option>
          </select>
          <select name="oras" defaultValue={oras} aria-label="Oraș" className={inputClass}>
            <option value="">Oraș</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select name="calificare" defaultValue={calificare} aria-label="Calificare" className={inputClass}>
            <option value="">Calificare</option>
            {TABLE_SKILLS.map((k) => (
              <option key={k} value={k}>
                {TABLE_SKILL_LABEL[k]}
              </option>
            ))}
          </select>
        </div>

      </AutoFilterForm>
      <p className="mb-2 text-sm text-slate-500">{list.length} rezultate</p>

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
                  {p.can_nominate && <Badge tone="amber">nominalizează {p.region}</Badge>}
                  {!active && <Badge tone="amber">invitat</Badge>}
                </span>
              </div>
              <div className="text-xs text-slate-500">
                {p.email}
                {p.city && <> · 📍 {p.city}</>} · creat {formatDateTime(p.created_at)}
              </div>
              {(p.table_skills ?? []).length > 0 && (
                <div className="mt-1 text-xs text-slate-600">
                  {(p.table_skills ?? []).map((k) => TABLE_SKILL_LABEL[k as TableSkill] ?? k).join(" · ")}
                </div>
              )}
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
