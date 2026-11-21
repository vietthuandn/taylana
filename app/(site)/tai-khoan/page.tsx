import { PageHeader } from "@/components/ui/PageHeader";
import { AccountForm } from "./AccountForm";

export const metadata = { title: "Tài khoản của tôi", robots: { index: false } };

export default function AccountPage() {
  return (
    <>
      <PageHeader title="Tài khoản của tôi" />
      <AccountForm />
    </>
  );
}
