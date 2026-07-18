import Sidebar from "@/components/Sidebar";
import WorkerStatus from "@/components/WorkerStatus";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-y-auto">
        <WorkerStatus />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
