'use client';
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { AddBorrowerForm } from "@/components/borrowers/add-borrower-form"
import type { Borrower } from "@/lib/types";

interface EditBorrowerMenuItemProps {
    borrower: Borrower;
}

export function EditBorrowerMenuItem({ borrower }: EditBorrowerMenuItemProps) {
    return (
        <AddBorrowerForm borrower={borrower}>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                Editar cliente
            </DropdownMenuItem>
        </AddBorrowerForm>
    )
}
