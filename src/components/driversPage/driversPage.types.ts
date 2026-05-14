export interface Driver {
  id: number;
  name: string;
  phone: string | null;
  place: string | null;
  dl_number: string | null;
  photo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateDriverPayload {
  name: string;
  phone?: string;
  place?: string;
  dl_number?: string;
  photo_url?: string;
}

export interface UpdateDriverPayload {
  id: number;
  name?: string;
  phone?: string;
  place?: string;
  dl_number?: string;
  photo_url?: string;
  is_active?: boolean;
}
