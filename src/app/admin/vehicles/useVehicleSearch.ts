import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Vehicle, VehicleType } from "./vehicles.types";
import { filterVehicles } from "./vehicles.utils";

const DEBOUNCE_DELAY = 300;

interface UseVehicleSearchResult {
  searchQuery: string;
  debouncedQuery: string;
  typeFilter: VehicleType | "all";
  filteredVehicles: Vehicle[];
  setSearchQuery: (query: string) => void;
  setTypeFilter: (type: VehicleType | "all") => void;
  resetFilters: () => void;
}

export const useVehicleSearch = (
  vehicles: Vehicle[],
): UseVehicleSearchResult => {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<VehicleType | "all">("all");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, DEBOUNCE_DELAY);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [searchQuery]);

  const filteredVehicles = useMemo(
    () => filterVehicles(vehicles, debouncedQuery, typeFilter),
    [vehicles, debouncedQuery, typeFilter],
  );

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setDebouncedQuery("");
    setTypeFilter("all");
  }, []);

  return {
    searchQuery,
    debouncedQuery,
    typeFilter,
    filteredVehicles,
    setSearchQuery,
    setTypeFilter,
    resetFilters,
  };
};
