import { StandaloneList } from "../_standalone/views";

export default function FriendlyGamesPage({ searchParams }: PageProps<"/amicale">) {
  return <StandaloneList competition="friendly" searchParams={searchParams} />;
}
