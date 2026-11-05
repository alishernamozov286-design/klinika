import { KeyRound, UserCog } from "lucide-react";
import { PageHeader } from "@/components/ui-kit";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersPanel } from "@/components/users-panel";
import { RolesPanel } from "@/components/roles-panel";
import { useAuth } from "@/hooks/use-auth";

/**
 * Xodimlar: the staff accounts and the roles that decide what each can do
 * (TZ §3). Side by side because they are managed together — creating an
 * account means choosing its role, and changing a role changes accounts.
 */
export default function Staff() {
  const { can } = useAuth();
  const canUsers = can("users.manage");
  const canRoles = can("roles.manage", "users.manage");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Klinika"
        title="Xodimlar"
        description="Hisoblar, rollar va har bir rol nima qila olishi"
      />
      <Tabs defaultValue={canUsers ? "users" : "roles"}>
        <TabsList>
          {canUsers && (
            <TabsTrigger value="users" data-testid="tab-users">
              <UserCog className="mr-2 h-4 w-4" />
              Xodimlar
            </TabsTrigger>
          )}
          {canRoles && (
            <TabsTrigger value="roles" data-testid="tab-roles">
              <KeyRound className="mr-2 h-4 w-4" />
              Rollar va ruxsatlar
            </TabsTrigger>
          )}
        </TabsList>
        {canUsers && (
          <TabsContent value="users" className="mt-6">
            <UsersPanel />
          </TabsContent>
        )}
        {canRoles && (
          <TabsContent value="roles" className="mt-6">
            <RolesPanel />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
