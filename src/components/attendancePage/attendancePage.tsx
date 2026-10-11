"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangleIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  SearchIcon,
  UsersIcon,
  XCircleIcon,
  XIcon,
} from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { useIsMobile } from "@/hooks/useIsMobile";
import { addDays } from "@/lib/dateOnly";
import { formatMonth } from "@/lib/format";
import { isAdmin } from "@/lib/routePermissions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/pageHeader";
import { SegmentedControl } from "@/components/ui/segmentedControl";
import { StatCard } from "@/components/ui/statCard";
import { Tabs } from "@/components/ui/tabs";
import { BusyOverlay } from "@/components/busyOverlay";
import { EmptyState } from "@/components/emptyState";
import { ErrorState } from "@/components/errorState";
import { PageLoadingSkeleton } from "@/components/pageLoadingSkeleton";
import { AttendanceDayList } from "./attendanceDayList";
import { AttendanceMonthView } from "./attendanceMonthView";
import {
  SHIFTS,
  type AttendanceDay,
  type AttendanceFilter,
  type AttendanceMark,
  type AttendanceMonth,
  type SaveAttendancePayload,
} from "./attendancePage.types";
import {
  FULL_DAY,
  addMonths,
  formatDayLabel,
  isFullDay,
  isMarked,
  matchesFilter,
  sameMark,
} from "./attendancePage.utils";

const ConfirmModal = dynamic(() => import("@/components/confirmModal/confirmModal"), {
  ssr: false,
});

type View = "day" | "month";

const VIEW_TABS = [
  { key: "day", label: "Daily marking" },
  { key: "month", label: "Monthly register" },
];

async function readJson<T>(res: Response, fallback: string): Promise<T> {
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) throw new Error(json?.error || fallback);
  return json.data as T;
}

export function AttendancePage() {
  const { userRole, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  // Wages are worked out from the export, so it is offered to admins only.
  const canExport = isAdmin(userRole);

  const [day, setDay] = useState<AttendanceDay | null>(null);
  // The working copy. `day` stays as the server last returned it, so the
  // difference between the two is exactly what a save has to send.
  const [marks, setMarks] = useState<Record<number, AttendanceMark>>({});
  const [dayLoading, setDayLoading] = useState(true);
  const [dayError, setDayError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const [view, setView] = useState<View>("day");
  const [month, setMonth] = useState<string | null>(null);
  const [monthData, setMonthData] = useState<AttendanceMonth | null>(null);
  const [monthLoading, setMonthLoading] = useState(false);
  const [monthError, setMonthError] = useState<string | null>(null);

  const [filter, setFilter] = useState<AttendanceFilter>("all");
  const [search, setSearch] = useState("");
  // Phones keep the search field folded behind an icon so the pinned header
  // stays short; desktop always shows it.
  const [searchOpen, setSearchOpen] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // A date change that would drop unsaved marks waits here for a confirm.
  const [pendingDate, setPendingDate] = useState<string | null>(null);

  const applyDay = useCallback((next: AttendanceDay) => {
    setDay(next);
    setMarks(
      Object.fromEntries(
        next.drivers.map((d) => [d.driver_id, { shifts: d.shifts, status: d.status }]),
      ),
    );
  }, []);

  const fetchDay = useCallback(
    async (date?: string) => {
      try {
        setDayLoading(true);
        setDayError(null);
        setSaveError(null);
        setJustSaved(false);
        const res = await fetch(`/api/driver-attendance${date ? `?date=${date}` : ""}`);
        applyDay(await readJson<AttendanceDay>(res, "Failed to load attendance"));
      } catch (err) {
        setDayError(err instanceof Error ? err.message : "Network error");
      } finally {
        setDayLoading(false);
      }
    },
    [applyDay],
  );

  const fetchMonth = useCallback(async (target: string) => {
    try {
      setMonthLoading(true);
      setMonthError(null);
      const res = await fetch(`/api/driver-attendance?month=${target}`);
      setMonthData(await readJson<AttendanceMonth>(res, "Failed to load the register"));
    } catch (err) {
      setMonthError(err instanceof Error ? err.message : "Network error");
    } finally {
      setMonthLoading(false);
    }
  }, []);

  const initialFetchDone = useRef(false);
  useEffect(() => {
    if (!authLoading && !initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchDay();
    }
  }, [authLoading, fetchDay]);

  const drivers = useMemo(() => day?.drivers ?? [], [day]);
  const markOf = useCallback(
    (driverId: number): AttendanceMark => marks[driverId] ?? { shifts: [], status: null },
    [marks],
  );

  const dirty = useMemo(
    () => drivers.filter((d) => !sameMark(markOf(d.driver_id), d)),
    [drivers, markOf],
  );

  const counts = useMemo(() => {
    const all = drivers.map((d) => markOf(d.driver_id));
    return {
      total: all.length,
      unmarked: all.filter((m) => !isMarked(m)).length,
      absent: all.filter((m) => m.status === "ABSENT").length,
      leave: all.filter((m) => m.status === "LEAVE").length,
      fullDay: all.filter(isFullDay).length,
      shift: Object.fromEntries(
        SHIFTS.map((s) => [s, all.filter((m) => m.shifts.includes(s)).length]),
      ) as Record<(typeof SHIFTS)[number], number>,
    };
  }, [drivers, markOf]);

  const query = search.trim().toLowerCase();
  const matchesSearch = useCallback(
    (d: { name: string; place: string | null }) =>
      !query || d.name.toLowerCase().includes(query) || (d.place ?? "").toLowerCase().includes(query),
    [query],
  );

  const visibleDrivers = useMemo(
    () => drivers.filter((d) => matchesFilter(markOf(d.driver_id), filter) && matchesSearch(d)),
    [drivers, markOf, filter, matchesSearch],
  );

  const visibleMonth = useMemo(
    () => monthData && { ...monthData, drivers: monthData.drivers.filter(matchesSearch) },
    [monthData, matchesSearch],
  );

  const copyableFromYesterday = useMemo(
    () =>
      drivers.filter((d) => !isMarked(markOf(d.driver_id)) && d.previous && isMarked(d.previous))
        .length,
    [drivers, markOf],
  );

  const editable = !!day?.editable && !saving;

  const setMark = (driverId: number, mark: AttendanceMark) => {
    setJustSaved(false);
    setMarks((prev) => ({ ...prev, [driverId]: mark }));
  };

  /** Applies a mark to every driver still unmarked; `pick` may skip one by returning null. */
  const fillUnmarked = (pick: (driver: AttendanceDay["drivers"][number]) => AttendanceMark | null) => {
    setJustSaved(false);
    setMarks((prev) => {
      const next = { ...prev };
      for (const driver of drivers) {
        if (isMarked(prev[driver.driver_id] ?? { shifts: [], status: null })) continue;
        const mark = pick(driver);
        if (mark) next[driver.driver_id] = mark;
      }
      return next;
    });
  };

  const discard = () => {
    if (day) applyDay(day);
    setSaveError(null);
  };

  const save = async () => {
    if (!day || dirty.length === 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload: SaveAttendancePayload = {
        date: day.date,
        entries: dirty.map((d) => ({ driver_id: d.driver_id, ...markOf(d.driver_id) })),
      };
      const res = await fetch("/api/driver-attendance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      applyDay(await readJson<AttendanceDay>(res, "Failed to save attendance"));
      // The register's totals are now stale; it reloads the next time it opens.
      setMonthData(null);
      setJustSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  };

  const exportMonth = async (target: string) => {
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch(`/api/driver-attendance/export?month=${target}`);
      if (!res.ok) throw new Error("Export failed");
      const url = window.URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `driver_attendance_${target}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setExportError("Couldn't download the export. Try again.");
    } finally {
      setExporting(false);
    }
  };

  const goToDate = (date: string) => {
    if (!day || date > day.today) return;
    if (dirty.length > 0) {
      setPendingDate(date);
      return;
    }
    setView("day");
    setFilter("all");
    void fetchDay(date);
  };

  const openMonth = (target: string) => {
    setMonth(target);
    void fetchMonth(target);
  };

  const changeView = (next: string) => {
    setView(next as View);
    if (next !== "month" || !day) return;
    const target = month ?? day.date.slice(0, 7);
    if (monthData?.month !== target) openMonth(target);
  };

  if (authLoading || (dayLoading && !day)) return <PageLoadingSkeleton variant="admin" />;
  if (!day) {
    return (
      <ErrorState
        title="Couldn't load attendance"
        description={dayError ?? undefined}
        onRetry={() => fetchDay()}
      />
    );
  }

  const isToday = day.date === day.today;
  const activeMonth = month ?? day.date.slice(0, 7);
  const marked = counts.total - counts.unmarked;

  const filterItems: { key: AttendanceFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: counts.total },
    { key: "unmarked", label: isMobile ? "Unmarked" : "Not marked", count: counts.unmarked },
    ...SHIFTS.map((s) => ({ key: s, label: s, count: counts.shift[s] })),
    { key: "off", label: "Off", count: counts.absent + counts.leave },
  ];

  const dateStepper = (
    <div className="flex items-center gap-1 md:gap-2">
      <Button
        variant="outline"
        size="sm"
        className="max-md:h-10 max-md:w-10 max-md:border-transparent max-md:bg-transparent max-md:p-0"
        onClick={() => goToDate(addDays(day.date, -1))}
        aria-label="Previous day"
      >
        <ChevronLeftIcon size={16} />
      </Button>
      {/* The label doubles as the date picker: a transparent native input
          sits over it, so a tap opens the platform calendar. */}
      <label className="relative min-w-0 cursor-pointer text-center font-semibold text-foreground md:min-w-[9.5rem]">
        <span className="whitespace-nowrap">
          {isToday ? `Today, ${formatDayLabel(day.date).split(", ")[1]}` : formatDayLabel(day.date)}
        </span>
        <input
          type="date"
          data-testid="attendance-date-input"
          aria-label="Choose date"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          value={day.date}
          max={day.today}
          onChange={(e) => e.target.value && goToDate(e.target.value)}
        />
      </label>
      <Button
        variant="outline"
        size="sm"
        className="max-md:h-10 max-md:w-10 max-md:border-transparent max-md:bg-transparent max-md:p-0"
        onClick={() => goToDate(addDays(day.date, 1))}
        disabled={isToday}
        aria-label="Next day"
      >
        <ChevronRightIcon size={16} />
      </Button>
      {!isToday && (
        <Button variant="ghost" size="sm" className="max-md:hidden" onClick={() => goToDate(day.today)}>
          Today
        </Button>
      )}
    </div>
  );

  const monthStepper = (
    <div className="flex items-center gap-1 md:gap-2">
      <Button
        variant="outline"
        size="sm"
        className="max-md:h-10 max-md:w-10 max-md:border-transparent max-md:bg-transparent max-md:p-0"
        onClick={() => openMonth(addMonths(activeMonth, -1))}
        aria-label="Previous month"
      >
        <ChevronLeftIcon size={16} />
      </Button>
      <span className="min-w-0 whitespace-nowrap text-center font-semibold text-foreground md:min-w-[9.5rem]">
        {formatMonth(activeMonth)}
      </span>
      <Button
        variant="outline"
        size="sm"
        className="max-md:h-10 max-md:w-10 max-md:border-transparent max-md:bg-transparent max-md:p-0"
        onClick={() => openMonth(addMonths(activeMonth, 1))}
        disabled={activeMonth >= day.today.slice(0, 7)}
        aria-label="Next month"
      >
        <ChevronRightIcon size={16} />
      </Button>
    </div>
  );

  const bulkActions = day.editable && counts.unmarked > 0 && (
    <>
      <Button
        variant="outline"
        size="sm"
        data-testid="attendance-fill-full-day"
        disabled={saving}
        onClick={() => fillUnmarked(() => FULL_DAY)}
      >
        {isMobile ? "Full day" : "Mark full day"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={saving}
        onClick={() => fillUnmarked(() => ({ shifts: [], status: "ABSENT" }))}
      >
        {isMobile ? "Absent" : "Mark absent"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={saving || copyableFromYesterday === 0}
        onClick={() => fillUnmarked((d) => (d.previous && isMarked(d.previous) ? d.previous : null))}
      >
        {isMobile ? "As yesterday" : "Copy yesterday"}
      </Button>
    </>
  );

  const readOnlyNote = !day.editable && (
    <p className="text-sm text-muted-foreground">
      Only an admin can mark attendance.
    </p>
  );

  const dayBody =
    drivers.length === 0 ? (
      <EmptyState
        title="No drivers yet"
        description="Add drivers on the Drivers page to start marking attendance."
        icon={UsersIcon}
      />
    ) : visibleDrivers.length === 0 ? (
      <EmptyState
        title={filter === "unmarked" && !search ? "Everyone is marked" : "No drivers here"}
        description={
          filter === "unmarked" && !search
            ? "Every driver has a mark for this day."
            : "No drivers match this filter."
        }
        icon={SearchIcon}
      />
    ) : (
      <AttendanceDayList
        drivers={visibleDrivers}
        marks={marks}
        editable={editable}
        isMobile={isMobile}
        onChange={setMark}
      />
    );

  const monthBody = monthError ? (
    <ErrorState
      title="Couldn't load the register"
      description={monthError}
      onRetry={() => fetchMonth(activeMonth)}
    />
  ) : !monthData ? (
    <BusyOverlay busy label="Loading…">
      <div className="h-40" />
    </BusyOverlay>
  ) : !visibleMonth || visibleMonth.drivers.length === 0 ? (
    <EmptyState
      title={query ? "No drivers found" : "Nothing marked"}
      description={
        query ? "No driver matches this search." : "No attendance has been marked in this month."
      }
      icon={query ? SearchIcon : CalendarIcon}
    />
  ) : (
    <BusyOverlay busy={monthLoading}>
      <AttendanceMonthView data={visibleMonth} isMobile={isMobile} onOpenDay={goToDate} />
    </BusyOverlay>
  );

  const searchField = (
    <div className="relative w-full md:max-w-xs">
      <SearchIcon
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        data-testid="attendance-search-input"
        placeholder="Search driver or place..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        // Phones open the field from the search icon, so focus goes with it.
        autoFocus={isMobile}
        className="bg-background pl-9 pr-9"
      />
      {(search || isMobile) && (
        <button
          type="button"
          aria-label={search ? "Clear search" : "Close search"}
          onClick={() => {
            if (!search) setSearchOpen(false);
            setSearch("");
          }}
          className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <XIcon size={16} />
        </button>
      )}
    </div>
  );

  const exportButton = canExport && (
    <Button
      variant="outline"
      size="sm"
      data-testid="attendance-export-btn"
      disabled={exporting || !monthData || monthData.drivers.length === 0}
      onClick={() => exportMonth(activeMonth)}
    >
      <DownloadIcon size={16} className="mr-2" />
      {exporting ? "Preparing…" : "Export for wages"}
    </Button>
  );

  return (
    <div className="container mx-auto space-y-6 md:space-y-8">
      <PageHeader title="Attendance" description="Who drove which shift, day by day." />

      {isMobile ? (
        <div className="space-y-3">
          {/* Pinned while the list scrolls: where you are, how far along,
              and the counts — which are also the filter. */}
          <div className="sticky top-0 z-10 -mx-4 -mt-4 space-y-2 border-b border-border bg-background px-4 pb-2.5 pt-2">
            <div className="flex items-center justify-between gap-2">
              {view === "day" ? dateStepper : monthStepper}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Search drivers"
                  aria-expanded={searchOpen}
                  onClick={() => {
                    if (searchOpen) setSearch("");
                    setSearchOpen(!searchOpen);
                  }}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground",
                    (searchOpen || query) && "bg-muted text-foreground",
                  )}
                >
                  <SearchIcon size={18} />
                </button>
                <SegmentedControl
                  idPrefix="attendance-view"
                  items={[
                    { key: "day", label: "Day" },
                    { key: "month", label: "Month" },
                  ]}
                  value={view}
                  onValueChange={changeView}
                />
              </div>
            </div>

            {searchOpen && searchField}

            {view === "day" && (
              <>
                <div className="flex items-center gap-2 text-[0.6875rem] tabular-nums text-muted-foreground">
                  <span className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-primary transition-[width] duration-200"
                      style={{
                        width: `${counts.total ? Math.round((marked / counts.total) * 100) : 0}%`,
                      }}
                    />
                  </span>
                  {marked} of {counts.total} marked
                </div>
                <div
                  role="radiogroup"
                  aria-label="Filter drivers"
                  className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {filterItems.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      role="radio"
                      aria-checked={filter === item.key}
                      onClick={() => setFilter(item.key)}
                      className={cn(
                        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition-colors",
                        filter === item.key
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-card text-muted-foreground",
                      )}
                    >
                      {item.label}
                      <span className="font-medium tabular-nums opacity-70">{item.count}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {view === "day" ? (
            <BusyOverlay busy={dayLoading}>
              <div className="space-y-3">
                {dayError && <p className="text-sm text-destructive">{dayError}</p>}
                {readOnlyNote}
                {bulkActions && (
                  <div className="flex items-center gap-1.5 rounded-xl border border-warning/40 bg-warning-subtle px-3 py-2 text-[13px] font-semibold text-warning-subtle-foreground [&>button]:h-8 [&>button]:bg-card [&>button]:px-2.5 [&>button]:text-foreground">
                    <span className="min-w-0 flex-1">{counts.unmarked} left</span>
                    {bulkActions}
                  </div>
                )}
                {dayBody}
              </div>
            </BusyOverlay>
          ) : (
            <div className="space-y-3">
              {exportButton && (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {exportError && <span className="text-sm text-destructive">{exportError}</span>}
                  {exportButton}
                </div>
              )}
              {monthBody}
            </div>
          )}
        </div>
      ) : (
        <>
          {view === "day" && (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5 max-xl:[&>*:last-child:nth-child(odd)]:col-span-2">
              {SHIFTS.map((shift) => (
                <StatCard
                  key={shift}
                  title={`Shift ${shift}`}
                  value={counts.shift[shift]}
                  subtext="drivers"
                  icon={<UsersIcon size={18} />}
                  onClick={() => setFilter(shift)}
                />
              ))}
              <StatCard
                title="Off today"
                value={counts.absent + counts.leave}
                subtext={`${counts.absent} absent · ${counts.leave} leave`}
                icon={<XCircleIcon size={18} />}
                onClick={() => setFilter("off")}
              />
              <StatCard
                title="Not marked"
                value={counts.unmarked > 0 ? counts.unmarked : "None"}
                subtext={`${counts.fullDay} on full day`}
                icon={<AlertTriangleIcon size={18} />}
                tone={counts.unmarked > 0 ? "warning" : "neutral"}
                onClick={counts.unmarked > 0 ? () => setFilter("unmarked") : undefined}
              />
            </div>
          )}

          <div className="ss-panel overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="border-b border-border p-4 sm:p-6">
              <Tabs idPrefix="attendance" items={VIEW_TABS} value={view} onValueChange={changeView} />
            </div>

            {view === "day" ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
                  {dateStepper}
                  {bulkActions ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {counts.unmarked} unmarked:
                      </span>
                      {bulkActions}
                    </div>
                  ) : (
                    readOnlyNote
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
                  <SegmentedControl
                    idPrefix="attendance-filter"
                    items={filterItems}
                    value={filter}
                    onValueChange={(key) => setFilter(key as AttendanceFilter)}
                  />
                  {searchField}
                </div>
                {dayError && <p className="px-4 pt-3 text-sm text-destructive sm:px-6">{dayError}</p>}
                <BusyOverlay busy={dayLoading}>{dayBody}</BusyOverlay>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
                  <div className="flex flex-wrap items-center gap-3">
                    {monthStepper}
                    <Input
                      type="month"
                      data-testid="attendance-month-input"
                      aria-label="Choose month"
                      className="w-auto"
                      value={activeMonth}
                      max={day.today.slice(0, 7)}
                      onChange={(e) => e.target.value && openMonth(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
                    {exportError && <span className="text-sm text-destructive">{exportError}</span>}
                    {searchField}
                    {exportButton}
                  </div>
                </div>
                <div className="p-4 sm:p-6">{monthBody}</div>
              </>
            )}
          </div>
        </>
      )}

      {/* Outside the panel on purpose: the panel clips overflow, which would
          stop this from sticking to the bottom of the scrolling page. */}
      {dirty.length > 0 ? (
        <div
          data-testid="attendance-save-bar"
          className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 border-border bg-card max-md:-mx-4 max-md:-mb-4 max-md:border-t max-md:px-4 max-md:py-2.5 md:bottom-4 md:mx-auto md:max-w-2xl md:justify-between md:rounded-xl md:border md:px-4 md:py-2.5 md:shadow-lg"
        >
          <span className="text-sm text-muted-foreground max-md:hidden">
            {dirty.length} unsaved {dirty.length === 1 ? "change" : "changes"} for{" "}
            {formatDayLabel(day.date)}
          </span>
          {saveError && (
            <span role="alert" className="w-full text-sm text-destructive md:order-last">
              {saveError}
            </span>
          )}
          <div className="flex items-center gap-2 max-md:w-full">
            <Button variant="ghost" onClick={discard} disabled={saving} className="max-md:h-11">
              Discard
            </Button>
            <Button
              data-testid="attendance-save-btn"
              onClick={save}
              disabled={saving}
              className="max-md:h-11 max-md:flex-1"
            >
              {saving
                ? "Saving…"
                : isMobile
                  ? `Save ${dirty.length} ${dirty.length === 1 ? "change" : "changes"}`
                  : "Save attendance"}
            </Button>
          </div>
        </div>
      ) : (
        justSaved && (
          <p role="status" className="text-center text-sm font-medium text-success-subtle-foreground">
            Attendance saved for {formatDayLabel(day.date)}.
          </p>
        )
      )}

      <ConfirmModal
        isOpen={pendingDate !== null}
        onClose={() => setPendingDate(null)}
        onConfirm={() => {
          const target = pendingDate;
          setPendingDate(null);
          if (!target) return;
          setView("day");
          setFilter("all");
          void fetchDay(target);
        }}
        title="Discard unsaved changes?"
        description={`${dirty.length} ${dirty.length === 1 ? "change" : "changes"} for ${formatDayLabel(day.date)} have not been saved.`}
        confirmText="Discard"
        icon={<AlertTriangleIcon size={24} className="text-warning" />}
      />
    </div>
  );
}
