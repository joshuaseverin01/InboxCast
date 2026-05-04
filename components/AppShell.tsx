import { BottomNav } from "@/components/BottomNav";
import { FirstRunOnboarding } from "@/components/FirstRunOnboarding";
import { Sidebar } from "@/components/Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-app-shell text-mist-50">
      <Sidebar />
      <div className="min-h-screen lg:pl-72">
        <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
          {children}
        </main>
      </div>
      <BottomNav />
      <FirstRunOnboarding />
    </div>
  );
}
