import { StandaloneList } from "../_standalone/views";

export default function NationalPage({ searchParams }: PageProps<"/national">) {
  return <StandaloneList competition="national" searchParams={searchParams} />;
}
