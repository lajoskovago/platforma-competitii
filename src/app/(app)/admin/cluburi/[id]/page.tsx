import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, Empty, Field, PageTitle, SectionTitle, inputClass } from "@/components/ui";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createTeam, deleteClub, deleteTeam, updateClub, updateTeam } from "../../actions";

/** Admins: edit a club (name, city, region) and its teams. */
export default async function ClubPage({ params, searchParams }: PageProps<"/admin/cluburi/[id]">) {
  const { id } = await params;
  const { mutata } = (await searchParams) as { mutata?: string };
  const supabase = await createSupabaseServer();
  const [{ data: club }, { data: teams }, { data: categories }, { data: groups }, { data: managers }, { data: clubs }] =
    await Promise.all([
    supabase.from("clubs").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("teams")
      .select("id, name, category_id, category:categories(code, name, scope, sort_order), group_teams(group_id)")
      .eq("club_id", id),
    supabase.from("categories").select("id, code, name, scope").order("sort_order"),
    supabase.from("group_overview").select("group_id, group_name, category_id, sort_order").order("sort_order"),
    supabase.from("club_managers").select("user_id").eq("club_id", id),
    supabase.from("clubs").select("id, name, city").order("name"),
  ]);
  if (!club) notFound();

  const { data: adminNames } = (managers ?? []).length
    ? await supabase.from("profile_names").select("id, full_name").in("id", (managers ?? []).map((m) => m.user_id))
    : { data: [] };
  const sorted = [...(teams ?? [])].sort(
    (a, b) => (a.category?.sort_order ?? 0) - (b.category?.sort_order ?? 0) || a.name.localeCompare(b.name, "ro"),
  );
  const groupsOf = (categoryId: string) => (groups ?? []).filter((g) => g.category_id === categoryId);
  const groupName = (gid: string | undefined) => (groups ?? []).find((g) => g.group_id === gid)?.group_name;

  return (
    <>
      <PageTitle back="/admin/cluburi" sub={[club.city, club.region].filter(Boolean).join(" · ")}>
        {club.name}
      </PageTitle>

      {mutata && (
        <p role="status" className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          ✅ Echipa „{mutata}” a fost mutată la acest club, cu grupa și meciurile ei.
        </p>
      )}

      <SectionTitle>Date club</SectionTitle>
      <Card>
        <ActionForm action={updateClub}>
          <input type="hidden" name="club_id" value={club.id} />
          <Field label="Nume club">
            <input name="name" defaultValue={club.name} required className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Oraș">
              <input name="city" defaultValue={club.city ?? ""} className={inputClass} />
            </Field>
            <Field label="Regiune">
              <select name="region" defaultValue={club.region ?? ""} className={inputClass}>
                <option value="">—</option>
                <option value="SR5">SR5</option>
                <option value="SR6">SR6</option>
              </select>
            </Field>
          </div>
          <SubmitButton>Salvează clubul</SubmitButton>
        </ActionForm>
      </Card>

      <SectionTitle>Echipe ({sorted.length})</SectionTitle>
      {sorted.length === 0 ? (
        <Empty>Clubul nu are încă echipe.</Empty>
      ) : (
        <Card className="divide-y divide-slate-100 p-0!">
          {sorted.map((t) => {
            const currentGroup = t.group_teams[0]?.group_id ?? "";
            const regional = t.category?.scope === "regional";
            return (
              <details key={t.id}>
                <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-2 px-4 py-2">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{t.name}</span>
                    <span className="block text-xs text-slate-500">
                      {regional ? "Regional" : "Național"} {t.category?.code}
                      {regional && (currentGroup ? ` · ${groupName(currentGroup)}` : " · fără grupă")}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-orange-700">Editează</span>
                </summary>
                <div className="space-y-3 bg-slate-50 px-4 py-3">
                  <ActionForm action={updateTeam}>
                    <input type="hidden" name="team_id" value={t.id} />
                    <input type="hidden" name="old_club_id" value={club.id} />
                    <input type="hidden" name="old_group_id" value={currentGroup} />
                    <Field label="Nume echipă" hint="Cum apare în program">
                      <input name="name" defaultValue={t.name} required className={inputClass} />
                    </Field>
                    <Field label="Clubul" hint="Mutarea păstrează grupa, meciurile și antrenorii echipei">
                      <select name="club_id" defaultValue={club.id} className={inputClass}>
                        {(clubs ?? []).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                            {c.city ? ` (${c.city})` : ""}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {regional ? (
                      <Field label="Grupă (Turneul 1)">
                        <select name="group_id" defaultValue={currentGroup} className={inputClass}>
                          <option value="">— fără grupă —</option>
                          {groupsOf(t.category_id).map((g) => (
                            <option key={g.group_id} value={g.group_id!}>
                              {g.group_name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ) : (
                      <input type="hidden" name="group_id" value="" />
                    )}
                    <SubmitButton>Salvează echipa</SubmitButton>
                  </ActionForm>
                  <ActionForm action={deleteTeam} confirm={`Ștergeți echipa ${t.name}?`}>
                    <input type="hidden" name="team_id" value={t.id} />
                    <SubmitButton variant="danger">Șterge echipa</SubmitButton>
                  </ActionForm>
                </div>
              </details>
            );
          })}
        </Card>
      )}

      <SectionTitle>Echipă nouă</SectionTitle>
      <Card>
        <ActionForm action={createTeam} resetOnSuccess>
          <input type="hidden" name="club_id" value={club.id} />
          <Field label="Categoria">
            <select name="category_id" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                Alegeți categoria…
              </option>
              {(["regional", "national"] as const).map((scope) => (
                <optgroup key={scope} label={scope === "regional" ? "Campionate regionale" : "Campionatul Național"}>
                  {(categories ?? [])
                    .filter((c) => c.scope === scope)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} – {c.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field label="Nume echipă" hint="ex. numele clubului, sau cu un sufix (Alb, 2, U14…)">
            <input name="name" required defaultValue={club.name} className={inputClass} />
          </Field>
          <Field label="Grupă (doar pentru categoriile regionale, opțional)">
            <select name="group_id" defaultValue="" className={inputClass}>
              <option value="">— fără grupă —</option>
              {(categories ?? [])
                .filter((c) => c.scope === "regional")
                .map((c) => (
                  <optgroup key={c.id} label={c.code}>
                    {groupsOf(c.id).map((g) => (
                      <option key={g.group_id} value={g.group_id!}>
                        {c.code} · {g.group_name}
                      </option>
                    ))}
                  </optgroup>
                ))}
            </select>
          </Field>
          <SubmitButton>Adaugă echipa</SubmitButton>
        </ActionForm>
      </Card>

      <SectionTitle>Administratori club</SectionTitle>
      <Card className="text-sm">
        {(adminNames ?? []).length === 0 ? (
          <p className="text-slate-500">Clubul nu are administrator.</p>
        ) : (
          <ul className="space-y-1">
            {(adminNames ?? []).map((a) => (
              <li key={a.id}>
                <Link href={`/admin/utilizatori/${a.id}`} className="underline">
                  {a.full_name}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-slate-500">Administratorii se adaugă din pagina utilizatorului (Utilizatori).</p>
      </Card>

      <SectionTitle>Ștergere club</SectionTitle>
      {sorted.length === 0 ? (
        <ActionForm
          action={deleteClub}
          confirm={`Ștergeți definitiv clubul ${club.name}?${(adminNames ?? []).length ? " Administratorii lui nu vor mai fi legați de niciun club." : ""}`}
        >
          <input type="hidden" name="club_id" value={club.id} />
          <SubmitButton variant="danger">Șterge clubul</SubmitButton>
        </ActionForm>
      ) : (
        <p className="text-sm text-slate-500">
          Clubul poate fi șters doar după ce echipele lui sunt mutate la alt club (câmpul „Clubul” de la fiecare echipă)
          sau șterse.
        </p>
      )}
    </>
  );
}
