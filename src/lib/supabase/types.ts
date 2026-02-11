export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export interface Database {
    public: {
        Tables: {
            users: {
                Row: {
                    id: string;
                    email: string;
                    name: string | null;
                    avatar_url: string | null;
                    created_at: string;
                };
                Insert: {
                    id: string;
                    email: string;
                    name?: string | null;
                    avatar_url?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    email?: string;
                    name?: string | null;
                    avatar_url?: string | null;
                    created_at?: string;
                };
            };
            houses: {
                Row: {
                    id: string;
                    name: string;
                    invite_code: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    name: string;
                    invite_code?: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    name?: string;
                    invite_code?: string;
                    created_at?: string;
                };
            };
            house_members: {
                Row: {
                    id: string;
                    house_id: string;
                    user_id: string;
                    role: "owner" | "member";
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    house_id: string;
                    user_id: string;
                    role?: "owner" | "member";
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    house_id?: string;
                    user_id?: string;
                    role?: "owner" | "member";
                    created_at?: string;
                };
            };
            incomes: {
                Row: {
                    id: string;
                    user_id: string;
                    amount: number;
                    description: string | null;
                    month: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    amount: number;
                    description?: string | null;
                    month: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    amount?: number;
                    description?: string | null;
                    month?: string;
                    created_at?: string;
                };
            };
            fixed_expenses: {
                Row: {
                    id: string;
                    user_id: string;
                    amount: number;
                    category: string;
                    description: string | null;
                    is_shared: boolean;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    amount: number;
                    category: string;
                    description?: string | null;
                    is_shared?: boolean;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    amount?: number;
                    category?: string;
                    description?: string | null;
                    is_shared?: boolean;
                    created_at?: string;
                };
            };
            shared_expenses: {
                Row: {
                    id: string;
                    house_id: string;
                    paid_by: string;
                    total_amount: number;
                    category: string;
                    description: string | null;
                    receipt_url: string | null;
                    date: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    house_id: string;
                    paid_by: string;
                    total_amount: number;
                    category: string;
                    description?: string | null;
                    receipt_url?: string | null;
                    date: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    house_id?: string;
                    paid_by?: string;
                    total_amount?: number;
                    category?: string;
                    description?: string | null;
                    receipt_url?: string | null;
                    date?: string;
                    created_at?: string;
                };
            };
            expense_splits: {
                Row: {
                    id: string;
                    expense_id: string;
                    user_id: string;
                    amount: number;
                    is_paid: boolean;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    expense_id: string;
                    user_id: string;
                    amount: number;
                    is_paid?: boolean;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    expense_id?: string;
                    user_id?: string;
                    amount?: number;
                    is_paid?: boolean;
                    created_at?: string;
                };
            };
            receipt_items: {
                Row: {
                    id: string;
                    expense_id: string;
                    name: string;
                    quantity: number;
                    unit_price: number;
                    total: number;
                    category: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    expense_id: string;
                    name: string;
                    quantity?: number;
                    unit_price: number;
                    total: number;
                    category?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    expense_id?: string;
                    name?: string;
                    quantity?: number;
                    unit_price?: number;
                    total?: number;
                    category?: string | null;
                    created_at?: string;
                };
            };
        };
        Views: Record<string, never>;
        Functions: Record<string, never>;
        Enums: Record<string, never>;
    };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
    Database["public"]["Tables"][T]["Row"];
export type InsertTables<T extends keyof Database["public"]["Tables"]> =
    Database["public"]["Tables"][T]["Insert"];
export type UpdateTables<T extends keyof Database["public"]["Tables"]> =
    Database["public"]["Tables"][T]["Update"];
