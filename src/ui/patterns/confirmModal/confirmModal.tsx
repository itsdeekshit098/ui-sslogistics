"use client";

import { Modal } from "../../components/modal";
import {
  ActionButton,
  Actions,
  ButtonSpinner,
  Column,
  Content,
  DefaultIcon,
  Description,
  ErrorBanner,
  IconWrapper,
  Title,
} from "./confirmModal.styles";
import type { ConfirmModalProps } from "./confirmModal.types";

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isLoading = false,
  confirmDisabled = false,
  error = null,
  icon,
  children,
}: ConfirmModalProps) {
  return (
    <Modal open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Content>
        <Column>
          <IconWrapper>{icon ? icon : <DefaultIcon size={24} />}</IconWrapper>
          <div>
            <Title>{title}</Title>
            <Description>{description}</Description>
          </div>

          {error && <ErrorBanner role="alert">{error}</ErrorBanner>}

          {children}

          <Actions>
            <ActionButton
              data-testid="components-confirmModal-confirmModal-button-1"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              {cancelText}
            </ActionButton>
            <ActionButton
              data-testid="components-confirmModal-confirmModal-button-2"
              variant="destructive"
              onClick={onConfirm}
              disabled={isLoading || confirmDisabled}
            >
              {isLoading && <ButtonSpinner size="sm" />}
              {confirmText}
            </ActionButton>
          </Actions>
        </Column>
      </Content>
    </Modal>
  );
}
