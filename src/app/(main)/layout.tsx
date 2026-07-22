import { ProjectStoreProvider } from "@/components/features/projects/project-store";
import { ContextNav } from "@/components/layout/context-nav";
import { GlobalHeader } from "@/components/layout/global-header";
import { ShellProvider } from "@/components/layout/shell-context";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ShellProvider>
      <ProjectStoreProvider>
        <div className="flex h-dvh flex-col">
          <GlobalHeader />
          <div className="flex min-h-0 flex-1">
            <ContextNav />
            <main className="min-w-0 flex-1 overflow-y-auto bg-muted">
              {children}
            </main>
          </div>
        </div>
      </ProjectStoreProvider>
    </ShellProvider>
  );
}
