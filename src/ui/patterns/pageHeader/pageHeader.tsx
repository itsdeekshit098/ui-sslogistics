"use client";

import { ArrowLeftIcon, PlusIcon } from "../../icons";
import { FloatingActionButton } from "../../components/floatingActionButton";
import { Tooltip } from "../../components/tooltip";
import {
  Actions,
  BackLink,
  Description,
  DisabledInner,
  DisabledWrap,
  PrimaryButton,
  PrimaryIcon,
  Root,
  Row,
  Title,
  TitleRow,
  Titles,
} from "./pageHeader.styles";
import type { PageHeaderProps } from "./pageHeader.types";

/**
 * The title/description/actions block repeated at the top of every admin
 * page — previously hand-rebuilt per page with drifting heading sizes
 * (text-2xl vs text-3xl) and, on detail pages, a plain text "← Back" link
 * with no shared styling.
 *
 * Below md the mobile top bar already shows the page name and the back
 * button, so a list page's title block is hidden there, a detail page's
 * title shrinks, and `primaryAction` moves into a floating button.
 */
export function PageHeader({
  title,
  description,
  badge,
  backHref,
  backLabel = "Back",
  actions,
  primaryAction,
  className,
}: PageHeaderProps) {
  const isDetail = !!backHref;
  const primaryIcon = primaryAction?.icon ?? <PlusIcon size={16} />;

  const renderPrimaryButton = () =>
    primaryAction && (
      <PrimaryButton
        data-testid={primaryAction.testId}
        onClick={primaryAction.onClick}
        disabled={primaryAction.disabled}
      >
        <PrimaryIcon>{primaryIcon}</PrimaryIcon>
        {primaryAction.label}
      </PrimaryButton>
    );

  return (
    <>
      <Root data-ui="page-header" $hideOnPhone={!isDetail && !actions} className={className}>
        {backHref && (
          <BackLink href={backHref}>
            <ArrowLeftIcon size={16} /> {backLabel}
          </BackLink>
        )}

        <Row>
          <Titles $hideOnPhone={!isDetail}>
            <TitleRow>
              <Title>{title}</Title>
              {badge}
            </TitleRow>
            {description && <Description>{description}</Description>}
          </Titles>

          {(actions || primaryAction) && (
            <Actions $tiles={isDetail}>
              {actions}
              {primaryAction &&
                (primaryAction.disabled && primaryAction.disabledReason ? (
                  <Tooltip content={primaryAction.disabledReason}>
                    <DisabledWrap>
                      <DisabledInner>{renderPrimaryButton()}</DisabledInner>
                    </DisabledWrap>
                  </Tooltip>
                ) : (
                  renderPrimaryButton()
                ))}
            </Actions>
          )}
        </Row>
      </Root>

      {/* Sibling of the header, not inside it — the header itself is hidden on
          phones for list pages, which would take the floating button with it. */}
      {primaryAction && (
        <FloatingActionButton
          label={primaryAction.label}
          onClick={primaryAction.onClick}
          icon={primaryAction.icon}
          disabled={primaryAction.disabled}
          disabledReason={primaryAction.disabledReason}
          testId={primaryAction.testId ? `${primaryAction.testId}-fab` : undefined}
        />
      )}
    </>
  );
}
