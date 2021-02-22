export type Cardinality = "*" | "+" | "?";
export type AssignType = "+=" | "?=" | "=";

export interface Grammar {
    name?: string;
    rules?: Rule[];
}

export interface Rule {
    name?: string;
    returnType?: string;
    alternatives?: Group[];
}

export interface Group {
    items?: (Keyword | Assignment | Action | ParenthesizedGroup)[];
}

export interface Action {
    name?: string;
    variable?: string;
    type?: AssignType;
}

export interface Keyword {
    value?: string;
}

export interface Assignment {
    name?: string;
    type?: AssignType;
    value?: Keyword | Rule | CrossReference;
}

export interface CrossReference {
    target?: Rule;
    type?: Rule;
}

export interface ParenthesizedGroup {
    alternatives?: Group[];
    cardinality?: Cardinality;
}