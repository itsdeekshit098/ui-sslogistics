"use client";

import React from "react";
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import type { ConfirmModalProps } from "./confirmModal.types";
import {
    ModalContainer,
    IconWrapper,
    TextContainer,
    ModalTitle,
    ModalDesc,
    ActionWrapper
} from "./confirmModal.style";

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = "Confirm",
    cancelText = "Cancel",
    isLoading = false,
    icon,
    children
}) => {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md">
                <ModalContainer>
                    <IconWrapper>
                        {icon ? icon : <Trash2 />}
                    </IconWrapper>
                    <TextContainer>
                        <ModalTitle>{title}</ModalTitle>
                        <ModalDesc>{description}</ModalDesc>
                    </TextContainer>
                    
                    {children}

                    <ActionWrapper>
                        <Button
                            variant="outline"
                            onClick={onClose}
                            disabled={isLoading}
                        >
                            {cancelText}
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={onConfirm}
                            disabled={isLoading}
                        >
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {confirmText}
                        </Button>
                    </ActionWrapper>
                </ModalContainer>
            </DialogContent>
        </Dialog>
    );
};

export default ConfirmModal;
