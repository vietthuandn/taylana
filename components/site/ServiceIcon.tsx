import { BagIcon, BookIcon, CdIcon, FilmIcon, GalleryIcon, UploadIcon } from "@/components/decor/Icons";

export function ServiceIcon({ name, className }: { name: string; className?: string }) {
  const map: Record<string, React.ComponentType<{ className?: string }>> = {
    bag: BagIcon,
    book: BookIcon,
    cd: CdIcon,
    film: FilmIcon,
    upload: UploadIcon,
    gallery: GalleryIcon,
  };
  const Icon = map[name] ?? CdIcon;
  return <Icon className={className} />;
}
