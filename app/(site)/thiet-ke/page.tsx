import CustomCdPage from "../custom-cd/page";

// Đường dẫn mới của Custom CD (đường dẫn cũ /custom-cd vẫn chạy)
export const metadata = { title: "Thiết Kế" };
export const revalidate = 60;
export default CustomCdPage;
