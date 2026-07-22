import type { Metadata } from "next";

import { NotificationListPage } from "@/components/features/requests/notification-list-page";

export const metadata: Metadata = {
  title: "알림 — Y.OS Core",
};

export default function NotificationsRoute() {
  return <NotificationListPage />;
}
