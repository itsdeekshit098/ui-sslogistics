import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Truck,
  Users,
  Building2,
  Fuel,
  Wrench,
  FileText,
  BarChart3,
  ArrowRight,
} from "lucide-react";

const menuItems = [
  {
    title: "Vehicles",
    description: "Manage fleet vehicles",
    href: "/admin/vehicles",
    icon: Truck,
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    enabled: true,
  },
  {
    title: "Drivers",
    description: "Manage driver profiles",
    href: "/admin/drivers",
    icon: Users,
    color: "text-green-600",
    bgColor: "bg-green-100",
    enabled: false,
  },
  {
    title: "Clients",
    description: "Manage clients & vendors",
    href: "/admin/clients",
    icon: Building2,
    color: "text-purple-600",
    bgColor: "bg-purple-100",
    enabled: false,
  },
  {
    title: "Diesel Records",
    description: "Track fuel consumption",
    href: "/admin/diesel-records",
    icon: Fuel,
    color: "text-orange-600",
    bgColor: "bg-orange-100",
    enabled: false,
  },
  {
    title: "Repair Records",
    description: "Maintenance logs",
    href: "/admin/repair-records",
    icon: Wrench,
    color: "text-red-600",
    bgColor: "bg-red-100",
    enabled: false,
  },
  {
    title: "Trip Sheets",
    description: "Daily trip entries",
    href: "/admin/trip-sheets",
    icon: FileText,
    color: "text-indigo-600",
    bgColor: "bg-indigo-100",
    enabled: false,
  },
  {
    title: "Reports",
    description: "View analytics",
    href: "/admin/reports",
    icon: BarChart3,
    color: "text-cyan-600",
    bgColor: "bg-cyan-100",
    enabled: false,
  },
];

export default function DashboardPage() {
  return (
    <div className="container mx-auto px-4 py-4 md:p-8 space-y-6 md:space-y-8">
      <div>
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-slate-900">
          Dashboard
        </h1>
        <p className="text-slate-500 mt-1 md:mt-2 text-base md:text-lg">
          Select a module to manage operations.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
        {menuItems.map((item) => {
          const isEnabled = item.enabled;

          if (isEnabled) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group block h-full"
              >
                <Card className="h-full transition-all duration-200 hover:shadow-lg hover:-translate-y-1 border-slate-200 active:scale-[0.98]">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
                    <div
                      className={`p-2 md:p-3 rounded-xl md:rounded-2xl ${item.bgColor}`}
                    >
                      <item.icon
                        className={`h-5 w-5 md:h-6 md:w-6 ${item.color}`}
                      />
                    </div>
                    <ArrowRight className="h-4 w-4 md:h-5 md:w-5 text-slate-300 group-hover:text-slate-600 transition-colors" />
                  </CardHeader>
                  <CardContent className="pt-2 p-3 md:p-6 md:pt-4">
                    <CardTitle className="text-base md:text-xl font-bold text-slate-900 mb-1 md:mb-2 group-hover:text-indigo-600 transition-colors">
                      {item.title}
                    </CardTitle>
                    <p className="text-xs md:text-sm text-slate-500 font-medium hidden sm:block">
                      {item.description}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          }

          return (
            <Card
              key={item.href}
              className="h-full opacity-50 cursor-not-allowed border-dashed border-slate-300"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
                <div className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-slate-100">
                  <item.icon className="h-5 w-5 md:h-6 md:w-6 text-slate-400" />
                </div>
                <div className="text-xs bg-slate-100 px-2 py-1 rounded-full text-slate-500 font-medium">
                  Coming Soon
                </div>
              </CardHeader>
              <CardContent className="pt-2 p-3 md:p-6 md:pt-4">
                <CardTitle className="text-base md:text-xl font-bold text-slate-400 mb-1 md:mb-2">
                  {item.title}
                </CardTitle>
                <p className="text-xs md:text-sm text-slate-400 font-medium hidden sm:block">
                  {item.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
