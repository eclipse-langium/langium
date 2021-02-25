/* eslint-disable */
export type Cardinality = "*" | "+" | "?";
export type AssignType = "+=" | "?=" | "=";

export interface Grammar {
    name?: string;
    rules?: Rule[];
}

export interface Rule {
    name?: string;
    returnType?: string;
    alternatives?: Alternative[];
}

export interface Alternative {
    groups?: Group[];
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
    value?: Keyword[] | Rule | CrossReference | string;
    cardinality?: Cardinality;
}

export interface CrossReference {
    target?: Rule | string;
    type?: Rule | string;
}

export interface ParenthesizedGroup {
    alternatives?: Alternative[];
    cardinality?: Cardinality;
}