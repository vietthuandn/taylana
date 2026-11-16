import Link from "next/link";
import { CdIcon, SparkleIcon } from "@/components/decor/Icons";

export function ComingSoon({ title }: { title: string }) {
  return (
    <section className="mx-auto max-w-xl px-4 py-16 text-center">
      <div className="tape pop relative rounded-[2rem] bg-cream-50 px-6 py-12">
        <SparkleIcon className="absolute left-6 top-6 h-6 w-6 text-pink-400 animate-wiggle" />
        <SparkleIcon className="absolute bottom-6 right-8 h-5 w-5 text-matcha-400 animate-wiggle" />
        <CdIcon className="mx-auto mb-4 h-20 w-20 animate-spin-slow" />
        <h1 className="text-3xl">{title}</h1>
        <p className="mt-3 text-cocoa-500">Tiệm đang chuẩn bị trang này, bạn quay lại sau ít hôm nhé ✿</p>
        <Link href="/" className="btn mt-6 bg-pink-200">← Về trang chủ</Link>
      </div>
    </section>
  );
}
