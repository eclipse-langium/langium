import { AstNode } from "../generator/ast-node";

export type Cardinality = "*" | "+" | "?";
export type AssignType = "+=" | "?=" | "=";

export type Grammar = {
    kind: "grammar",
    name?: string;
    rules?: (Rule | Terminal)[];
}

export type Rule = {
    kind: "rule",
    name?: string;
    returnType?: string;
    alternatives?: Alternative[];
}

export type Alternative = {
    kind: "alternative",
    group?: Group;
}

export type Group = {
    kind: "group",
    items?: (Keyword | RuleCall | Assignment | Action | ParenthesizedGroup)[];
}

export type RuleCall = {
    kind: "rule-call",
    name?: string;
    rule?: Rule | Terminal;
}

export type Terminal = {
    kind: "terminal",
    name?: string;
    returnType?: string;
    regex?: string;
}

export type Action = {
    kind: "action",
    name?: string;
    variable?: string;
    type?: AssignType;
}

export type Keyword = {
    kind: "keyword",
    value?: string;
}

export type Assignment = {
    kind: "assignment",
    name?: string;
    type?: AssignType;
    value?: Keyword | ParenthesizedAssignableElement | RuleCall | CrossReference;
    cardinality?: Cardinality;
}

export type CrossReference = {
    kind: "cross-reference",
    target?: RuleCall;
    type?: RuleCall;
}

export type ParenthesizedAssignableElement = {
    kind: "parenthesized-assignable-element",
    items: (Keyword | RuleCall | ParenthesizedAssignableElement | CrossReference)[];
}

export type ParenthesizedGroup = {
    kind: "parenthesized-group",
    alternatives?: Alternative[];
    cardinality?: Cardinality;
}