"use client";
import { useQuery } from "@tanstack/react-query";
import { api, useWorkspace } from "@/components/workspace";
import type { ScheduleResponse } from "@/lib/shared/types";
export function useSchedule(start: string, end: string, sourceIds?: string[]) {
  const { selected, preferences, ownerId } = useWorkspace();
  const sources = [...(sourceIds ?? selected)].sort().join(",");
  return useQuery({
    queryKey: ["events", ownerId, sources, start, end, preferences.timeZone],
    queryFn: ({ signal }) =>
      api<ScheduleResponse>(
        `/api/events?${new URLSearchParams({ start, end, timeZone: preferences.timeZone, sources })}`,
        { signal },
      ),
    refetchInterval: (query) =>
      query.state.data?.coverageComplete
          ? 120000
          : 5000,
    refetchIntervalInBackground: false,
    enabled: sources.length > 0,
  });
}
