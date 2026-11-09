import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, Field, PageTitle, SectionTitle, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getNames } from "@/lib/queries";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createNationalTeam, deleteNationalTeam, inviteCoach, removeCoach } from "./actions";

export default async function ClubPage() {
  const user = await requireUser();
  if (user.managedClubIds.length === 0) redirect("/");
  const supabase = await createSupabaseServer();

  const [{ data: clubs }, { data: teams }, { data: nationalCats }] = await Promise.all([
    supabase.from("clubs").select("id, name, city, region").in("id", user.managedClubIds).order("name"),
    supabase
      .from("teams")
      .select("id, name, club_id, category:categories(code, name, scope, sort_order), team_coaches(user_id), group_teams(group_id)")
      .in("club_id", user.managedClubIds),
    supabase.from("categories").select("id, code, name").eq("scope", "national").order("sort_order"),
  ]);
  const names = await getNames((teams ?? []).flatMap((t) => t.team_coaches.map((c) => c.user_id)));
  const sorted = [...(teams ?? [])].sort(
    (a, b) => (a.category?.sort_order ?? 0) - (b.category?.sort_order ?? 0) || a.name.localeCompare(b.name, "ro"),
  );

  return (
    <>
      <PageTitle sub="Echipele clubului și antrenorii lor">Clubul meu</PageTitle>

      {(clubs ?? []).map((club) => {
        const clubTeams = sorted.filter((t) => t.club_id === club.id);
        return (
          <section key={club.id} className="mb-8">
            <h2 className="text-lg font-semibold">
              {club.name} <span className="text-sm font-normal text-slate-500">{[club.city, club.region].filter(Boolean).join(" · ")}</span>
            </h2>

            <SectionTitle>Echipe ({clubTeams.length})</SectionTitle>
            <Card className="divide-y divide-slate-100 p-0!">
              {clubTeams.length === 0 && (
                <p className="px-4 py-3 text-sm text-slate-500">
                  Nicio echipă încă. Adăugați mai jos echipele din Campionatul Național; echipele din campionatele
                  regionale sunt adăugate de administratori.
                </p>
              )}
              {clubTeams.map((t) => (
                <div key={t.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <Badge tone={t.category?.scope === "national" ? "blue" : "gray"}>
                        {t.category?.scope === "national" ? "Național" : "Regional"} {t.category?.code}
                      </Badge>{" "}
                      <span className="font-medium">{t.name}</span>
                    </div>
                    {t.group_teams[0] && (
                      <Link href={`/grupa/${t.group_teams[0].group_id}`} className="py-1 text-sm text-orange-700">
                        Grupa ›
                      </Link>
                    )}
                    {t.category?.scope === "national" && (
                      <ActionForm action={deleteNationalTeam} className="" confirm={`Ștergeți echipa ${t.name}?`}>
                        <input type="hidden" name="team_id" value={t.id} />
                        <button className="min-h-9 rounded px-2 text-xs text-red-700 hover:bg-red-50">Șterge</button>
                      </ActionForm>
                    )}
                  </div>
                  {t.team_coaches.length === 0 ? (
                    <p className="mt-1 text-xs text-slate-500">Fără antrenor asociat.</p>
                  ) : (
                    t.team_coaches.map((c) => (
                      <div key={c.user_id} className="mt-1 flex items-center justify-between gap-2 text-sm">
                        <span>🧑‍🏫 {names.get(c.user_id) || "—"}</span>
                        <ActionForm action={removeCoach} className="" confirm="Eliminați antrenorul de la această echipă?">
                          <input type="hidden" name="team_id" value={t.id} />
                          <input type="hidden" name="user_id" value={c.user_id} />
                          <button className="min-h-9 rounded px-2 text-xs text-red-700 hover:bg-red-50">Elimină</button>
                        </ActionForm>
                      </div>
                    ))
                  )}
                </div>
              ))}
            </Card>

            <SectionTitle>Adaugă o echipă în Campionatul Național</SectionTitle>
            <Card>
              <ActionForm action={createNationalTeam} resetOnSuccess>
                <input type="hidden" name="club_id" value={club.id} />
                <Field label="Categoria">
                  <select name="category_id" required defaultValue="" className={inputClass}>
                    <option value="" disabled>
                      Alegeți categoria…
                    </option>
                    {(nationalCats ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} – {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Numele echipei" hint="Cum apare în programul meciurilor">
                  <input name="name" required defaultValue={club.name} className={inputClass} />
                </Field>
                <SubmitButton variant="secondary">+ Adaugă echipa</SubmitButton>
              </ActionForm>
            </Card>

            {clubTeams.length > 0 && (
              <>
                <SectionTitle>Adaugă un antrenor</SectionTitle>
                <Card>
                  <ActionForm action={inviteCoach} resetOnSuccess>
                    <Field label="Echipa">
                      <select name="team_id" required defaultValue="" className={inputClass}>
                        <option value="" disabled>
                          Alegeți echipa…
                        </option>
                        {clubTeams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.category?.scope === "national" ? "Național" : "Regional"} {t.category?.code} – {t.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Email antrenor" hint="Dacă antrenorul are deja cont, este doar asociat echipei.">
                      <input name="email" type="email" required className={inputClass} />
                    </Field>
                    <Field label="Nume și prenume">
                      <input name="full_name" className={inputClass} />
                    </Field>
                    <Field label="Telefon (opțional)">
                      <input name="phone" type="tel" className={inputClass} />
                    </Field>
                    <SubmitButton>Trimite invitația</SubmitButton>
                  </ActionForm>
                </Card>
                <p className="mt-2 text-xs text-slate-500">
                  Antrenorul primește un email pentru a-și seta parola. Vă puteți asocia și pe dvs. ca antrenor al unei echipe.
                </p>
              </>
            )}
          </section>
        );
      })}
    </>
  );
}
