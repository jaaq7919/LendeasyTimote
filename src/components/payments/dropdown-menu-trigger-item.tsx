'use client';

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import React from "react";

// This component is a workaround to allow a dropdown menu item to trigger a dialog
// without the event propagation issues that can occur.
export const DropdownMenuTriggerItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuItem>
>(({ children, ...props }, ref) => {
  return (
    <DropdownMenuItem
      ref={ref}
      {...props}
      onSelect={(e) => e.preventDefault()}
    >
      {children}
    </DropdownMenuItem>
  );
});

DropdownMenuTriggerItem.displayName = 'DropdownMenuTriggerItem';
