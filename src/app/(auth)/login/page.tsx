import type { Metadata } from "next";

import { LoginPage } from "@/components/features/auth/login-page";

export const metadata: Metadata = {
  title: "로그인",
};

export default function Page() {
  return <LoginPage />;
}
