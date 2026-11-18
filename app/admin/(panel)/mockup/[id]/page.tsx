import { FrameEditor } from "./FrameEditor";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FrameEditor id={id} />;
}
