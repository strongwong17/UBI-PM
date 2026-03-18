import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Toaster } from "@/components/ui/sonner";
import ContractStoreInitializer from "@/components/contracts/store-initializer";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex h-screen">
      <Sidebar
        userRole={(session.user as any).role || "VIEWER"}
        userName={session.user.name || "User"}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto bg-[#f8f9fa]">
          <div className="max-w-7xl mx-auto px-8 py-8">
            <ContractStoreInitializer />
            {children}
          </div>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
