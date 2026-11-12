import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { AutoFilterForm } from "@/components/auto-filter-form";
import { Badge, Card, Empty, Field, PageTitle, SectionTitle, inputClass } from "@/components/ui";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createClub } from "../actions";

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

/** Admins: all clubs, with search; each opens the club's page (name, teams). */
export default async function ClubsPage({ searchParams }: PageProps<"/admin/cluburi">) {
  const { q = "", regiune = "" } = (await searchParams) as Record<string, string | undefined>;
  const supabase = await createSupabaseServer();
  const [{ data: clubs }, { data: teams }, { data: managers }] = await Promise.all([
    supabase.from("clubs").select("id, name, city, region").order("name"),
    supabase.from("teams").select("club_id"),
    supabase.from("club_managers").select("club_id"),
  ]);
  const needle = norm(q);
  const list = (clubs ?? []).filter(
    (c) =>
      (!needle || norm(c.name).includes(needle) || norm(c.city).includes(needle)) &&
      (!regiune || (regiune === "none" ? !c.region : c.region === regiune)),
  );
  const teamCount = (id: string) => (teams ?? []).filter((t) => t.club_id === id).length;
  const adminCount = (id: string) => (managers ?? []).filter((m) => m.club_id === id).length;

  return (
    <>
      <PageTitle sub={`${clubs?.length ?? 0} cluburi`}>Cluburi</PageTitle>

      <AutoFilterForm className="mb-3 space-y-2 rounded-xl border border-slate-200 bg-white p-3" showClear={!!(q || regiune)}>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input name="q" type="search" defaultValue={q} placeholder="Caută club sau oraș…" className={inputClass} />
          <select name="regiune" defaultValue={regiune} aria-label="Regiune" className={inputClass}>
            <option value="">Toate</option>
            <option value="SR5">SR5</option>
            <option value="SR6">SR6</option>
            <option value="none">Fără regiune</option>
          </select>
        </div>
      </AutoFilterForm>

      <div className="mb-3 flex items-center justify-between gap-2 text-sm">
        <span className="text-slate-500">{list.length} rezultate</span>
        <Link href="/admin/echipe" className="text-orange-700 underline">
          Vezi echipele pe categorii și grupe
        </Link>
      </div>

      {list.length === 0 ? (
        <Empty>Niciun club pentru căutarea aleasă.</Empty>
      ) : (
        <Card className="divide-y divide-slate-100 p-0!">
          {list.map((c) => (
            <Link key={c.id} href={`/admin/cluburi/${c.id}`} className="flex items-center justify-between gap-2 px-4 py-3 active:bg-slate-50">
              <span className="min-w-0">
                <span className="block truncate font-medium">{c.name}</span>
                <span className="block text-xs text-slate-500">
                  {[c.city, `${teamCount(c.id)} echipe`, adminCount(c.id) ? `${adminCount(c.id)} admin` : "fără admin"]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {c.region ? <Badge>{c.region}</Badge> : <Badge tone="amber">fără regiune</Badge>}
                <span className="text-slate-400">›</span>
              </span>
            </Link>
          ))}
        </Card>
      )}

      <SectionTitle>Club nou</SectionTitle>
      <Card>
        <ActionForm action={createClub} resetOnSuccess>
          <Field label="Nume club">
            <input name="name" required className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Oraș">
              <input name="city" className={inputClass} />
            </Field>
            <Field label="Regiune">
              <select name="region" defaultValue="" className={inputClass}>
                <option value="">—</option>
                <option value="SR5">SR5</option>
                <option value="SR6">SR6</option>
              </select>
            </Field>
          </div>
          <SubmitButton>Adaugă clubul</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
