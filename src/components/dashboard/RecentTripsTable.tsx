import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/dataTable";
import type { ColumnDef } from "@/components/ui/dataTable";

interface RecentTrip {
  id: string;
  vehicle: string;
  driver: string;
  route: string;
  status: string;
  time: string;
}

const recentTrips: RecentTrip[] = [
  {
    id: "TRIP-1024",
    vehicle: "AP 02 AB 1234",
    driver: "Ramesh Kumar",
    route: "KIA Plant -> Anantapur",
    status: "Completed",
    time: "10:30 AM",
  },
  {
    id: "TRIP-1025",
    vehicle: "AP 02 CD 5678",
    driver: "Suresh Babu",
    route: "Hindupur -> KIA Plant",
    status: "In Progress",
    time: "11:15 AM",
  },
  {
    id: "TRIP-1026",
    vehicle: "AP 02 EF 9012",
    driver: "Mahesh V",
    route: "KIA Plant -> Penukonda",
    status: "Scheduled",
    time: "02:00 PM",
  },
  {
    id: "TRIP-1027",
    vehicle: "AP 02 GH 3456",
    driver: "Naresh K",
    route: "Dharmavaram -> KIA Plant",
    status: "Completed",
    time: "09:00 AM",
  },
];

const columns: ColumnDef<RecentTrip>[] = [
  {
    key: "id",
    header: "Trip ID",
    cell: (row) => <span style={{ fontWeight: 500 }}>{row.id}</span>,
  },
  {
    key: "vehicle",
    header: "Vehicle",
    cell: (row) => row.vehicle,
  },
  {
    key: "driver",
    header: "Driver",
    cell: (row) => row.driver,
  },
  {
    key: "route",
    header: "Route",
    cell: (row) => row.route,
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => (
      <Badge
        variant={
          row.status === "Completed"
            ? "default"
            : row.status === "In Progress"
              ? "secondary"
              : "outline"
        }
      >
        {row.status}
      </Badge>
    ),
  },
];

export function RecentTripsTable() {
  return (
    <Card
      data-testid="components-dashboard-RecentTripsTable-card-1"
      className="col-span-1 md:col-span-3"
    >
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="text-base md:text-lg">Recent Trips</CardTitle>
      </CardHeader>
      <CardContent className="p-4 md:p-6 pt-0 md:pt-0">
        {/* Mobile Card View */}
        <div className="block md:hidden space-y-3">
          {recentTrips.map((trip) => (
            <div key={trip.id} className="border rounded-lg p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{trip.id}</span>
                <Badge
                  variant={
                    trip.status === "Completed"
                      ? "default"
                      : trip.status === "In Progress"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {trip.status}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                <div>
                  {trip.vehicle} • {trip.driver}
                </div>
                <div>{trip.route}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block">
          <DataTable<RecentTrip>
            columns={columns}
            data={recentTrips}
            rowKey={(row) => row.id}
            emptyMessage="No recent trips."
          />
        </div>
      </CardContent>
    </Card>
  );
}
