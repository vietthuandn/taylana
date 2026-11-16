import { BagIcon, BookIcon, BrushIcon, CdIcon, ChatIcon, FilmIcon, GalleryIcon, UploadIcon } from "@/components/decor/Icons";

const map: Record<string, React.ComponentType<{ className?: string }>> = {
  bag: BagIcon, book: BookIcon, brush: BrushIcon, chat: ChatIcon, cd: CdIcon, film: FilmIcon, upload: UploadIcon, gallery: GalleryIcon,
};

export function ServiceIcon({ name, className }: { name: string; className?: string }) {
  const Icon = map[name] ?? CdIcon;
  return <Icon className={className} />;
}
