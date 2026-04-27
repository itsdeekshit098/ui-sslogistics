"use client";

import React from "react";
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { LoadingSpinner } from "@/components/loadingSpinner";
import type { ConfirmModalProps } from "./confirmModal.types";
import {
    CM_CONTAINER,
    CM_ICON_WRAPPER,
    CM_TEXT_CONTAINER,
    CM_TITLE,
    CM_DESC,
    CM_ACTION_WRAPPER
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
                <div className={CM_CONTAINER}>
                    <div className={CM_ICON_WRAPPER}>
                        {icon ? icon : <Trash2 />}
                    </div>
                    <div className={CM_TEXT_CONTAINER}>
                        <h3 className={CM_TITLE}>{title}</h3>
                        <p className={CM_DESC}>{description}</p>
                    </div>
                    
                    {children}

                    <div className={CM_ACTION_WRAPPER}>
                        <Button data-testid="components-confirmModal-confirmModal-button-1"
                            variant="outline"
                            onClick={onClose}
                            disabled={isLoading}
                        >
                            {cancelText}
                        </Button>
                        <Button data-testid="components-confirmModal-confirmModal-button-2"
                            variant="destructive"
                            onClick={onConfirm}
                            disabled={isLoading}
                        >
                            {isLoading && <LoadingSpinner size="sm" className="mr-2" />}
                            {confirmText}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ConfirmModal;
