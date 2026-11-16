import { SparkleIcon } from "@/components/decor/Icons";

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="px-4 pb-6 pt-8 text-center">
      <h1 className="relative inline-block text-4xl">
        <SparkleIcon className="absolute -left-7 -top-1 h-5 w-5 text-pink-400 animate-wiggle" />
        {title}
        <SparkleIcon className="absolute -right-6 bottom-0 h-4 w-4 text-matcha-400 animate-wiggle" />
      </h1>
      {subtitle && <p className="mx-auto mt-2 max-w-xl text-cocoa-500">{subtitle}</p>}
    </div>
  );
}
