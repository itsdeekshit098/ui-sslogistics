"use client";

import { Spinner } from "../spinner";
import { Content, Pill, Root, StatusLayer } from "./loadingOverlay.styles";
import type { LoadingOverlayProps } from "./loadingOverlay.types";

/**
 * Keeps content on screen while it is being refetched, dimmed and behind a
 * spinner.
 *
 * This exists for the moment after a save: the record is written and the modal
 * has closed, but the page behind it is still a request away. Without it the
 * page sits on stale figures with nothing happening, and the new row appears
 * out of nowhere a second later. This is deliberately different from a list
 * page's <DataTable loading> skeleton: on a list, each fetch can be a wholly
 * different set of rows (new filter, new page), so blanking to skeleton and
 * rebuilding is correct. On a detail page, a refetch after a mutation is
 * still the same record — flashing the whole table to skeleton bars would
 * lose scroll position and overstate what actually changed, so it stays on
 * screen, dimmed, and updates in place. Covers detail-page tables (including
 * ones rendered through <DataTable>, which is why their `loading` prop is
 * left unset there) and card grids alike.
 */
export function LoadingOverlay({ busy, label = "Updating…", children, className }: LoadingOverlayProps) {
  return (
    <Root data-ui="loading-overlay" className={className}>
      <Content aria-busy={busy} $busy={busy}>
        {children}
      </Content>

      {busy && (
        <StatusLayer role="status" aria-live="polite">
          <Pill>
            <Spinner size="sm" />
            {label}
          </Pill>
        </StatusLayer>
      )}
    </Root>
  );
}
