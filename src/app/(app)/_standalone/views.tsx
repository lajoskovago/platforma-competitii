import { notFound, redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Chips, GameList } from "@/components/game-list";
import { StandaloneGameForm } from "@/components/standalone-game-form";
import { Card, LinkButton, PageTitle } from "@/components/ui";
import { canAdminRegion, requireUser } from "@/lib/auth";
import { isoToBucharest } from "@/lib/format";
import { getGame, listGames } from "@/lib/queries";
import { getStandaloneFormData, type StandaloneCompetition } from "@/lib/standalone-data";
import { createSupabaseServer } from "@/lib/supabase/server";
import { deleteStandaloneGame, saveStandaloneGame } from "../meci/actions";

const META: Record<StandaloneCompetition, { title: string; path: string; empty: string }> = {
  national: { title: "Campionatul Național", path: "/national", empty: "Niciun meci pentru filtrul ales." },
  friendly: { title: "Meciuri amicale", path: "/amicale", empty: "Niciun meci amical pentru filtrul ales." },
};

export async function StandaloneList({
  competition,
  searchParams,
}: {
  competition: StandaloneCompetition;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const meta = META[competition];
  const { categorie = "", cand = "upcoming" } = (await searchParams) as Record<string, string | undefined>;
  const user = await requireUser();
  const supabase = await createSupabaseServer();
  let catQuery = supabase.from("categories").select("code, scope").order("sort_order");
  if (competition === "national") catQuery = catQuery.eq("scope", "national");
  const [games, { data: categories }, form] = await Promise.all([
    listGames({ competition, categoryCode: categorie || undefined, when: cand === "past" ? "past" : "upcoming" }),
    catQuery,
    getStandaloneFormData(user, competition),
  ]);
  const codes = [...new Set((categories ?? []).map((c) => c.code))];

  const href = (c: string, w: string) => {
    const p = new URLSearchParams();
    if (c) p.set("categorie", c);
    if (w !== "upcoming") p.set("cand", w);
    const s = p.toString();
    return s ? `${meta.path}?${s}` : meta.path;
  };

  return (
    <>
      <PageTitle
        sub={
          user.isMaster
            ? "Toate meciurile"
            : user.isAdmin || user.isOfficial || user.canNominate
              ? `Meciurile din ${user.region}${user.teamIds.size ? " și ale echipelor mele" : ""}`
              : "Meciurile echipelor mele"
        }
      >
        {meta.title}
      </PageTitle>

      {form.canAdd && (
        <div className="mb-4">
          <LinkButton href={`${meta.path}/nou`} full>
            + Adaugă meci{competition === "friendly" ? " amical" : ""}
          </LinkButton>
        </div>
      )}

      <Chips
        items={[
          { key: "upcoming", label: "Următoare" },
          { key: "past", label: "Trecute" },
        ]}
        active={cand}
        href={(k) => href(categorie, k)}
      />
      <Chips
        items={[{ key: "", label: "Toate" }, ...codes.map((c) => ({ key: c, label: c }))]}
        active={categorie}
        href={(k) => href(k, cand)}
      />

      <GameList games={games} empty={meta.empty} />
    </>
  );
}

export async function StandaloneNew({ competition }: { competition: StandaloneCompetition }) {
  const meta = META[competition];
  const user = await requireUser();
  const data = await getStandaloneFormData(user, competition);
  if (!data.canAdd) redirect(meta.path);

  return (
    <>
      <PageTitle back={meta.path} sub={user.isAdmin ? undefined : "Una dintre echipe trebuie să fie echipa dvs."}>
        {competition === "friendly" ? "Meci amical nou" : "Meci nou – Campionatul Național"}
      </PageTitle>
      <Card>
        <StandaloneGameForm
          competition={competition}
          action={saveStandaloneGame}
          categories={data.categories}
          clubs={data.clubs}
          teams={data.teams}
          externalClubs={data.externalClubs}
          gyms={data.gyms}
          fixedRegion={user.isRegionalAdmin ? user.region : null}
          defaults={{ region: user.isRegionalAdmin ? user.region : (user.region ?? undefined) }}
        />
      </Card>
    </>
  );
}

export async function StandaloneEdit({ competition, id }: { competition: StandaloneCompetition; id: string }) {
  const user = await requireUser();
  const g = await getGame(id);
  if (!g || g.competition !== competition) notFound();
  const canEdit =
    canAdminRegion(user, g.region) ||
    (!!g.home_team_id && user.teamIds.has(g.home_team_id)) ||
    (!!g.away_team_id && user.teamIds.has(g.away_team_id));
  if (!canEdit) redirect(`/meci/${id}`);

  const data = await getStandaloneFormData(user, competition);
  const local = isoToBucharest(g.starts_at);

  return (
    <>
      <PageTitle back={`/meci/${id}`}>Modifică meciul</PageTitle>
      <Card>
        <StandaloneGameForm
          competition={competition}
          action={saveStandaloneGame}
          categories={data.categories}
          clubs={data.clubs}
          teams={data.teams}
          externalClubs={data.externalClubs}
          gyms={data.gyms}
          fixedRegion={user.isRegionalAdmin ? user.region : null}
          defaults={{
            id: g.id,
            category_id: g.category_id,
            region: g.region,
            date: local.date,
            time: local.time,
            label: g.label,
            gym_id: g.gym_id,
            home_team_id: g.home_team_id,
            away_team_id: g.away_team_id,
            home_external: g.home_external,
            away_external: g.away_external,
          }}
        />
      </Card>
      <ActionForm action={deleteStandaloneGame} className="mt-4" confirm="Ștergeți definitiv acest meci?">
        <input type="hidden" name="game_id" value={id} />
        <SubmitButton variant="danger">Șterge meciul</SubmitButton>
      </ActionForm>
    </>
  );
}
