import { DocsSidebar } from "./DocsSidebar";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen pt-[57px]">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex gap-12 py-10">
          <DocsSidebar />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
