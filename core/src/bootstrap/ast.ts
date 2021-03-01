import { AstNode } from "../generator/ast-node";

export type Cardinality = "*" | "+" | "?";
export type AssignType = "+=" | "?=" | "=";

export type Grammar = AstNode & {
    kind: "grammar",
    name?: string;
    rules?: (Rule | Terminal)[];
}

export type Rule = AstNode & {
    kind: "rule",
    name?: string;
    returnType?: string;
    alternatives?: Alternative[];
}

export type Alternative = AstNode & {
    kind: "alternative",
    group?: Group;
}

export type Group = AstNode & {
    kind: "group",
    items?: (Keyword | RuleCall | Assignment | Action | ParenthesizedGroup)[];
}

export type RuleCall = AstNode & {
    kind: "rule-call",
    name?: string;
    rule?: Rule | Terminal;
}

export type Terminal = AstNode & {
    kind: "terminal",
    name?: string;
    returnType?: string;
    regex?: string;
}

export type Action = AstNode & {
    kind: "action",
    name?: string;
    variable?: string;
    type?: AssignType;
}

export type Keyword = AstNode & {
    kind: "keyword",
    value?: string;
}

export type Assignment = AstNode & {
    kind: "assignment",
    name?: string;
    type?: AssignType;
    value?: Keyword | ParenthesizedAssignableElement | RuleCall | CrossReference;
    cardinality?: Cardinality;
}

export type CrossReference = AstNode & {
    kind: "cross-reference",
    target?: RuleCall;
    type?: RuleCall;
}

export type ParenthesizedAssignableElement = AstNode & {
    kind: "parenthesized-assignable-element",
    items: (Keyword | RuleCall | ParenthesizedAssignableElement | CrossReference)[];
}

export type ParenthesizedGroup = AstNode & {
    kind: "parenthesized-group",
    alternatives?: Alternative[];
    cardinality?: Cardinality;
}