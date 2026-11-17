"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "./ui";

export function LogoutButton() {
  const router = useRouter();
  return (
    <Button variant="secondary" icon={<LogOut size={16} />}
      onClick={async () => {
        await createClient().auth.signOut();
        router.replace("/admin/login");
        router.refresh();
      }}>
      Đăng xuất
    </Button>
  );
}
