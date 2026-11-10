import { StandaloneEdit } from "../../../_standalone/views";

export default async function EditFriendlyGamePage({ params }: PageProps<"/amicale/[id]/editeaza">) {
  const { id } = await params;
  return <StandaloneEdit competition="friendly" id={id} />;
}
