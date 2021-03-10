import { AstNode } from "../generator/ast-node"

export type Grammar = AstNode & {
    kind: "Grammar",
    Name: string,
    MetamodelDeclarations: AbstractMetamodelDeclaration[],
    UsedGrammars: Grammar[],
    definesHiddenTokens?: boolean,
    HiddenTokens: AbstractRule[],
    rules: AbstractRule[]
}

export type GrammarID = { kind: "GrammarID" }

export type AbstractRule = ParserRule | TerminalRule | EnumRule

export type AbstractMetamodelDeclaration = GeneratedMetamodel | ReferencedMetamodel

export type GeneratedMetamodel = AstNode & {
    kind: "GeneratedMetamodel",
    Name: string,
    EPackage: string,
    Alias?: string
}

export type ReferencedMetamodel = AstNode & {
    kind: "ReferencedMetamodel",
    EPackage: string,
    Alias?: string
}

export type Annotation = AstNode & {
    kind: "Annotation",
    Name: string
}

export type ParserRule = AstNode & {
    kind: "ParserRule",
    Alternatives: Alternatives,
    fragment: boolean,
    Name: string,
    Parameters: Parameter[],
    wildcard: boolean,
    Type?: string,
    DefinesHiddenTokens?: boolean,
    HiddenTokens: AbstractRule[]
}

export type RuleNameAndParams = AstNode & {
    kind: "RuleNameAndParams",
    Name: string,
    Parameters: Parameter[]
}

export type Parameter = AstNode & {
    kind: "Parameter",
    Name: string
}

export type Alternatives = AstNode & {
    kind: "Alternatives",
    Elements: UnorderedGroup[]
}

export type UnorderedGroup = AstNode & {
    kind: "UnorderedGroup",
    Elements: Group[]
}

export type Group = AstNode & {
    kind: "Group",
    Elements: AbstractToken[]
}

export type AbstractToken = AbstractTokenWithCardinality | Action

export type AbstractTokenWithCardinality = AstNode & {
    kind: "AbstractTokenWithCardinality",
    Cardinality: string,
    Assignment: Assignment,
    Terminal: AbstractTerminal
}

export type Action = AstNode & {
    kind: "Action",
    Type: ParserRule,
    Feature?: string,
    Operator?: string
}

export type AbstractTerminal = Keyword | RuleCall | ParenthesizedElement | PredicatedKeyword | PredicatedRuleCall | PredicatedGroup

export type Keyword = AstNode & {
    kind: "Keyword",
    Value: string
}

export type RuleCall = AstNode & {
    kind: "RuleCall",
    Rule: AbstractRule,
    Arguments: NamedArgument[]
}

export type NamedArgument = AstNode & {
    kind: "NamedArgument",
    Parameter?: Parameter,
    CalledByName?: boolean,
    Value: Disjunction
}

export type LiteralCondition = AstNode & {
    kind: "LiteralCondition",
    True: boolean
}

export type Disjunction = AstNode & {
    kind: "Disjunction",
    Left: Conjunction,
    Right?: Conjunction
}

export type Conjunction = AstNode & {
    kind: "Conjunction",
    Left: Negation,
    Right?: Negation
}

export type Negation = Atom | AstNode & {
    kind: "Negation",
    Value: Negation
}

export type Atom = ParameterReference | ParenthesizedCondition | LiteralCondition

export type ParenthesizedCondition = { kind: "ParenthesizedCondition" }

export type ParameterReference = AstNode & {
    kind: "ParameterReference",
    Parameter: Parameter
}

export type TerminalRuleCall = AstNode & {
    kind: "TerminalRuleCall",
    Rule: AbstractRule
}

export type RuleID = { kind: "RuleID" }

export type PredicatedKeyword = AstNode & {
    kind: "PredicatedKeyword",
    Value: string,
    Predicated: boolean,
    FirstSetPredicated: boolean
}

export type PredicatedRuleCall = AstNode & {
    kind: "PredicatedRuleCall",
    Rule: AbstractRule,
    Predicated: boolean,
    FirstSetPredicated: boolean,
    Arguments: NamedArgument[]
}

export type Assignment = AstNode & {
    kind: "Assignment",
    Feature: string,
    Operator: string,
    Terminal: AssignableTerminal,
    Predicated?: boolean,
    FirstSetPredicated?: boolean
}

export type AssignableTerminal = Keyword | RuleCall | ParenthesizedAssignableElement | CrossReference

export type ParenthesizedAssignableElement = AstNode & {
    kind: "ParenthesizedAssignableElement",
    Alternatives: AssignableAlternatives
}

export type AssignableAlternatives = AstNode & {
    kind: "AssignableAlternatives",
    Elements: AssignableTerminal[]
}

export type CrossReference = AstNode & {
    kind: "CrossReference",
    Type: ParserRule,
    Terminal?: CrossReferenceableTerminal
}

export type CrossReferenceableTerminal = Keyword | RuleCall

export type ParenthesizedElement = AstNode & {
    kind: "ParenthesizedElement",
    Alternatives: Alternatives
}

export type PredicatedGroup = AstNode & {
    kind: "PredicatedGroup",
    Elements: Alternatives[],
    Predicated: boolean,
    FirstSetPredicated: boolean
}

export type TerminalRule = AstNode & {
    kind: "TerminalRule",
    Regex: string,
    Fragment: boolean,
    Name: string,
    Type?: string
}

export type TerminalAlternatives = AstNode & {
    kind: "TerminalAlternatives",
    Elements: TerminalGroup[]
}

export type TerminalGroup = AstNode & {
    kind: "TerminalGroup",
    Elements: TerminalToken[]
}

export type TerminalToken = AstNode & {
    kind: "TerminalToken",
    Cardinality: string
}

export type TerminalTokenElement = CharacterRange | TerminalRuleCall | ParenthesizedTerminalElement | AbstractNegatedToken | Wildcard

export type ParenthesizedTerminalElement = { kind: "ParenthesizedTerminalElement" }

export type AbstractNegatedToken = NegatedToken | UntilToken

export type NegatedToken = AstNode & {
    kind: "NegatedToken",
    Terminal: TerminalTokenElement
}

export type UntilToken = AstNode & {
    kind: "UntilToken",
    Terminal: TerminalTokenElement
}

export type Wildcard = { kind: "Wildcard" }

export type CharacterRange = AstNode & {
    kind: "CharacterRange",
    Left: Keyword,
    Right?: Keyword
}

export type EnumRule = AstNode & {
    kind: "EnumRule",
    Name: string,
    Alternatives: EnumLiterals,
    Type?: string
}

export type EnumLiterals = AstNode & {
    kind: "EnumLiterals",
    Elements: EnumLiteralDeclaration[]
}

export type EnumLiteralDeclaration = AstNode & {
    kind: "EnumLiteralDeclaration",
    EnumLiteral: EnumLiterals,
    Literal?: Keyword
}

