import { redirect } from "next/navigation";
import { Chips, GameList } from "@/components/game-list";
import { PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listGames } from "@/lib/queries";

export default async function GamesPage({ searchParams }: PageProps<"/meciuri">) {
  const user = await requireUser();
  if (!user.isOfficial && !user.isAdmin) redirect("/");
  const { tip = "", cand = "upcoming" } = (await searchParams) as Record<string, string | undefined>;

  const games = await listGames({
    competition: tip === "regional" || tip === "national" || tip === "friendly" ? tip : undefined,
    when: cand === "past" ? "past" : "upcoming",
  });

  const href = (t: string, w: string) => {
    const p = new URLSearchParams();
    if (t) p.set("tip", t);
    if (w !== "upcoming") p.set("cand", w);
    const s = p.toString();
    return s ? `/meciuri?${s}` : "/meciuri";
  };

  return (
    <>
      <PageTitle sub="Campionate regionale, Campionatul Național și meciuri amicale">Meciuri</PageTitle>
      <Chips
        items={[
          { key: "", label: "Toate" },
          { key: "regional", label: "Regional" },
          { key: "national", label: "Național" },
          { key: "friendly", label: "Amicale" },
        ]}
        active={tip}
        href={(k) => href(k, cand)}
      />
      <Chips
        items={[
          { key: "upcoming", label: "Următoare" },
          { key: "past", label: "Trecute" },
        ]}
        active={cand}
        href={(k) => href(tip, k)}
      />
      <GameList games={games} empty="Niciun meci programat." />
    </>
  );
}
