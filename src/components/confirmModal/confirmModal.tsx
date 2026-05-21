"use client";

import React from "react";
import {
    Modal,
    ModalContent,
} from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Trash2Icon } from "@/components/ui/icon";
import { LoadingSpinner } from "@/components/loadingSpinner";
import type { ConfirmModalProps } from "./confirmModal.types";
import * as styles from "./confirmModal.style";

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = "Confirm",
    cancelText = "Cancel",
    isLoading = false,
    error = null,
    icon,
    children
}) => {
    return (
        <Modal open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <ModalContent style={styles.modalContent}>
                <div style={styles.container}>
                    <div style={styles.iconWrapper}>
                        {icon ? icon : <Trash2Icon size={24} style={{ color: "#dc2626" }} />}
                    </div>
                    <div style={styles.textContainer}>
                        <h3 style={styles.title}>{title}</h3>
                        <p style={styles.description}>{description}</p>
                    </div>

                    {error && (
                        <div style={styles.errorBanner} role="alert">
                            {error}
                        </div>
                    )}
                    
                    {children}

                    <div style={styles.actionWrapper}>
                        <Button data-testid="components-confirmModal-confirmModal-button-1"
                            variant="outline"
                            onClick={onClose}
                            disabled={isLoading}
                            style={styles.actionButton}
                        >
                            {cancelText}
                        </Button>
                        <Button data-testid="components-confirmModal-confirmModal-button-2"
                            variant="destructive"
                            onClick={onConfirm}
                            disabled={isLoading}
                            style={styles.actionButton}
                        >
                            {isLoading && <LoadingSpinner size="sm" className="mr-2" />}
                            {confirmText}
                        </Button>
                    </div>
                </div>
            </ModalContent>
        </Modal>
    );
};

export default ConfirmModal;
