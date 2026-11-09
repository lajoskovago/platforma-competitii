import { redirect } from "next/navigation";
import { NationalGameForm } from "@/components/national-game-form";
import { Card, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { saveNationalGame } from "../../meci/actions";
import { getNationalFormData } from "../data";

export default async function NewNationalGamePage() {
  const user = await requireUser();
  const data = await getNationalFormData(user);
  if (!data.canAdd) redirect("/national");

  return (
    <>
      <PageTitle back="/national" sub={user.isAdmin ? undefined : "Una dintre echipe trebuie să fie echipa dvs."}>
        Meci nou – Campionatul Național
      </PageTitle>
      <Card>
        <NationalGameForm
          action={saveNationalGame}
          categories={data.categories}
          teams={data.teams}
          externalClubs={data.externalClubs}
          gyms={data.gyms}
          askRegion={user.isMaster}
        />
      </Card>
    </>
  );
}
