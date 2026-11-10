import { StandaloneEdit } from "../../../_standalone/views";

export default async function EditNationalGamePage({ params }: PageProps<"/national/[id]/editeaza">) {
  const { id } = await params;
  return <StandaloneEdit competition="national" id={id} />;
}
