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
    error?: string | null;
    icon?: React.ReactNode;
    children?: React.ReactNode;
}
