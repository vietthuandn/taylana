import { GuideAdmin } from "./GuideAdmin";

export default function Page() {
  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-3xl">Hướng dẫn làm file</h1>
      <p className="mb-6 text-sm text-cocoa-500">Mỗi mục gồm tiêu đề, đoạn chữ, ảnh minh hoạ (kèm chú thích) và các link. Link trong đoạn chữ cũng tự bấm được.</p>
      <GuideAdmin />
    </div>
  );
}
