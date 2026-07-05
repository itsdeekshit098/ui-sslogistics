import { WrenchIcon } from "@/components/ui/icon";

interface MaintenanceScreenProps {
  message?: string | null;
}

export function MaintenanceScreen({ message }: MaintenanceScreenProps) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[#0c1521] px-6 text-center text-white"
      data-testid="maintenance-screen"
    >
      <div className="rounded-full bg-amber-500/10 p-5">
        <WrenchIcon size={40} className="text-amber-400" />
      </div>
      <h1 className="text-2xl font-semibold">We&apos;ll be right back</h1>
      <p className="max-w-md text-sm text-slate-400">
        {message || "The app is currently undergoing scheduled maintenance. Please check back shortly."}
      </p>
    </div>
  );
}
