"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangleIcon,
  CalendarIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  SearchIcon,
  UndoIcon,
  UsersIcon,
  XIcon,
} from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { useIsMobile } from "@/hooks/useIsMobile";
import { addDays, todayInIndia } from "@/lib/dateOnly";
import { formatMonth } from "@/lib/format";
import { isAdmin } from "@/lib/routePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/pageHeader";
import { SegmentedControl } from "@/components/ui/segmentedControl";
import { Tabs } from "@/components/ui/tabs";
import { BusyOverlay } from "@/components/busyOverlay";
import { EmptyState } from "@/components/emptyState";
import { ErrorState } from "@/components/errorState";
import { PageLoadingSkeleton } from "@/components/pageLoadingSkeleton";
import { AttendanceDayList } from "./attendanceDayList";
import { AttendanceMonthView } from "./attendanceMonthView";
import { AttendanceRollCall } from "./attendanceRollCall";
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
  formatMonthShort,
  formatWeekday,
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
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const applyDay = useCallback((next: AttendanceDay) => {
    setDay(next);
    setMarks(
      Object.fromEntries(
        next.drivers.map((d) => [d.driver_id, { shifts: d.shifts, status: d.status }]),
      ),
    );
  }, []);

  // Tapping "next day" (or month) quickly fires overlapping requests, and a
  // slow early one can land after a fast later one. Each fetch takes a
  // ticket; only the newest is allowed to touch the screen.
  const dayTicket = useRef(0);
  const monthTicket = useRef(0);

  const fetchDay = useCallback(
    async (date?: string) => {
      const ticket = ++dayTicket.current;
      try {
        setDayLoading(true);
        setDayError(null);
        setSaveError(null);
        setJustSaved(false);
        const res = await fetch(`/api/driver-attendance${date ? `?date=${date}` : ""}`);
        const next = await readJson<AttendanceDay>(res, "Failed to load attendance");
        if (ticket === dayTicket.current) applyDay(next);
      } catch (err) {
        if (ticket === dayTicket.current) {
          setDayError(err instanceof Error ? err.message : "Network error");
        }
      } finally {
        if (ticket === dayTicket.current) setDayLoading(false);
      }
    },
    [applyDay],
  );

  const fetchMonth = useCallback(async (target: string) => {
    const ticket = ++monthTicket.current;
    try {
      setMonthLoading(true);
      setMonthError(null);
      const res = await fetch(`/api/driver-attendance?month=${target}`);
      const next = await readJson<AttendanceMonth>(res, "Failed to load the register");
      if (ticket === monthTicket.current) setMonthData(next);
    } catch (err) {
      if (ticket === monthTicket.current) {
        setMonthError(err instanceof Error ? err.message : "Network error");
      }
    } finally {
      if (ticket === monthTicket.current) setMonthLoading(false);
    }
  }, []);

  // The "saved" note clears itself, so it reads as a confirmation rather
  // than a permanent label.
  useEffect(() => {
    if (!justSaved) return;
    const timer = setTimeout(() => setJustSaved(false), 3000);
    return () => clearTimeout(timer);
  }, [justSaved]);

  const initialFetchDone = useRef(false);
  useEffect(() => {
    if (!authLoading && !initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchDay();
    }
  }, [authLoading, fetchDay]);

  // The server's `today` is only as fresh as the last load. A page left open
  // past midnight would keep treating yesterday as today — "next day" stayed
  // disabled until a reload. The device clock (read in IST, once a minute and
  // whenever the tab comes back) can only move it forward, never back, so the
  // server still decides what may be edited.
  const [clockToday, setClockToday] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setClockToday(todayInIndia());
    const timer = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  const today = day ? (clockToday && clockToday > day.today ? clockToday : day.today) : "";

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
      present: all.filter((m) => m.shifts.length > 0).length,
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
    // Takes a ticket like a day load does: whichever of "save" and "load
    // another day" was asked for last is the one allowed to fill the screen.
    const ticket = ++dayTicket.current;
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
      const stored = await readJson<AttendanceDay>(res, "Failed to save attendance");
      if (ticket !== dayTicket.current) return;
      applyDay(stored);
      // The register's totals are now stale. If it is the view on screen,
      // reload it now — clearing it alone left its spinner turning forever,
      // because the register only loads when its tab is opened. Otherwise
      // drop it, and it reloads the next time the tab opens.
      if (view === "month") void fetchMonth(month ?? day.date.slice(0, 7));
      else setMonthData(null);
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
    // Not while a save is in flight: its response would land on top of the
    // day being opened.
    if (!day || saving || date > today) return;
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

  const isToday = day.date === today;
  const activeMonth = month ?? day.date.slice(0, 7);

  const filterItems: { key: AttendanceFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: counts.total },
    { key: "unmarked", label: isMobile ? "Left" : "Not marked", count: counts.unmarked },
    ...SHIFTS.map((s) => ({ key: s, label: s, count: counts.shift[s] })),
    { key: "off", label: "Off", count: counts.absent + counts.leave },
  ];

  const dateStepper = (
    <div className="flex min-w-0 items-center gap-1 md:gap-2">
      <Button
        variant="outline"
        size="sm"
        className="max-md:h-9 max-md:w-8 max-md:shrink-0 max-md:border-transparent max-md:bg-transparent max-md:p-0"
        onClick={() => goToDate(addDays(day.date, -1))}
        aria-label="Previous day"
      >
        <ChevronLeftIcon size={16} />
      </Button>
      {/* The label doubles as the date picker: a transparent native input
          sits over it, so a tap opens the platform calendar. */}
      <label className="relative min-w-0 cursor-pointer text-center font-semibold text-foreground md:min-w-[9.5rem]">
        {isMobile ? (
          // Two short lines instead of one long one, so the stepper, search
          // and Day/Month switch all fit a 360px-wide phone.
          <>
            <span className="block truncate text-sm leading-tight">
              {formatDayLabel(day.date).split(", ")[1]}
            </span>
            <span className="block truncate text-[0.6875rem] font-normal leading-tight text-muted-foreground">
              {isToday ? "Today" : formatWeekday(day.date)}
            </span>
          </>
        ) : (
          <span className="whitespace-nowrap">
            {isToday
              ? `Today, ${formatDayLabel(day.date).split(", ")[1]}`
              : formatDayLabel(day.date)}
          </span>
        )}
        <input
          type="date"
          data-testid="attendance-date-input"
          aria-label="Choose date"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          value={day.date}
          max={today}
          onChange={(e) => e.target.value && goToDate(e.target.value)}
        />
      </label>
      <Button
        variant="outline"
        size="sm"
        className="max-md:h-9 max-md:w-8 max-md:shrink-0 max-md:border-transparent max-md:bg-transparent max-md:p-0"
        onClick={() => goToDate(addDays(day.date, 1))}
        disabled={isToday}
        aria-label="Next day"
      >
        <ChevronRightIcon size={16} />
      </Button>
      {!isToday && (
        <Button variant="ghost" size="sm" className="max-md:hidden" onClick={() => goToDate(today)}>
          Today
        </Button>
      )}
    </div>
  );

  const monthStepper = (
    <div className="flex min-w-0 items-center gap-1 md:gap-2">
      <Button
        variant="outline"
        size="sm"
        className="max-md:h-9 max-md:w-8 max-md:shrink-0 max-md:border-transparent max-md:bg-transparent max-md:p-0"
        onClick={() => openMonth(addMonths(activeMonth, -1))}
        aria-label="Previous month"
      >
        <ChevronLeftIcon size={16} />
      </Button>
      <span className="min-w-0 truncate whitespace-nowrap text-center font-semibold text-foreground max-md:text-sm md:min-w-[9.5rem]">
        {isMobile ? formatMonthShort(activeMonth) : formatMonth(activeMonth)}
      </span>
      <Button
        variant="outline"
        size="sm"
        className="max-md:h-9 max-md:w-8 max-md:shrink-0 max-md:border-transparent max-md:bg-transparent max-md:p-0"
        onClick={() => openMonth(addMonths(activeMonth, 1))}
        disabled={activeMonth >= today.slice(0, 7)}
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
        // Phones: a filled, borderless field at the same 36px height and
        // shape as the Day / Month track it takes the place of. Text stays
        // 16px so iOS doesn't zoom the page on focus.
        className="bg-background pl-9 pr-9 max-md:h-9 max-md:border-transparent max-md:bg-muted max-md:focus-visible:ring-1 max-md:focus-visible:ring-offset-0"
      />
      {search && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => setSearch("")}
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
          {/* -top-4 / -mt-4: the scrolling <main> has 1rem of padding, and a
              sticky child is held inside that padding — at top-0 the list
              showed through a 16px gap above this bar. */}
          <div className="sticky -top-4 z-10 -mx-4 -mt-4 space-y-2 border-b border-border bg-background px-4 pb-2.5 pt-2">
            {/* Search opens in place of this row rather than adding one
                below it, so the header keeps its height and the list
                doesn't jump. */}
            {searchOpen ? (
              <div className="flex items-center gap-2">
                {searchField}
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setSearchOpen(false);
                  }}
                  className="h-9 shrink-0 px-1 text-sm font-medium text-primary"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                {view === "day" ? dateStepper : monthStepper}
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label="Search drivers"
                    onClick={() => setSearchOpen(true)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground"
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
                    className="[&>button]:px-2.5 [&>button]:py-1"
                  />
                </div>
              </div>
            )}

            {view === "day" && (
              <>
                <AttendanceRollCall compact counts={counts} filter={filter} onFilter={setFilter} />
                {/* The same control as Day / Month, stretched edge to edge:
                    six equal cells, so nothing runs off the screen and
                    there is no sideways scrolling to discover. */}
                <SegmentedControl
                  idPrefix="attendance-filter"
                  items={filterItems}
                  value={filter}
                  onValueChange={(key) => setFilter(key as AttendanceFilter)}
                  className="flex w-full gap-0.5 [&>button]:min-w-0 [&>button]:flex-1 [&>button]:justify-center [&>button]:gap-1 [&>button]:whitespace-nowrap [&>button]:px-0 [&>button]:py-1 [&>button]:text-[13px]"
                />
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
            <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
              <AttendanceRollCall counts={counts} filter={filter} onFilter={setFilter} />
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
                      max={today.slice(0, 7)}
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
        isMobile ? (
          // Phones: a small floating pair in the thumb corner, just above
          // the dock, instead of a bar across the list. Discard is the
          // quiet icon and asks first, since one tap could undo a whole
          // day's marking.
          <div
            data-testid="attendance-save-bar"
            className="pointer-events-none sticky bottom-0 z-10 flex flex-col items-end gap-2"
          >
            {saveError && (
              <span
                role="alert"
                className="pointer-events-auto max-w-full rounded-lg border border-destructive/30 bg-card px-3 py-2 text-sm text-destructive shadow-lg"
              >
                {saveError}
              </span>
            )}
            <div className="pointer-events-auto flex items-center gap-2">
              <button
                type="button"
                aria-label={`Discard ${dirty.length} unsaved ${dirty.length === 1 ? "change" : "changes"}`}
                onClick={() => setConfirmDiscard(true)}
                disabled={saving}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-lg transition-transform active:scale-95 disabled:opacity-50"
              >
                <UndoIcon size={18} />
              </button>
              <Button
                data-testid="attendance-save-btn"
                onClick={save}
                disabled={saving}
                className="h-11 gap-2 rounded-xl px-4 shadow-lg transition-transform active:scale-95"
              >
                <CheckIcon size={18} />
                {saving ? "Saving…" : <>Save {dirty.length} {dirty.length === 1 ? "change" : "changes"}</>}
              </Button>
            </div>
          </div>
        ) : (
          <div
            data-testid="attendance-save-bar"
            className="sticky bottom-4 z-10 mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-lg"
          >
            <span className="text-sm text-muted-foreground">
              {dirty.length} unsaved {dirty.length === 1 ? "change" : "changes"} for{" "}
              {formatDayLabel(day.date)}
            </span>
            {saveError && (
              <span role="alert" className="order-last w-full text-sm text-destructive">
                {saveError}
              </span>
            )}
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={discard} disabled={saving}>
                Discard
              </Button>
              <Button data-testid="attendance-save-btn" onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save attendance"}
              </Button>
            </div>
          </div>
        )
      ) : (
        justSaved &&
        (isMobile ? (
          // Where the Save button just was — at the end of a 60-row list
          // nobody would see it.
          <div className="pointer-events-none sticky bottom-0 z-10 flex justify-end">
            <p
              role="status"
              className="flex h-11 items-center gap-2 rounded-xl border border-success/30 bg-success-subtle px-4 text-sm font-medium text-success-subtle-foreground shadow-lg animate-in fade-in-0 slide-in-from-bottom-2"
            >
              <CheckIcon size={18} />
              Saved
            </p>
          </div>
        ) : (
          <p role="status" className="text-center text-sm font-medium text-success-subtle-foreground">
            Attendance saved for {formatDayLabel(day.date)}.
          </p>
        ))
      )}

      <ConfirmModal
        isOpen={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          discard();
        }}
        title="Discard unsaved changes?"
        description={`${dirty.length} ${dirty.length === 1 ? "change" : "changes"} for ${formatDayLabel(day.date)} will be lost.`}
        confirmText="Discard"
        icon={<AlertTriangleIcon size={24} className="text-warning" />}
      />

      <ConfirmModal
        isOpen={pendingDate !== null}
        onClose={() => setPendingDate(null)}
        onConfirm={() => {
          const target = pendingDate;
          setPendingDate(null);
          if (!target) return;
          // Drop the marks now, not when the new day arrives — until then
          // the Save button would still offer what was just discarded.
          discard();
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
