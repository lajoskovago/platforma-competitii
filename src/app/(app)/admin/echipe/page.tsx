import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, Field, PageTitle, SectionTitle, inputClass } from "@/components/ui";
import { createSupabaseServer } from "@/lib/supabase/server";
import {
  createCategory,
  createClub,
  createGroup,
  createTeam,
  deleteTeam,
  updateClub,
  updateTeam,
} from "../actions";

export default async function AdminTeamsPage({ searchParams }: PageProps<"/admin/echipe">) {
  const { categorie } = (await searchParams) as Record<string, string | undefined>;
  const supabase = await createSupabaseServer();

  const [{ data: categories }, { data: clubs }] = await Promise.all([
    supabase.from("categories").select("id, code, name, scope").order("sort_order"),
    supabase.from("clubs").select("*").order("name"),
  ]);
  const cat = (categories ?? []).find((c) => c.id === categorie) ?? categories?.[0];
  const regional = cat?.scope === "regional";

  const [{ data: teams }, { data: groups }] = cat
    ? await Promise.all([
        supabase.from("teams").select("id, name, club_id, group_teams(group_id)").eq("category_id", cat.id).order("name"),
        supabase
          .from("group_overview")
          .select("group_id, group_name, region")
          .eq("category_id", cat.id)
          .order("sort_order"),
      ])
    : [{ data: [] }, { data: [] }];

  const clubName = (id: string) => (clubs ?? []).find((c) => c.id === id)?.name ?? "";
  const groupOf = (t: NonNullable<typeof teams>[number]) => t.group_teams[0]?.group_id ?? "";
  const sections = [
    ...(groups ?? []).map((g) => ({ id: g.group_id!, name: g.group_name!, teams: (teams ?? []).filter((t) => groupOf(t) === g.group_id) })),
    { id: "", name: "Fără grupă", teams: (teams ?? []).filter((t) => !groupOf(t)) },
  ];

  return (
    <>
      <PageTitle sub="Cluburi, echipe și grupe pentru Turneul 1">Echipe</PageTitle>

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {(categories ?? []).map((c) => (
          <Link
            key={c.id}
            href={`/admin/echipe?categorie=${c.id}`}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm ${c.id === cat?.id ? "border-orange-600 bg-orange-600 text-white" : "border-slate-300 bg-white"}`}
          >
            {c.scope === "national" ? `Național ${c.code}` : c.code}
          </Link>
        ))}
      </div>

      {cat && (
        <>
          <h2 className="mb-2 text-lg font-semibold">
            {cat.scope === "national" ? "Campionatul Național · " : ""}
            {cat.name}
          </h2>
          <div className="space-y-4">
            {sections
              .filter((s) => s.id || s.teams.length)
              .map((s) => (
                <Card key={s.id || "none"} className="p-0!">
                  <div className="border-b border-slate-100 px-4 py-2 text-sm font-semibold">
                    {s.name} <span className="font-normal text-slate-400">({s.teams.length})</span>
                  </div>
                  {s.teams.length === 0 && <p className="px-4 py-3 text-sm text-slate-400">Nicio echipă.</p>}
                  {s.teams.map((t) => (
                    <details key={t.id} className="border-b border-slate-100 last:border-0">
                      <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-2 px-4 py-2">
                        <span>
                          <span className="font-medium">{t.name}</span>
                          <span className="block text-xs text-slate-500">{clubName(t.club_id)}</span>
                        </span>
                        <span className="text-xs text-orange-700">Editează</span>
                      </summary>
                      <div className="space-y-3 bg-slate-50 px-4 py-3">
                        <ActionForm action={updateTeam} className="space-y-3">
                          <input type="hidden" name="team_id" value={t.id} />
                          <input type="hidden" name="old_group_id" value={groupOf(t)} />
                          <Field label="Nume echipă">
                            <input name="name" defaultValue={t.name} required className={inputClass} />
                          </Field>
                          <Field label="Club">
                            <select name="club_id" defaultValue={t.club_id} className={inputClass}>
                              {(clubs ?? []).map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </Field>
                          {regional && (
                          <Field label="Grupă (Turneul 1)">
                            <select name="group_id" defaultValue={groupOf(t)} className={inputClass}>
                              <option value="">— fără grupă —</option>
                              {(groups ?? []).map((g) => (
                                <option key={g.group_id} value={g.group_id!}>
                                  {g.group_name}
                                </option>
                              ))}
                            </select>
                          </Field>
                          )}
                          <SubmitButton>Salvează</SubmitButton>
                        </ActionForm>
                        <ActionForm action={deleteTeam} confirm={`Ștergeți echipa ${t.name}?`}>
                          <input type="hidden" name="team_id" value={t.id} />
                          <SubmitButton variant="danger">Șterge echipa</SubmitButton>
                        </ActionForm>
                      </div>
                    </details>
                  ))}
                </Card>
              ))}
          </div>

          <SectionTitle>Adaugă în {cat.code}</SectionTitle>
          <Card>
            <details>
              <summary className="cursor-pointer py-1 font-medium">+ Echipă nouă</summary>
              <ActionForm action={createTeam} resetOnSuccess className="mt-3 space-y-3">
                <input type="hidden" name="category_id" value={cat.id} />
                <Field label="Club">
                  <select name="club_id" required defaultValue="" className={inputClass}>
                    <option value="" disabled>
                      Alegeți clubul…
                    </option>
                    {(clubs ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Nume echipă" hint="ex. „U-BT Gri” – cum apare în program">
                  <input name="name" required className={inputClass} />
                </Field>
                {regional && (
                <Field label="Grupă">
                  <select name="group_id" defaultValue="" className={inputClass}>
                    <option value="">— fără grupă —</option>
                    {(groups ?? []).map((g) => (
                      <option key={g.group_id} value={g.group_id!}>
                        {g.group_name}
                      </option>
                    ))}
                  </select>
                </Field>
                )}
                <SubmitButton>Adaugă echipa</SubmitButton>
              </ActionForm>
            </details>
          </Card>
          {regional && (
          <Card className="mt-2">
            <details>
              <summary className="cursor-pointer py-1 font-medium">+ Grupă nouă</summary>
              <ActionForm action={createGroup} resetOnSuccess className="mt-3 space-y-3">
                <input type="hidden" name="category_id" value={cat.id} />
                <Field label="Nume grupă">
                  <input name="name" required placeholder="ex. Grupa 4 (SR6)" className={inputClass} />
                </Field>
                <RegionSelect />
                <Field label="Observații (opțional)">
                  <input name="notes" placeholder="ex. Fiecare cu fiecare" className={inputClass} />
                </Field>
                <SubmitButton>Creează grupa</SubmitButton>
              </ActionForm>
            </details>
          </Card>
          )}
        </>
      )}

      <SectionTitle>Cluburi ({clubs?.length ?? 0})</SectionTitle>
      <Card>
        <details>
          <summary className="cursor-pointer py-1 font-medium">+ Club nou</summary>
          <ActionForm action={createClub} resetOnSuccess className="mt-3 space-y-3">
            <Field label="Nume club">
              <input name="name" required className={inputClass} />
            </Field>
            <Field label="Oraș">
              <input name="city" className={inputClass} />
            </Field>
            <RegionSelect />
            <SubmitButton>Adaugă clubul</SubmitButton>
          </ActionForm>
        </details>
      </Card>
      <Card className="mt-2 p-0!">
        {(clubs ?? []).map((c) => (
          <details key={c.id} className="border-b border-slate-100 last:border-0">
            <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-4 py-2 text-sm">
              <span>
                {c.name} <span className="text-slate-400">{[c.city, c.region].filter(Boolean).join(" · ")}</span>
              </span>
              <span className="text-xs text-orange-700">Editează</span>
            </summary>
            <ActionForm action={updateClub} className="space-y-3 bg-slate-50 px-4 py-3">
              <input type="hidden" name="club_id" value={c.id} />
              <Field label="Nume club">
                <input name="name" defaultValue={c.name} required className={inputClass} />
              </Field>
              <Field label="Oraș">
                <input name="city" defaultValue={c.city ?? ""} className={inputClass} />
              </Field>
              <RegionSelect value={c.region} />
              <SubmitButton>Salvează</SubmitButton>
            </ActionForm>
          </details>
        ))}
      </Card>

      <SectionTitle>Categorii</SectionTitle>
      <Card>
        <details>
          <summary className="cursor-pointer py-1 font-medium">+ Categorie nouă</summary>
          <ActionForm action={createCategory} resetOnSuccess className="mt-3 space-y-3">
            <Field label="Cod">
              <input name="code" required placeholder="ex. U16F" className={inputClass} />
            </Field>
            <Field label="Nume">
              <input name="name" required placeholder="ex. U16 Feminin" className={inputClass} />
            </Field>
            <SubmitButton>Creează categoria</SubmitButton>
          </ActionForm>
        </details>
      </Card>
    </>
  );
}

function RegionSelect({ value }: { value?: string | null }) {
  return (
    <Field label="Regiune">
      <select name="region" defaultValue={value ?? ""} className={inputClass}>
        <option value="">— mixt / nespecificat —</option>
        <option value="SR5">SR5</option>
        <option value="SR6">SR6</option>
      </select>
    </Field>
  );
}
