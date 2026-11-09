import { Chips, GameList } from "@/components/game-list";
import { LinkButton, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listGames } from "@/lib/queries";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getNationalFormData } from "./data";

export default async function NationalPage({ searchParams }: PageProps<"/national">) {
  const { categorie = "", cand = "upcoming" } = (await searchParams) as Record<string, string | undefined>;
  const user = await requireUser();
  const supabase = await createSupabaseServer();
  const [games, { data: categories }, form] = await Promise.all([
    listGames({ competition: "national", categoryCode: categorie || undefined, when: cand === "past" ? "past" : "upcoming" }),
    supabase.from("categories").select("code").eq("scope", "national").order("sort_order"),
    getNationalFormData(user),
  ]);

  const href = (c: string, w: string) => {
    const p = new URLSearchParams();
    if (c) p.set("categorie", c);
    if (w !== "upcoming") p.set("cand", w);
    const s = p.toString();
    return s ? `/national?${s}` : "/national";
  };

  return (
    <>
      <PageTitle
        sub={
          user.isMaster
            ? "Toate meciurile"
            : user.isAdmin || user.isOfficial
              ? `Meciurile din ${user.region}`
              : "Meciurile echipelor mele"
        }
      >
        Campionatul Național
      </PageTitle>

      {form.canAdd && (
        <div className="mb-4">
          <LinkButton href="/national/nou" full>
            + Adaugă meci
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
        items={[{ key: "", label: "Toate" }, ...(categories ?? []).map((c) => ({ key: c.code, label: c.code }))]}
        active={categorie}
        href={(k) => href(k, cand)}
      />

      <GameList games={games} empty="Niciun meci pentru filtrul ales." />
    </>
  );
}
