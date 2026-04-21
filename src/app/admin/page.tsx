import Link from "next/link";
import { Button } from "@/components/ui/button";
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
  ArrowLeft,
  Activity,
} from "lucide-react";

const menuItems = [
  {
    title: "Vehicles",
    description: "Manage fleet vehicles",
    href: "/admin/vehicles",
    icon: Truck,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-500/10",
    enabled: true,
  },
  {
    title: "Drivers",
    description: "Manage driver profiles",
    href: "/admin/drivers",
    icon: Users,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-500/10",
    enabled: false,
  },
  {
    title: "Clients",
    description: "Manage clients & vendors",
    href: "/admin/clients",
    icon: Building2,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-500/10",
    enabled: false,
  },
  {
    title: "Diesel Records",
    description: "Track fuel consumption",
    href: "/admin/diesel-records",
    icon: Fuel,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-500/10",
    enabled: false,
  },
  {
    title: "Repair Records",
    description: "Maintenance logs",
    href: "/admin/repair-records",
    icon: Wrench,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-500/10",
    enabled: false,
  },
  {
    title: "Trip Sheets",
    description: "Daily trip entries",
    href: "/admin/trip-sheets",
    icon: FileText,
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-50 dark:bg-indigo-500/10",
    enabled: false,
  },
  {
    title: "Reports",
    description: "View analytics",
    href: "/admin/reports",
    icon: BarChart3,
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-50 dark:bg-cyan-500/10",
    enabled: false,
  },
  {
    title: "Activity Log",
    description: "Track all actions",
    href: "/admin/activity-log",
    icon: Activity,
    color: "text-teal-600 dark:text-teal-400",
    bgColor: "bg-teal-50 dark:bg-teal-500/10",
    enabled: true,
  },
];

export default function DashboardPage() {
  return (
    <div className="container mx-auto space-y-6 md:space-y-8">
      <div className="mb-2">
        <Button variant="ghost" className="w-fit -ml-2 text-muted-foreground hover:text-foreground" asChild>
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-1 md:mt-2 text-base md:text-lg">
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
                <Card className="h-full transition-all duration-200 hover:shadow-lg hover:-translate-y-1 border-border/50 hover:border-primary/50 dark:hover:border-primary/50 active:scale-[0.98]">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
                    <div
                      className={`p-2 md:p-3 rounded-xl md:rounded-2xl ${item.bgColor}`}
                    >
                      <item.icon
                        className={`h-5 w-5 md:h-6 md:w-6 ${item.color}`}
                      />
                    </div>
                    <ArrowRight className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                  </CardHeader>
                  <CardContent className="pt-2 p-3 md:p-6 md:pt-4">
                    <CardTitle className="text-base md:text-xl font-bold text-foreground mb-1 md:mb-2 group-hover:text-primary transition-colors">
                      {item.title}
                    </CardTitle>
                    <p className="text-xs md:text-sm text-muted-foreground font-medium hidden sm:block">
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
              className="h-full opacity-50 cursor-not-allowed border-dashed border-border/40"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
                <div className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-muted">
                  <item.icon className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground/50" />
                </div>
                <div className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground font-medium">
                  Coming Soon
                </div>
              </CardHeader>
              <CardContent className="pt-2 p-3 md:p-6 md:pt-4">
                <CardTitle className="text-base md:text-xl font-bold text-muted-foreground/70 mb-1 md:mb-2">
                  {item.title}
                </CardTitle>
                <p className="text-xs md:text-sm text-muted-foreground/50 font-medium hidden sm:block">
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
