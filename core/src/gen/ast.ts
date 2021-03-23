/* eslint-disable */
// @ts-nocheck
import { AstNode } from "../generator/ast-node"

export type Any = Grammar | AbstractRule | AbstractMetamodelDeclaration | GeneratedMetamodel | ReferencedMetamodel | Annotation | ParserRule | RuleNameAndParams | Parameter | Alternatives | UnorderedGroup | Group | AbstractToken | AbstractTokenWithCardinality | Action | AbstractTerminal | Keyword | RuleCall | NamedArgument | LiteralCondition | Disjunction | Conjunction | Negation | Atom | ParenthesizedCondition | ParameterReference | TerminalRuleCall | PredicatedKeyword | PredicatedRuleCall | Assignment | AssignableTerminal | ParenthesizedAssignableElement | AssignableAlternatives | CrossReference | CrossReferenceableTerminal | ParenthesizedElement | PredicatedGroup | TerminalRule | TerminalAlternatives | TerminalGroup | TerminalToken | TerminalTokenElement | ParenthesizedTerminalElement | AbstractNegatedToken | NegatedToken | UntilToken | Wildcard | CharacterRange | EnumRule | EnumLiterals | EnumLiteralDeclaration;

export type Grammar = AstNode & {
    kind: "Grammar",
    definesHiddenTokens?: boolean,
    HiddenTokens: AbstractRule[],
    MetamodelDeclarations: AbstractMetamodelDeclaration[],
    Name: string,
    rules: AbstractRule[],
    UsedGrammars: Grammar[],
    container: Any
}

export type AbstractRule = ParserRule | TerminalRule | EnumRule

export type AbstractMetamodelDeclaration = GeneratedMetamodel | ReferencedMetamodel

export type GeneratedMetamodel = AstNode & {
    kind: "GeneratedMetamodel",
    Alias?: string,
    EPackage: string,
    Name: string,
    container: Any
}

export type ReferencedMetamodel = AstNode & {
    kind: "ReferencedMetamodel",
    Alias?: string,
    EPackage: string,
    container: Any
}

export type Annotation = AstNode & {
    kind: "Annotation",
    Name: string,
    container: Any
}

export type ParserRule = AstNode & {
    kind: "ParserRule",
    Alternatives: Alternatives,
    DefinesHiddenTokens?: boolean,
    fragment: boolean,
    HiddenTokens: AbstractRule[],
    Name: string,
    Parameters: Parameter[],
    Type?: string,
    wildcard: boolean,
    container: Any
}

export type RuleNameAndParams = AstNode & {
    kind: "RuleNameAndParams",
    Name: string,
    Parameters: Parameter[],
    container: Any
}

export type Parameter = AstNode & {
    kind: "Parameter",
    Name: string,
    container: Any
}

export type Alternatives = UnorderedGroup | AstNode & {
    kind: "Alternatives",
    Elements: UnorderedGroup[],
    container: Any
}

export type UnorderedGroup = Group | AstNode & {
    kind: "UnorderedGroup",
    Elements: Group[],
    container: Any
}

export type Group = AstNode & {
    kind: "Group",
    Elements: AbstractToken[],
    container: Any
}

export type AbstractToken = AbstractTokenWithCardinality | Action

export type AbstractTokenWithCardinality = (Assignment | AbstractTerminal) & {
    Cardinality?: string
}

export type Action = AstNode & {
    kind: "Action",
    Feature?: string,
    Operator?: string,
    Type: ParserRule,
    container: Any
}

export type AbstractTerminal = Keyword | RuleCall | ParenthesizedElement | PredicatedKeyword | PredicatedRuleCall | PredicatedGroup

export type Keyword = AstNode & {
    kind: "Keyword",
    Value: string,
    container: Any
}

export type RuleCall = AstNode & {
    kind: "RuleCall",
    Arguments: NamedArgument[],
    Rule: AbstractRule,
    container: Any
}

export type NamedArgument = AstNode & {
    kind: "NamedArgument",
    CalledByName?: boolean,
    Parameter?: Parameter,
    Value: Disjunction,
    container: Any
}

export type LiteralCondition = AstNode & {
    kind: "LiteralCondition",
    True: boolean,
    container: Any
}

export type Disjunction = Conjunction | AstNode & {
    kind: "Disjunction",
    Left?: Conjunction,
    Right?: Conjunction,
    container: Any
}

export type Conjunction = Negation | AstNode & {
    kind: "Conjunction",
    Left?: Negation,
    Right?: Negation,
    container: Any
}

export type Negation = (Atom) & {
    Value: Negation
}

export type Atom = ParameterReference | ParenthesizedCondition | LiteralCondition

export type ParenthesizedCondition = Disjunction

export type ParameterReference = AstNode & {
    kind: "ParameterReference",
    Parameter: Parameter,
    container: Any
}

export type TerminalRuleCall = AstNode & {
    kind: "TerminalRuleCall",
    Rule: AbstractRule,
    container: Any
}

export type PredicatedKeyword = AstNode & {
    kind: "PredicatedKeyword",
    FirstSetPredicated: boolean,
    Predicated: boolean,
    Value: string,
    container: Any
}

export type PredicatedRuleCall = AstNode & {
    kind: "PredicatedRuleCall",
    Arguments: NamedArgument[],
    FirstSetPredicated: boolean,
    Predicated: boolean,
    Rule: AbstractRule,
    container: Any
}

export type Assignment = AstNode & {
    kind: "Assignment",
    Feature: string,
    FirstSetPredicated?: boolean,
    Operator: string,
    Predicated?: boolean,
    Terminal: AssignableTerminal,
    container: Any
}

export type AssignableTerminal = Keyword | RuleCall | ParenthesizedAssignableElement | CrossReference

export type ParenthesizedAssignableElement = AssignableAlternatives

export type AssignableAlternatives = AstNode & {
    kind: "AssignableAlternatives",
    Elements: AssignableTerminal[],
    container: Any
}

export type CrossReference = AstNode & {
    kind: "CrossReference",
    Terminal?: CrossReferenceableTerminal,
    Type: ParserRule,
    container: Any
}

export type CrossReferenceableTerminal = Keyword | RuleCall

export type ParenthesizedElement = Alternatives

export type PredicatedGroup = AstNode & {
    kind: "PredicatedGroup",
    Elements: Alternatives[],
    FirstSetPredicated: boolean,
    Predicated: boolean,
    container: Any
}

export type TerminalRule = AstNode & {
    kind: "TerminalRule",
    Fragment: boolean,
    Name: string,
    Regex: string,
    Type?: string,
    container: Any
}

export type TerminalAlternatives = AstNode & {
    kind: "TerminalAlternatives",
    Elements: TerminalGroup[],
    container: Any
}

export type TerminalGroup = AstNode & {
    kind: "TerminalGroup",
    Elements: TerminalToken[],
    container: Any
}

export type TerminalToken = (TerminalTokenElement) & {
    Cardinality?: string
}

export type TerminalTokenElement = CharacterRange | TerminalRuleCall | ParenthesizedTerminalElement | AbstractNegatedToken | Wildcard

export type ParenthesizedTerminalElement = TerminalAlternatives

export type AbstractNegatedToken = NegatedToken | UntilToken

export type NegatedToken = AstNode & {
    kind: "NegatedToken",
    Terminal: TerminalTokenElement,
    container: Any
}

export type UntilToken = AstNode & {
    kind: "UntilToken",
    Terminal: TerminalTokenElement,
    container: Any
}

export type Wildcard = AstNode & { kind: "Wildcard" }

export type CharacterRange = AstNode & {
    kind: "CharacterRange",
    Left: Keyword,
    Right?: Keyword,
    container: Any
}

export type EnumRule = AstNode & {
    kind: "EnumRule",
    Alternatives: EnumLiterals,
    Name: string,
    Type?: string,
    container: Any
}

export type EnumLiterals = EnumLiteralDeclaration | AstNode & {
    kind: "EnumLiterals",
    Elements: EnumLiteralDeclaration[],
    container: Any
}

export type EnumLiteralDeclaration = AstNode & {
    kind: "EnumLiteralDeclaration",
    EnumLiteral: EnumLiterals,
    Literal?: Keyword,
    container: Any
}

