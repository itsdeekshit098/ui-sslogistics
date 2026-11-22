"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "../../icons";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import type { FilterDrawerProps } from "./filterDrawer.types";
import { Backdrop, Body, CloseButton, Footer, FooterButton, Header, Panel, Title } from "./filterDrawer.styles";

export function FilterDrawer({
  open,
  onClose,
  onApply,
  children,
  title = "Filters",
}: FilterDrawerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEscapeKey(onClose, open);

  if (!open || !mounted || typeof document === "undefined") return null;

  const drawerContent = (
    <>
      <Backdrop data-ui="filter-drawer-backdrop" onClick={onClose} />

      <Panel data-ui="filter-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <Header>
          <Title>{title}</Title>
          <CloseButton type="button" onClick={onClose} aria-label="Close filters">
            <XIcon size={20} />
          </CloseButton>
        </Header>

        {/* Body — render filter fields as children */}
        <Body>{children}</Body>

        <Footer>
          <FooterButton variant="outline" onClick={onClose}>
            Close
          </FooterButton>
          <FooterButton onClick={onApply}>Apply Filters</FooterButton>
        </Footer>
      </Panel>
    </>
  );

  return createPortal(drawerContent, document.body);
}
