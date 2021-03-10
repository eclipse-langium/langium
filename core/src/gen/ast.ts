import { AstNode } from "../generator/ast-node"

export type Grammar = AstNode & {
    kind: "Grammar",
    definesHiddenTokens?: boolean,
    HiddenTokens: AbstractRule[],
    MetamodelDeclarations: AbstractMetamodelDeclaration[],
    Name: string,
    rules: AbstractRule[],
    UsedGrammars: Grammar[]
}

export type GrammarID = { kind: "GrammarID" }

export type AbstractRule = ParserRule | TerminalRule | EnumRule

export type AbstractMetamodelDeclaration = GeneratedMetamodel | ReferencedMetamodel

export type GeneratedMetamodel = AstNode & {
    kind: "GeneratedMetamodel",
    Alias?: string,
    EPackage: string,
    Name: string
}

export type ReferencedMetamodel = AstNode & {
    kind: "ReferencedMetamodel",
    Alias?: string,
    EPackage: string
}

export type Annotation = AstNode & {
    kind: "Annotation",
    Name: string
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
    wildcard: boolean
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
    Assignment: Assignment,
    Cardinality?: string,
    Terminal: AbstractTerminal
}

export type Action = AstNode & {
    kind: "Action",
    Feature?: string,
    Operator?: string,
    Type: ParserRule
}

export type AbstractTerminal = Keyword | RuleCall | ParenthesizedElement | PredicatedKeyword | PredicatedRuleCall | PredicatedGroup

export type Keyword = AstNode & {
    kind: "Keyword",
    Value: string
}

export type RuleCall = AstNode & {
    kind: "RuleCall",
    Arguments: NamedArgument[],
    Rule: AbstractRule
}

export type NamedArgument = AstNode & {
    kind: "NamedArgument",
    CalledByName?: boolean,
    Parameter?: Parameter,
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
    FirstSetPredicated: boolean,
    Predicated: boolean,
    Value: string
}

export type PredicatedRuleCall = AstNode & {
    kind: "PredicatedRuleCall",
    Arguments: NamedArgument[],
    FirstSetPredicated: boolean,
    Predicated: boolean,
    Rule: AbstractRule
}

export type Assignment = AstNode & {
    kind: "Assignment",
    Feature: string,
    FirstSetPredicated?: boolean,
    Operator: string,
    Predicated?: boolean,
    Terminal: AssignableTerminal
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
    Terminal?: CrossReferenceableTerminal,
    Type: ParserRule
}

export type CrossReferenceableTerminal = Keyword | RuleCall

export type ParenthesizedElement = AstNode & {
    kind: "ParenthesizedElement",
    Alternatives: Alternatives
}

export type PredicatedGroup = AstNode & {
    kind: "PredicatedGroup",
    Elements: Alternatives[],
    FirstSetPredicated: boolean,
    Predicated: boolean
}

export type TerminalRule = AstNode & {
    kind: "TerminalRule",
    Fragment: boolean,
    Name: string,
    Regex: string,
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
    Cardinality?: string
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
    Alternatives: EnumLiterals,
    Name: string,
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

