import React from "react";

export interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    isLoading?: boolean;
    /** Blocks the confirm button while a caller-supplied precondition is unmet
     * (e.g. a typed confirmation phrase that doesn't match yet). */
    confirmDisabled?: boolean;
    error?: string | null;
    icon?: React.ReactNode;
    children?: React.ReactNode;
}
