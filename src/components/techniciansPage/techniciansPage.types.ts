export interface Technician {
  id: number;
  name: string;
  phone: string | null;
  location: string | null;
  specializations: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTechnicianPayload {
  name: string;
  phone?: string;
  location?: string;
  specializations: string[];
}

export interface UpdateTechnicianPayload {
  id: number;
  name?: string;
  phone?: string;
  location?: string;
  specializations?: string[];
  is_active?: boolean;
}

export interface SpecializationOption {
  id: number;
  name: string;
}
