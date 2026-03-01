export interface TailorRule {
    id: string;
    user_id: string | null;
    application_id: string | null;
    rule_text: string;
    is_enabled: boolean;
    created_at: string;
    updated_at: string;
}

export interface TailorRuleCreate {
    application_id?: string | null;
    rule_text: string;
    is_enabled?: boolean;
}

export interface TailorRuleUpdate {
    rule_text?: string;
    is_enabled?: boolean;
}
