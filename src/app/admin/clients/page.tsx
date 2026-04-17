"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Building2, MapPin, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Client {
  id: string;
  name: string;
  location: string;
  type: string;
  activeContracts: string;
  status: string;
}

const mockClients: Client[] = [
  {
    id: "C-001",
    name: "KIA Motors (Main Plant)",
    location: "Erramanchi, Penukonda",
    type: "Primary",
    activeContracts: "Employee Transport, Logistics",
    status: "Active",
  },
  {
    id: "C-002",
    name: "Mobis India",
    location: "Industrial Park, Penukonda",
    type: "Vendor",
    activeContracts: "Employee Transport",
    status: "Active",
  },
  {
    id: "C-003",
    name: "Sungwoo Hitech",
    location: "Industrial Park, Penukonda",
    type: "Vendor",
    activeContracts: "Logistics",
    status: "Active",
  },
];

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>(mockClients);

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: "",
    location: "",
    type: "",
    activeContracts: "",
    status: "",
  });

  const handleEditClick = (client: Client) => {
    setEditingClient(client);
    setEditFormData({
      name: client.name,
      location: client.location,
      type: client.type,
      activeContracts: client.activeContracts,
      status: client.status,
    });
    setIsEditOpen(true);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleEditSelectChange = (field: string, value: string) => {
    setEditFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleUpdateClient = () => {
    setClients((prev) =>
      prev.map((c) =>
        editingClient && c.id === editingClient.id
          ? { ...c, ...editFormData }
          : c,
      ),
    );
    setIsEditOpen(false);
  };

  return (
    <div className="container mx-auto px-4 py-4 md:p-6 space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Clients & Companies
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Manage KIA plants and vendor companies.
          </p>
        </div>
        <Button className="w-full md:w-auto" asChild>
          <Link href="/admin/clients/new">
            <Plus className="mr-2 h-4 w-4" /> Add Client
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">
              Total Clients
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-xl md:text-2xl font-bold">
              {clients.length}
            </div>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Active companies
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">
              KIA Plants
            </CardTitle>
            <div className="h-2 w-2 rounded-full bg-blue-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-xl md:text-2xl font-bold">2</div>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Main & Engine Shop
            </p>
          </CardContent>
        </Card>
        <Card className="col-span-2 md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 md:p-6 md:pb-2">
            <CardTitle className="text-xs md:text-sm font-medium">
              Vendors
            </CardTitle>
            <div className="h-2 w-2 rounded-full bg-purple-500" />
          </CardHeader>
          <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
            <div className="text-xl md:text-2xl font-bold">10</div>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Sub-contractors
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="p-4 md:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg md:text-xl">Client List</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search clients..." className="pl-8" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0 md:pt-0">
          {/* Mobile Card View */}
          <div className="block md:hidden space-y-3">
            {clients.map((client) => (
              <div key={client.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{client.name}</span>
                  <Badge
                    variant={
                      client.status === "Active" ? "default" : "secondary"
                    }
                  >
                    {client.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>{client.location}</span>
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    {client.type}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => handleEditClick(client)}
                  >
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Active Contracts</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {client.location}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{client.type}</Badge>
                    </TableCell>
                    <TableCell>{client.activeContracts}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          client.status === "Active" ? "default" : "secondary"
                        }
                      >
                        {client.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditClick(client)}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>
              Make changes to the client&apos;s profile here. Click save when
              you&apos;re done.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Company
              </Label>
              <Input
                id="name"
                value={editFormData.name}
                onChange={handleEditChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="location" className="text-right">
                Location
              </Label>
              <Input
                id="location"
                value={editFormData.location}
                onChange={handleEditChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="type" className="text-right">
                Type
              </Label>
              <Select
                value={editFormData.type}
                onValueChange={(value) => handleEditSelectChange("type", value)}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Primary">Primary</SelectItem>
                  <SelectItem value="Vendor">Vendor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="activeContracts" className="text-right">
                Contracts
              </Label>
              <Input
                id="activeContracts"
                value={editFormData.activeContracts}
                onChange={handleEditChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">
                Status
              </Label>
              <Select
                value={editFormData.status}
                onValueChange={(value) =>
                  handleEditSelectChange("status", value)
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleUpdateClient}>
              <Save className="mr-2 h-4 w-4" />
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
