import { notFound, redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { NationalGameForm } from "@/components/national-game-form";
import { Card, PageTitle } from "@/components/ui";
import { canAdminRegion, requireUser } from "@/lib/auth";
import { isoToBucharest } from "@/lib/format";
import { getGame } from "@/lib/queries";
import { deleteNationalGame, saveNationalGame } from "../../../meci/actions";
import { getNationalFormData } from "../../data";

export default async function EditNationalGamePage({ params }: PageProps<"/national/[id]/editeaza">) {
  const { id } = await params;
  const user = await requireUser();
  const g = await getGame(id);
  if (!g || g.competition !== "national") notFound();
  const canEdit =
    canAdminRegion(user, g.region) ||
    (!!g.home_team_id && user.teamIds.has(g.home_team_id)) ||
    (!!g.away_team_id && user.teamIds.has(g.away_team_id));
  if (!canEdit) redirect(`/meci/${id}`);

  const data = await getNationalFormData(user);
  const local = isoToBucharest(g.starts_at);

  return (
    <>
      <PageTitle back={`/meci/${id}`}>Modifică meciul</PageTitle>
      <Card>
        <NationalGameForm
          action={saveNationalGame}
          categories={data.categories}
          teams={data.teams}
          externalClubs={data.externalClubs}
          gyms={data.gyms}
          askRegion={user.isMaster}
          defaults={{
            id: g.id,
            category_id: g.category_id ?? undefined,
            date: local.date,
            time: local.time,
            label: g.label,
            gym_id: g.gym_id,
            home_team_id: g.home_team_id,
            away_team_id: g.away_team_id,
            home_external: g.home_external,
            away_external: g.away_external,
            region: g.region,
          }}
        />
      </Card>
      <ActionForm action={deleteNationalGame} className="mt-4" confirm="Ștergeți definitiv acest meci?">
        <input type="hidden" name="game_id" value={id} />
        <SubmitButton variant="danger">Șterge meciul</SubmitButton>
      </ActionForm>
    </>
  );
}
