import { ShowcaseAdmin } from "./ShowcaseAdmin";
import { ReviewsAdmin } from "./ReviewsAdmin";

export default function ProductsAdmin() {
  return (
    <div className="max-w-4xl">
      <h1 className="mb-6 text-3xl">Sản phẩm & đánh giá</h1>
      <ShowcaseAdmin />
      <ReviewsAdmin />
    </div>
  );
}
