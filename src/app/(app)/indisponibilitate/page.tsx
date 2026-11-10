import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, Empty, Field, PageTitle, SectionTitle, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDateRange } from "@/lib/format";
import { createSupabaseServer } from "@/lib/supabase/server";
import { addUnavailability, deleteUnavailability } from "../meci/actions";
import { APP_HOME } from "@/lib/brand";

export default async function UnavailabilityPage() {
  const user = await requireUser();
  if (!user.isOfficial) redirect(APP_HOME);
  const supabase = await createSupabaseServer();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("official_unavailability")
    .select("*")
    .eq("user_id", user.id)
    .gte("end_date", today)
    .order("start_date");

  return (
    <>
      <PageTitle sub="Adăugați zilele în care nu puteți fi nominalizat. Refuzurile fără indisponibilitate trecută pot fi sancționate.">
        Indisponibilitate
      </PageTitle>

      <Card>
        <ActionForm action={addUnavailability} resetOnSuccess>
          <div className="grid grid-cols-2 gap-2">
            <Field label="De la">
              <input name="start_date" type="date" required min={today} className={inputClass} />
            </Field>
            <Field label="Până la" hint="Gol = o singură zi">
              <input name="end_date" type="date" min={today} className={inputClass} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Ora de la (opțional)">
              <input name="start_time" type="time" className={inputClass} />
            </Field>
            <Field label="Ora până la (opțional)">
              <input name="end_time" type="time" className={inputClass} />
            </Field>
          </div>
          <p className="-mt-2 text-xs text-slate-500">Orele se pot completa doar când este o singură zi.</p>
          <Field label="Observații (opțional)">
            <input name="note" placeholder="ex. examen, deplasare" className={inputClass} />
          </Field>
          <SubmitButton>Adaugă</SubmitButton>
        </ActionForm>
      </Card>

      <SectionTitle>Perioadele mele</SectionTitle>
      {(data ?? []).length === 0 ? (
        <Empty>Nicio indisponibilitate trecută.</Empty>
      ) : (
        <Card className="divide-y divide-slate-100 p-0!">
          {(data ?? []).map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-2 px-4 py-3">
              <div className="text-sm">
                <div className="font-medium capitalize">{formatDateRange(u.start_date, u.end_date)}</div>
                {(u.start_time || u.end_time) && (
                  <div className="text-slate-600">
                    {u.start_time?.slice(0, 5) ?? "00:00"} – {u.end_time?.slice(0, 5) ?? "24:00"}
                  </div>
                )}
                {u.note && <div className="text-slate-500">{u.note}</div>}
              </div>
              <ActionForm action={deleteUnavailability} className="" confirm="Ștergeți această perioadă?">
                <input type="hidden" name="id" value={u.id} />
                <SubmitButton variant="danger" full={false}>
                  Șterge
                </SubmitButton>
              </ActionForm>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
