import { UserAccessDetailPage } from "@/modules/rbac-admin/ui/user-access-detail-page";

export default async function DeskSecurityUserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return <UserAccessDetailPage userId={decodeURIComponent(userId)} />;
}
