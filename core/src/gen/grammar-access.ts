import { GrammarAccess } from '../index'
import { Action, Assignment, CrossReference, Keyword, RuleCall } from './ast'

export type GrammarRuleAccess = {
    GrammarKeyword: Keyword;
    name: Assignment;
    nameIDRuleCall: RuleCall;
    WithKeyword: Keyword;
    usedGrammars: Assignment;
    usedGrammarsGrammarCrossReference: CrossReference;
    CommaKeyword: Keyword;
    definesHiddenTokens: Assignment;
    HiddenKeyword: Keyword;
    ParenthesisOpenKeyword: Keyword;
    hiddenTokens: Assignment;
    hiddenTokensAbstractRuleCrossReference: CrossReference;
    ParenthesisCloseKeyword: Keyword;
    metamodelDeclarations: Assignment;
    metamodelDeclarationsAbstractMetamodelDeclarationRuleCall: RuleCall;
    rules: Assignment;
    rulesAbstractRuleRuleCall: RuleCall;
}

export type AbstractRuleRuleAccess = {
    ParserRuleRuleCall: RuleCall;
    TerminalRuleRuleCall: RuleCall;
    EnumRuleRuleCall: RuleCall;
}

export type AbstractMetamodelDeclarationRuleAccess = {
    GeneratedMetamodelRuleCall: RuleCall;
    ReferencedMetamodelRuleCall: RuleCall;
}

export type GeneratedMetamodelRuleAccess = {
    GenerateKeyword: Keyword;
    name: Assignment;
    nameIDRuleCall: RuleCall;
    ePackage: Assignment;
    ePackagestringCrossReference: CrossReference;
    AsKeyword: Keyword;
    alias: Assignment;
    aliasIDRuleCall: RuleCall;
}

export type ReferencedMetamodelRuleAccess = {
    ImportKeyword: Keyword;
    ePackage: Assignment;
    ePackagestringCrossReference: CrossReference;
    AsKeyword: Keyword;
    alias: Assignment;
    aliasIDRuleCall: RuleCall;
}

export type AnnotationRuleAccess = {
    AtKeyword: Keyword;
    name: Assignment;
    nameIDRuleCall: RuleCall;
}

export type ParserRuleRuleAccess = {
    fragment: Assignment;
    FragmentKeyword: Keyword;
    RuleNameAndParamsRuleCall: RuleCall;
    wildcard: Assignment;
    AsteriskKeyword: Keyword;
    ReturnsKeyword: Keyword;
    type: Assignment;
    typeIDRuleCall: RuleCall;
    definesHiddenTokens: Assignment;
    HiddenKeyword: Keyword;
    ParenthesisOpenKeyword: Keyword;
    hiddenTokens: Assignment;
    hiddenTokensAbstractRuleCrossReference: CrossReference;
    CommaKeyword: Keyword;
    ParenthesisCloseKeyword: Keyword;
    ColonKeyword: Keyword;
    alternatives: Assignment;
    alternativesAlternativesRuleCall: RuleCall;
    SemicolonKeyword: Keyword;
}

export type RuleNameAndParamsRuleAccess = {
    name: Assignment;
    nameIDRuleCall: RuleCall;
    LessThanKeyword: Keyword;
    parameters: Assignment;
    parametersParameterRuleCall: RuleCall;
    CommaKeyword: Keyword;
    MoreThanKeyword: Keyword;
}

export type ParameterRuleAccess = {
    name: Assignment;
    nameIDRuleCall: RuleCall;
}

export type AlternativesRuleAccess = {
    UnorderedGroupRuleCall: RuleCall;
    AlternativeselementsAction: Action;
    PipeKeyword: Keyword;
    elements: Assignment;
    elementsUnorderedGroupRuleCall: RuleCall;
}

export type UnorderedGroupRuleAccess = {
    GroupRuleCall: RuleCall;
    UnorderedGroupelementsAction: Action;
    AmpersandKeyword: Keyword;
    elements: Assignment;
    elementsGroupRuleCall: RuleCall;
}

export type GroupRuleAccess = {
    AbstractTokenRuleCall: RuleCall;
    GroupelementsAction: Action;
    elements: Assignment;
    elementsAbstractTokenRuleCall: RuleCall;
}

export type AbstractTokenRuleAccess = {
    AbstractTokenWithCardinalityRuleCall: RuleCall;
    ActionRuleCall: RuleCall;
}

export type AbstractTokenWithCardinalityRuleAccess = {
    AssignmentRuleCall: RuleCall;
    AbstractTerminalRuleCall: RuleCall;
    cardinality: Assignment;
    QuestionMarkKeyword: Keyword;
    AsteriskKeyword: Keyword;
    PlusKeyword: Keyword;
}

export type ActionRuleAccess = {
    ActionAction: Action;
    CurlyOpenKeyword: Keyword;
    Type: Assignment;
    TypeIDRuleCall: RuleCall;
    DotKeyword: Keyword;
    feature: Assignment;
    featureIDRuleCall: RuleCall;
    operator: Assignment;
    EqualsKeyword: Keyword;
    PlusEqualsKeyword: Keyword;
    CurrentKeyword: Keyword;
    CurlyCloseKeyword: Keyword;
}

export type AbstractTerminalRuleAccess = {
    KeywordRuleCall: RuleCall;
    RuleCallRuleCall: RuleCall;
    ParenthesizedElementRuleCall: RuleCall;
    PredicatedKeywordRuleCall: RuleCall;
    PredicatedRuleCallRuleCall: RuleCall;
    PredicatedGroupRuleCall: RuleCall;
}

export type KeywordRuleAccess = {
    value: Assignment;
    valuestringRuleCall: RuleCall;
}

export type RuleCallRuleAccess = {
    rule: Assignment;
    ruleAbstractRuleCrossReference: CrossReference;
    LessThanKeyword: Keyword;
    arguments: Assignment;
    argumentsNamedArgumentRuleCall: RuleCall;
    CommaKeyword: Keyword;
    MoreThanKeyword: Keyword;
}

export type NamedArgumentRuleAccess = {
    parameter: Assignment;
    parameterParameterCrossReference: CrossReference;
    calledByName: Assignment;
    EqualsKeyword: Keyword;
    value: Assignment;
    valueDisjunctionRuleCall: RuleCall;
}

export type LiteralConditionRuleAccess = {
    true: Assignment;
    TrueKeyword: Keyword;
    FalseKeyword: Keyword;
}

export type DisjunctionRuleAccess = {
    ConjunctionRuleCall: RuleCall;
    DisjunctionleftAction: Action;
    PipeKeyword: Keyword;
    right: Assignment;
    rightConjunctionRuleCall: RuleCall;
}

export type ConjunctionRuleAccess = {
    NegationRuleCall: RuleCall;
    ConjunctionleftAction: Action;
    AmpersandKeyword: Keyword;
    right: Assignment;
    rightNegationRuleCall: RuleCall;
}

export type NegationRuleAccess = {
    AtomRuleCall: RuleCall;
    NegationAction: Action;
    ExclamationMarkKeyword: Keyword;
    value: Assignment;
    valueNegationRuleCall: RuleCall;
}

export type AtomRuleAccess = {
    ParameterReferenceRuleCall: RuleCall;
    ParenthesizedConditionRuleCall: RuleCall;
    LiteralConditionRuleCall: RuleCall;
}

export type ParenthesizedConditionRuleAccess = {
    ParenthesisOpenKeyword: Keyword;
    DisjunctionRuleCall: RuleCall;
    ParenthesisCloseKeyword: Keyword;
}

export type ParameterReferenceRuleAccess = {
    parameter: Assignment;
    parameterParameterCrossReference: CrossReference;
}

export type TerminalRuleCallRuleAccess = {
    rule: Assignment;
    ruleAbstractRuleCrossReference: CrossReference;
}

export type PredicatedKeywordRuleAccess = {
    predicated: Assignment;
    EqualsMoreThanKeyword: Keyword;
    firstSetPredicated: Assignment;
    DashMoreThanKeyword: Keyword;
    value: Assignment;
    valuestringRuleCall: RuleCall;
}

export type PredicatedRuleCallRuleAccess = {
    predicated: Assignment;
    EqualsMoreThanKeyword: Keyword;
    firstSetPredicated: Assignment;
    DashMoreThanKeyword: Keyword;
    rule: Assignment;
    ruleAbstractRuleCrossReference: CrossReference;
    LessThanKeyword: Keyword;
    arguments: Assignment;
    argumentsNamedArgumentRuleCall: RuleCall;
    CommaKeyword: Keyword;
    MoreThanKeyword: Keyword;
}

export type AssignmentRuleAccess = {
    AssignmentAction: Action;
    predicated: Assignment;
    EqualsMoreThanKeyword: Keyword;
    firstSetPredicated: Assignment;
    DashMoreThanKeyword: Keyword;
    feature: Assignment;
    featureIDRuleCall: RuleCall;
    operator: Assignment;
    PlusEqualsKeyword: Keyword;
    EqualsKeyword: Keyword;
    QuestionMarkEqualsKeyword: Keyword;
    terminal: Assignment;
    terminalAssignableTerminalRuleCall: RuleCall;
}

export type AssignableTerminalRuleAccess = {
    KeywordRuleCall: RuleCall;
    RuleCallRuleCall: RuleCall;
    ParenthesizedAssignableElementRuleCall: RuleCall;
    CrossReferenceRuleCall: RuleCall;
}

export type ParenthesizedAssignableElementRuleAccess = {
    ParenthesisOpenKeyword: Keyword;
    AssignableAlternativesRuleCall: RuleCall;
    ParenthesisCloseKeyword: Keyword;
}

export type AssignableAlternativesRuleAccess = {
    AssignableTerminalRuleCall: RuleCall;
    AlternativeselementsAction: Action;
    PipeKeyword: Keyword;
    elements: Assignment;
    elementsAssignableTerminalRuleCall: RuleCall;
}

export type CrossReferenceRuleAccess = {
    CrossReferenceAction: Action;
    BracketOpenKeyword: Keyword;
    type: Assignment;
    typeParserRuleCrossReference: CrossReference;
    PipeKeyword: Keyword;
    terminal: Assignment;
    terminalCrossReferenceableTerminalRuleCall: RuleCall;
    BracketCloseKeyword: Keyword;
}

export type CrossReferenceableTerminalRuleAccess = {
    KeywordRuleCall: RuleCall;
    RuleCallRuleCall: RuleCall;
}

export type ParenthesizedElementRuleAccess = {
    ParenthesisOpenKeyword: Keyword;
    AlternativesRuleCall: RuleCall;
    ParenthesisCloseKeyword: Keyword;
}

export type PredicatedGroupRuleAccess = {
    predicated: Assignment;
    EqualsMoreThanKeyword: Keyword;
    firstSetPredicated: Assignment;
    DashMoreThanKeyword: Keyword;
    ParenthesisOpenKeyword: Keyword;
    elements: Assignment;
    elementsAlternativesRuleCall: RuleCall;
    ParenthesisCloseKeyword: Keyword;
}

export type TerminalRuleRuleAccess = {
    TerminalKeyword: Keyword;
    fragment: Assignment;
    FragmentKeyword: Keyword;
    name: Assignment;
    nameIDRuleCall: RuleCall;
    ReturnsKeyword: Keyword;
    type: Assignment;
    typeIDRuleCall: RuleCall;
    ColonKeyword: Keyword;
    regex: Assignment;
    regexRegexLiteralRuleCall: RuleCall;
    SemicolonKeyword: Keyword;
}

export type TerminalAlternativesRuleAccess = {
    TerminalGroupRuleCall: RuleCall;
    TerminalAlternativeselementsAction: Action;
    PipeKeyword: Keyword;
    elements: Assignment;
    elementsTerminalGroupRuleCall: RuleCall;
}

export type TerminalGroupRuleAccess = {
    elements: Assignment;
    elementsTerminalTokenRuleCall: RuleCall;
}

export type TerminalTokenRuleAccess = {
    TerminalTokenElementRuleCall: RuleCall;
    cardinality: Assignment;
    QuestionMarkKeyword: Keyword;
    AsteriskKeyword: Keyword;
    PlusKeyword: Keyword;
}

export type TerminalTokenElementRuleAccess = {
    CharacterRangeRuleCall: RuleCall;
    TerminalRuleCallRuleCall: RuleCall;
    ParenthesizedTerminalElementRuleCall: RuleCall;
    AbstractNegatedTokenRuleCall: RuleCall;
    WildcardRuleCall: RuleCall;
}

export type ParenthesizedTerminalElementRuleAccess = {
    ParenthesisOpenKeyword: Keyword;
    TerminalAlternativesRuleCall: RuleCall;
    ParenthesisCloseKeyword: Keyword;
}

export type AbstractNegatedTokenRuleAccess = {
    NegatedTokenRuleCall: RuleCall;
    UntilTokenRuleCall: RuleCall;
}

export type NegatedTokenRuleAccess = {
    ExclamationMarkKeyword: Keyword;
    terminal: Assignment;
    terminalTerminalTokenElementRuleCall: RuleCall;
}

export type UntilTokenRuleAccess = {
    DashMoreThanKeyword: Keyword;
    terminal: Assignment;
    terminalTerminalTokenElementRuleCall: RuleCall;
}

export type WildcardRuleAccess = {
    WildcardAction: Action;
    DotKeyword: Keyword;
}

export type CharacterRangeRuleAccess = {
    left: Assignment;
    leftKeywordRuleCall: RuleCall;
    DotDotKeyword: Keyword;
    right: Assignment;
    rightKeywordRuleCall: RuleCall;
}

export type EnumRuleRuleAccess = {
    EnumKeyword: Keyword;
    name: Assignment;
    nameIDRuleCall: RuleCall;
    ReturnsKeyword: Keyword;
    type: Assignment;
    typeIDRuleCall: RuleCall;
    ColonKeyword: Keyword;
    alternatives: Assignment;
    alternativesEnumLiteralsRuleCall: RuleCall;
    SemicolonKeyword: Keyword;
}

export type EnumLiteralsRuleAccess = {
    EnumLiteralDeclarationRuleCall: RuleCall;
    EnumLiteralselementsAction: Action;
    PipeKeyword: Keyword;
    elements: Assignment;
    elementsEnumLiteralDeclarationRuleCall: RuleCall;
}

export type EnumLiteralDeclarationRuleAccess = {
    enumLiteral: Assignment;
    enumLiteralEnumLiteralsCrossReference: CrossReference;
    EqualsKeyword: Keyword;
    literal: Assignment;
    literalKeywordRuleCall: RuleCall;
}

export class xtextGrammarAccess extends GrammarAccess {
    Grammar: GrammarRuleAccess = <GrammarRuleAccess><unknown>{
        GrammarKeyword: {
            kind: 'unknown'
        },
        name: {
            kind: Assignment.kind,
            feature: 'name',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        nameIDRuleCall: {
            kind: 'unknown'
        },
        WithKeyword: {
            kind: 'unknown'
        },
        usedGrammars: {
            kind: Assignment.kind,
            feature: 'usedGrammars',
            operator: '+=',
            terminal: {
                kind: CrossReference.kind
            }
        },
        usedGrammarsGrammarCrossReference: {
            kind: 'unknown'
        },
        CommaKeyword: {
            kind: 'unknown'
        },
        definesHiddenTokens: {
            kind: Assignment.kind,
            feature: 'definesHiddenTokens',
            operator: '?=',
            terminal: {
                kind: 'unknown'
            }
        },
        HiddenKeyword: {
            kind: 'unknown'
        },
        ParenthesisOpenKeyword: {
            kind: 'unknown'
        },
        hiddenTokens: {
            kind: Assignment.kind,
            feature: 'hiddenTokens',
            operator: '+=',
            terminal: {
                kind: CrossReference.kind
            }
        },
        hiddenTokensAbstractRuleCrossReference: {
            kind: 'unknown'
        },
        ParenthesisCloseKeyword: {
            kind: 'unknown'
        },
        metamodelDeclarations: {
            kind: Assignment.kind,
            feature: 'metamodelDeclarations',
            operator: '+=',
            terminal: {
                kind: 'unknown'
            }
        },
        metamodelDeclarationsAbstractMetamodelDeclarationRuleCall: {
            kind: 'unknown'
        },
        rules: {
            kind: Assignment.kind,
            feature: 'rules',
            operator: '+=',
            terminal: {
                kind: 'unknown'
            }
        },
        rulesAbstractRuleRuleCall: {
            kind: 'unknown'
        },
    }
    AbstractRule: AbstractRuleRuleAccess = <AbstractRuleRuleAccess><unknown>{
        ParserRuleRuleCall: {
            kind: 'unknown'
        },
        TerminalRuleRuleCall: {
            kind: 'unknown'
        },
        EnumRuleRuleCall: {
            kind: 'unknown'
        },
    }
    AbstractMetamodelDeclaration: AbstractMetamodelDeclarationRuleAccess = <AbstractMetamodelDeclarationRuleAccess><unknown>{
        GeneratedMetamodelRuleCall: {
            kind: 'unknown'
        },
        ReferencedMetamodelRuleCall: {
            kind: 'unknown'
        },
    }
    GeneratedMetamodel: GeneratedMetamodelRuleAccess = <GeneratedMetamodelRuleAccess><unknown>{
        GenerateKeyword: {
            kind: 'unknown'
        },
        name: {
            kind: Assignment.kind,
            feature: 'name',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        nameIDRuleCall: {
            kind: 'unknown'
        },
        ePackage: {
            kind: Assignment.kind,
            feature: 'ePackage',
            operator: '=',
            terminal: {
                kind: CrossReference.kind
            }
        },
        ePackagestringCrossReference: {
            kind: 'unknown'
        },
        AsKeyword: {
            kind: 'unknown'
        },
        alias: {
            kind: Assignment.kind,
            feature: 'alias',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        aliasIDRuleCall: {
            kind: 'unknown'
        },
    }
    ReferencedMetamodel: ReferencedMetamodelRuleAccess = <ReferencedMetamodelRuleAccess><unknown>{
        ImportKeyword: {
            kind: 'unknown'
        },
        ePackage: {
            kind: Assignment.kind,
            feature: 'ePackage',
            operator: '=',
            terminal: {
                kind: CrossReference.kind
            }
        },
        ePackagestringCrossReference: {
            kind: 'unknown'
        },
        AsKeyword: {
            kind: 'unknown'
        },
        alias: {
            kind: Assignment.kind,
            feature: 'alias',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        aliasIDRuleCall: {
            kind: 'unknown'
        },
    }
    Annotation: AnnotationRuleAccess = <AnnotationRuleAccess><unknown>{
        AtKeyword: {
            kind: 'unknown'
        },
        name: {
            kind: Assignment.kind,
            feature: 'name',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        nameIDRuleCall: {
            kind: 'unknown'
        },
    }
    ParserRule: ParserRuleRuleAccess = <ParserRuleRuleAccess><unknown>{
        fragment: {
            kind: Assignment.kind,
            feature: '^fragment',
            operator: '?=',
            terminal: {
                kind: 'unknown'
            }
        },
        FragmentKeyword: {
            kind: 'unknown'
        },
        RuleNameAndParamsRuleCall: {
            kind: 'unknown'
        },
        wildcard: {
            kind: Assignment.kind,
            feature: 'wildcard',
            operator: '?=',
            terminal: {
                kind: 'unknown'
            }
        },
        AsteriskKeyword: {
            kind: 'unknown'
        },
        ReturnsKeyword: {
            kind: 'unknown'
        },
        type: {
            kind: Assignment.kind,
            feature: 'type',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        typeIDRuleCall: {
            kind: 'unknown'
        },
        definesHiddenTokens: {
            kind: Assignment.kind,
            feature: 'definesHiddenTokens',
            operator: '?=',
            terminal: {
                kind: 'unknown'
            }
        },
        HiddenKeyword: {
            kind: 'unknown'
        },
        ParenthesisOpenKeyword: {
            kind: 'unknown'
        },
        hiddenTokens: {
            kind: Assignment.kind,
            feature: 'hiddenTokens',
            operator: '+=',
            terminal: {
                kind: CrossReference.kind
            }
        },
        hiddenTokensAbstractRuleCrossReference: {
            kind: 'unknown'
        },
        CommaKeyword: {
            kind: 'unknown'
        },
        ParenthesisCloseKeyword: {
            kind: 'unknown'
        },
        ColonKeyword: {
            kind: 'unknown'
        },
        alternatives: {
            kind: Assignment.kind,
            feature: 'alternatives',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        alternativesAlternativesRuleCall: {
            kind: 'unknown'
        },
        SemicolonKeyword: {
            kind: 'unknown'
        },
    }
    RuleNameAndParams: RuleNameAndParamsRuleAccess = <RuleNameAndParamsRuleAccess><unknown>{
        name: {
            kind: Assignment.kind,
            feature: 'name',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        nameIDRuleCall: {
            kind: 'unknown'
        },
        LessThanKeyword: {
            kind: 'unknown'
        },
        parameters: {
            kind: Assignment.kind,
            feature: 'parameters',
            operator: '+=',
            terminal: {
                kind: 'unknown'
            }
        },
        parametersParameterRuleCall: {
            kind: 'unknown'
        },
        CommaKeyword: {
            kind: 'unknown'
        },
        MoreThanKeyword: {
            kind: 'unknown'
        },
    }
    Parameter: ParameterRuleAccess = <ParameterRuleAccess><unknown>{
        name: {
            kind: Assignment.kind,
            feature: 'name',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        nameIDRuleCall: {
            kind: 'unknown'
        },
    }
    Alternatives: AlternativesRuleAccess = <AlternativesRuleAccess><unknown>{
        UnorderedGroupRuleCall: {
            kind: 'unknown'
        },
        AlternativeselementsAction: {
            kind: Action.kind,
            Type: 'Alternatives',
            feature: 'elements',
            operator: '+='
        },
        PipeKeyword: {
            kind: 'unknown'
        },
        elements: {
            kind: Assignment.kind,
            feature: 'elements',
            operator: '+=',
            terminal: {
                kind: 'unknown'
            }
        },
        elementsUnorderedGroupRuleCall: {
            kind: 'unknown'
        },
    }
    UnorderedGroup: UnorderedGroupRuleAccess = <UnorderedGroupRuleAccess><unknown>{
        GroupRuleCall: {
            kind: 'unknown'
        },
        UnorderedGroupelementsAction: {
            kind: Action.kind,
            Type: 'UnorderedGroup',
            feature: 'elements',
            operator: '+='
        },
        AmpersandKeyword: {
            kind: 'unknown'
        },
        elements: {
            kind: Assignment.kind,
            feature: 'elements',
            operator: '+=',
            terminal: {
                kind: 'unknown'
            }
        },
        elementsGroupRuleCall: {
            kind: 'unknown'
        },
    }
    Group: GroupRuleAccess = <GroupRuleAccess><unknown>{
        AbstractTokenRuleCall: {
            kind: 'unknown'
        },
        GroupelementsAction: {
            kind: Action.kind,
            Type: 'Group',
            feature: 'elements',
            operator: '+='
        },
        elements: {
            kind: Assignment.kind,
            feature: 'elements',
            operator: '+=',
            terminal: {
                kind: 'unknown'
            }
        },
        elementsAbstractTokenRuleCall: {
            kind: 'unknown'
        },
    }
    AbstractToken: AbstractTokenRuleAccess = <AbstractTokenRuleAccess><unknown>{
        AbstractTokenWithCardinalityRuleCall: {
            kind: 'unknown'
        },
        ActionRuleCall: {
            kind: 'unknown'
        },
    }
    AbstractTokenWithCardinality: AbstractTokenWithCardinalityRuleAccess = <AbstractTokenWithCardinalityRuleAccess><unknown>{
        AssignmentRuleCall: {
            kind: 'unknown'
        },
        AbstractTerminalRuleCall: {
            kind: 'unknown'
        },
        cardinality: {
            kind: Assignment.kind,
            feature: 'cardinality',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        QuestionMarkKeyword: {
            kind: 'unknown'
        },
        AsteriskKeyword: {
            kind: 'unknown'
        },
        PlusKeyword: {
            kind: 'unknown'
        },
    }
    Action: ActionRuleAccess = <ActionRuleAccess><unknown>{
        ActionAction: {
            kind: Action.kind,
            Type: 'Action',
            feature: 'undefined',
            operator: 'undefined'
        },
        CurlyOpenKeyword: {
            kind: 'unknown'
        },
        Type: {
            kind: Assignment.kind,
            feature: 'Type',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        TypeIDRuleCall: {
            kind: 'unknown'
        },
        DotKeyword: {
            kind: 'unknown'
        },
        feature: {
            kind: Assignment.kind,
            feature: 'feature',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        featureIDRuleCall: {
            kind: 'unknown'
        },
        operator: {
            kind: Assignment.kind,
            feature: 'operator',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        EqualsKeyword: {
            kind: 'unknown'
        },
        PlusEqualsKeyword: {
            kind: 'unknown'
        },
        CurrentKeyword: {
            kind: 'unknown'
        },
        CurlyCloseKeyword: {
            kind: 'unknown'
        },
    }
    AbstractTerminal: AbstractTerminalRuleAccess = <AbstractTerminalRuleAccess><unknown>{
        KeywordRuleCall: {
            kind: 'unknown'
        },
        RuleCallRuleCall: {
            kind: 'unknown'
        },
        ParenthesizedElementRuleCall: {
            kind: 'unknown'
        },
        PredicatedKeywordRuleCall: {
            kind: 'unknown'
        },
        PredicatedRuleCallRuleCall: {
            kind: 'unknown'
        },
        PredicatedGroupRuleCall: {
            kind: 'unknown'
        },
    }
    Keyword: KeywordRuleAccess = <KeywordRuleAccess><unknown>{
        value: {
            kind: Assignment.kind,
            feature: 'value',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        valuestringRuleCall: {
            kind: 'unknown'
        },
    }
    RuleCall: RuleCallRuleAccess = <RuleCallRuleAccess><unknown>{
        rule: {
            kind: Assignment.kind,
            feature: 'rule',
            operator: '=',
            terminal: {
                kind: CrossReference.kind
            }
        },
        ruleAbstractRuleCrossReference: {
            kind: 'unknown'
        },
        LessThanKeyword: {
            kind: 'unknown'
        },
        arguments: {
            kind: Assignment.kind,
            feature: 'arguments',
            operator: '+=',
            terminal: {
                kind: 'unknown'
            }
        },
        argumentsNamedArgumentRuleCall: {
            kind: 'unknown'
        },
        CommaKeyword: {
            kind: 'unknown'
        },
        MoreThanKeyword: {
            kind: 'unknown'
        },
    }
    NamedArgument: NamedArgumentRuleAccess = <NamedArgumentRuleAccess><unknown>{
        parameter: {
            kind: Assignment.kind,
            feature: 'parameter',
            operator: '=',
            terminal: {
                kind: CrossReference.kind
            }
        },
        parameterParameterCrossReference: {
            kind: 'unknown'
        },
        calledByName: {
            kind: Assignment.kind,
            feature: 'calledByName',
            operator: '?=',
            terminal: {
                kind: 'unknown'
            }
        },
        EqualsKeyword: {
            kind: 'unknown'
        },
        value: {
            kind: Assignment.kind,
            feature: 'value',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        valueDisjunctionRuleCall: {
            kind: 'unknown'
        },
    }
    LiteralCondition: LiteralConditionRuleAccess = <LiteralConditionRuleAccess><unknown>{
        true: {
            kind: Assignment.kind,
            feature: '^true',
            operator: '?=',
            terminal: {
                kind: 'unknown'
            }
        },
        TrueKeyword: {
            kind: 'unknown'
        },
        FalseKeyword: {
            kind: 'unknown'
        },
    }
    Disjunction: DisjunctionRuleAccess = <DisjunctionRuleAccess><unknown>{
        ConjunctionRuleCall: {
            kind: 'unknown'
        },
        DisjunctionleftAction: {
            kind: Action.kind,
            Type: 'Disjunction',
            feature: 'left',
            operator: '='
        },
        PipeKeyword: {
            kind: 'unknown'
        },
        right: {
            kind: Assignment.kind,
            feature: 'right',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        rightConjunctionRuleCall: {
            kind: 'unknown'
        },
    }
    Conjunction: ConjunctionRuleAccess = <ConjunctionRuleAccess><unknown>{
        NegationRuleCall: {
            kind: 'unknown'
        },
        ConjunctionleftAction: {
            kind: Action.kind,
            Type: 'Conjunction',
            feature: 'left',
            operator: '='
        },
        AmpersandKeyword: {
            kind: 'unknown'
        },
        right: {
            kind: Assignment.kind,
            feature: 'right',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        rightNegationRuleCall: {
            kind: 'unknown'
        },
    }
    Negation: NegationRuleAccess = <NegationRuleAccess><unknown>{
        AtomRuleCall: {
            kind: 'unknown'
        },
        NegationAction: {
            kind: Action.kind,
            Type: 'Negation',
            feature: 'undefined',
            operator: 'undefined'
        },
        ExclamationMarkKeyword: {
            kind: 'unknown'
        },
        value: {
            kind: Assignment.kind,
            feature: 'value',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        valueNegationRuleCall: {
            kind: 'unknown'
        },
    }
    Atom: AtomRuleAccess = <AtomRuleAccess><unknown>{
        ParameterReferenceRuleCall: {
            kind: 'unknown'
        },
        ParenthesizedConditionRuleCall: {
            kind: 'unknown'
        },
        LiteralConditionRuleCall: {
            kind: 'unknown'
        },
    }
    ParenthesizedCondition: ParenthesizedConditionRuleAccess = <ParenthesizedConditionRuleAccess><unknown>{
        ParenthesisOpenKeyword: {
            kind: 'unknown'
        },
        DisjunctionRuleCall: {
            kind: 'unknown'
        },
        ParenthesisCloseKeyword: {
            kind: 'unknown'
        },
    }
    ParameterReference: ParameterReferenceRuleAccess = <ParameterReferenceRuleAccess><unknown>{
        parameter: {
            kind: Assignment.kind,
            feature: 'parameter',
            operator: '=',
            terminal: {
                kind: CrossReference.kind
            }
        },
        parameterParameterCrossReference: {
            kind: 'unknown'
        },
    }
    TerminalRuleCall: TerminalRuleCallRuleAccess = <TerminalRuleCallRuleAccess><unknown>{
        rule: {
            kind: Assignment.kind,
            feature: 'rule',
            operator: '=',
            terminal: {
                kind: CrossReference.kind
            }
        },
        ruleAbstractRuleCrossReference: {
            kind: 'unknown'
        },
    }
    PredicatedKeyword: PredicatedKeywordRuleAccess = <PredicatedKeywordRuleAccess><unknown>{
        predicated: {
            kind: Assignment.kind,
            feature: 'predicated',
            operator: '?=',
            terminal: {
                kind: 'unknown'
            }
        },
        EqualsMoreThanKeyword: {
            kind: 'unknown'
        },
        firstSetPredicated: {
            kind: Assignment.kind,
            feature: 'firstSetPredicated',
            operator: '?=',
            terminal: {
                kind: 'unknown'
            }
        },
        DashMoreThanKeyword: {
            kind: 'unknown'
        },
        value: {
            kind: Assignment.kind,
            feature: 'value',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        valuestringRuleCall: {
            kind: 'unknown'
        },
    }
    PredicatedRuleCall: PredicatedRuleCallRuleAccess = <PredicatedRuleCallRuleAccess><unknown>{
        predicated: {
            kind: Assignment.kind,
            feature: 'predicated',
            operator: '?=',
            terminal: {
                kind: 'unknown'
            }
        },
        EqualsMoreThanKeyword: {
            kind: 'unknown'
        },
        firstSetPredicated: {
            kind: Assignment.kind,
            feature: 'firstSetPredicated',
            operator: '?=',
            terminal: {
                kind: 'unknown'
            }
        },
        DashMoreThanKeyword: {
            kind: 'unknown'
        },
        rule: {
            kind: Assignment.kind,
            feature: 'rule',
            operator: '=',
            terminal: {
                kind: CrossReference.kind
            }
        },
        ruleAbstractRuleCrossReference: {
            kind: 'unknown'
        },
        LessThanKeyword: {
            kind: 'unknown'
        },
        arguments: {
            kind: Assignment.kind,
            feature: 'arguments',
            operator: '+=',
            terminal: {
                kind: 'unknown'
            }
        },
        argumentsNamedArgumentRuleCall: {
            kind: 'unknown'
        },
        CommaKeyword: {
            kind: 'unknown'
        },
        MoreThanKeyword: {
            kind: 'unknown'
        },
    }
    Assignment: AssignmentRuleAccess = <AssignmentRuleAccess><unknown>{
        AssignmentAction: {
            kind: Action.kind,
            Type: 'Assignment',
            feature: 'undefined',
            operator: 'undefined'
        },
        predicated: {
            kind: Assignment.kind,
            feature: 'predicated',
            operator: '?=',
            terminal: {
                kind: 'unknown'
            }
        },
        EqualsMoreThanKeyword: {
            kind: 'unknown'
        },
        firstSetPredicated: {
            kind: Assignment.kind,
            feature: 'firstSetPredicated',
            operator: '?=',
            terminal: {
                kind: 'unknown'
            }
        },
        DashMoreThanKeyword: {
            kind: 'unknown'
        },
        feature: {
            kind: Assignment.kind,
            feature: 'feature',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        featureIDRuleCall: {
            kind: 'unknown'
        },
        operator: {
            kind: Assignment.kind,
            feature: 'operator',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        PlusEqualsKeyword: {
            kind: 'unknown'
        },
        EqualsKeyword: {
            kind: 'unknown'
        },
        QuestionMarkEqualsKeyword: {
            kind: 'unknown'
        },
        terminal: {
            kind: Assignment.kind,
            feature: '^terminal',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        terminalAssignableTerminalRuleCall: {
            kind: 'unknown'
        },
    }
    AssignableTerminal: AssignableTerminalRuleAccess = <AssignableTerminalRuleAccess><unknown>{
        KeywordRuleCall: {
            kind: 'unknown'
        },
        RuleCallRuleCall: {
            kind: 'unknown'
        },
        ParenthesizedAssignableElementRuleCall: {
            kind: 'unknown'
        },
        CrossReferenceRuleCall: {
            kind: 'unknown'
        },
    }
    ParenthesizedAssignableElement: ParenthesizedAssignableElementRuleAccess = <ParenthesizedAssignableElementRuleAccess><unknown>{
        ParenthesisOpenKeyword: {
            kind: 'unknown'
        },
        AssignableAlternativesRuleCall: {
            kind: 'unknown'
        },
        ParenthesisCloseKeyword: {
            kind: 'unknown'
        },
    }
    AssignableAlternatives: AssignableAlternativesRuleAccess = <AssignableAlternativesRuleAccess><unknown>{
        AssignableTerminalRuleCall: {
            kind: 'unknown'
        },
        AlternativeselementsAction: {
            kind: Action.kind,
            Type: 'Alternatives',
            feature: 'elements',
            operator: '+='
        },
        PipeKeyword: {
            kind: 'unknown'
        },
        elements: {
            kind: Assignment.kind,
            feature: 'elements',
            operator: '+=',
            terminal: {
                kind: 'unknown'
            }
        },
        elementsAssignableTerminalRuleCall: {
            kind: 'unknown'
        },
    }
    CrossReference: CrossReferenceRuleAccess = <CrossReferenceRuleAccess><unknown>{
        CrossReferenceAction: {
            kind: Action.kind,
            Type: 'CrossReference',
            feature: 'undefined',
            operator: 'undefined'
        },
        BracketOpenKeyword: {
            kind: 'unknown'
        },
        type: {
            kind: Assignment.kind,
            feature: 'type',
            operator: '=',
            terminal: {
                kind: CrossReference.kind
            }
        },
        typeParserRuleCrossReference: {
            kind: 'unknown'
        },
        PipeKeyword: {
            kind: 'unknown'
        },
        terminal: {
            kind: Assignment.kind,
            feature: '^terminal',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        terminalCrossReferenceableTerminalRuleCall: {
            kind: 'unknown'
        },
        BracketCloseKeyword: {
            kind: 'unknown'
        },
    }
    CrossReferenceableTerminal: CrossReferenceableTerminalRuleAccess = <CrossReferenceableTerminalRuleAccess><unknown>{
        KeywordRuleCall: {
            kind: 'unknown'
        },
        RuleCallRuleCall: {
            kind: 'unknown'
        },
    }
    ParenthesizedElement: ParenthesizedElementRuleAccess = <ParenthesizedElementRuleAccess><unknown>{
        ParenthesisOpenKeyword: {
            kind: 'unknown'
        },
        AlternativesRuleCall: {
            kind: 'unknown'
        },
        ParenthesisCloseKeyword: {
            kind: 'unknown'
        },
    }
    PredicatedGroup: PredicatedGroupRuleAccess = <PredicatedGroupRuleAccess><unknown>{
        predicated: {
            kind: Assignment.kind,
            feature: 'predicated',
            operator: '?=',
            terminal: {
                kind: 'unknown'
            }
        },
        EqualsMoreThanKeyword: {
            kind: 'unknown'
        },
        firstSetPredicated: {
            kind: Assignment.kind,
            feature: 'firstSetPredicated',
            operator: '?=',
            terminal: {
                kind: 'unknown'
            }
        },
        DashMoreThanKeyword: {
            kind: 'unknown'
        },
        ParenthesisOpenKeyword: {
            kind: 'unknown'
        },
        elements: {
            kind: Assignment.kind,
            feature: 'elements',
            operator: '+=',
            terminal: {
                kind: 'unknown'
            }
        },
        elementsAlternativesRuleCall: {
            kind: 'unknown'
        },
        ParenthesisCloseKeyword: {
            kind: 'unknown'
        },
    }
    TerminalRule: TerminalRuleRuleAccess = <TerminalRuleRuleAccess><unknown>{
        TerminalKeyword: {
            kind: 'unknown'
        },
        fragment: {
            kind: Assignment.kind,
            feature: '^fragment',
            operator: '?=',
            terminal: {
                kind: 'unknown'
            }
        },
        FragmentKeyword: {
            kind: 'unknown'
        },
        name: {
            kind: Assignment.kind,
            feature: 'name',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        nameIDRuleCall: {
            kind: 'unknown'
        },
        ReturnsKeyword: {
            kind: 'unknown'
        },
        type: {
            kind: Assignment.kind,
            feature: 'type',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        typeIDRuleCall: {
            kind: 'unknown'
        },
        ColonKeyword: {
            kind: 'unknown'
        },
        regex: {
            kind: Assignment.kind,
            feature: 'regex',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        regexRegexLiteralRuleCall: {
            kind: 'unknown'
        },
        SemicolonKeyword: {
            kind: 'unknown'
        },
    }
    TerminalAlternatives: TerminalAlternativesRuleAccess = <TerminalAlternativesRuleAccess><unknown>{
        TerminalGroupRuleCall: {
            kind: 'unknown'
        },
        TerminalAlternativeselementsAction: {
            kind: Action.kind,
            Type: 'TerminalAlternatives',
            feature: 'elements',
            operator: '+='
        },
        PipeKeyword: {
            kind: 'unknown'
        },
        elements: {
            kind: Assignment.kind,
            feature: 'elements',
            operator: '+=',
            terminal: {
                kind: 'unknown'
            }
        },
        elementsTerminalGroupRuleCall: {
            kind: 'unknown'
        },
    }
    TerminalGroup: TerminalGroupRuleAccess = <TerminalGroupRuleAccess><unknown>{
        elements: {
            kind: Assignment.kind,
            feature: 'elements',
            operator: '+=',
            terminal: {
                kind: 'unknown'
            }
        },
        elementsTerminalTokenRuleCall: {
            kind: 'unknown'
        },
    }
    TerminalToken: TerminalTokenRuleAccess = <TerminalTokenRuleAccess><unknown>{
        TerminalTokenElementRuleCall: {
            kind: 'unknown'
        },
        cardinality: {
            kind: Assignment.kind,
            feature: 'cardinality',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        QuestionMarkKeyword: {
            kind: 'unknown'
        },
        AsteriskKeyword: {
            kind: 'unknown'
        },
        PlusKeyword: {
            kind: 'unknown'
        },
    }
    TerminalTokenElement: TerminalTokenElementRuleAccess = <TerminalTokenElementRuleAccess><unknown>{
        CharacterRangeRuleCall: {
            kind: 'unknown'
        },
        TerminalRuleCallRuleCall: {
            kind: 'unknown'
        },
        ParenthesizedTerminalElementRuleCall: {
            kind: 'unknown'
        },
        AbstractNegatedTokenRuleCall: {
            kind: 'unknown'
        },
        WildcardRuleCall: {
            kind: 'unknown'
        },
    }
    ParenthesizedTerminalElement: ParenthesizedTerminalElementRuleAccess = <ParenthesizedTerminalElementRuleAccess><unknown>{
        ParenthesisOpenKeyword: {
            kind: 'unknown'
        },
        TerminalAlternativesRuleCall: {
            kind: 'unknown'
        },
        ParenthesisCloseKeyword: {
            kind: 'unknown'
        },
    }
    AbstractNegatedToken: AbstractNegatedTokenRuleAccess = <AbstractNegatedTokenRuleAccess><unknown>{
        NegatedTokenRuleCall: {
            kind: 'unknown'
        },
        UntilTokenRuleCall: {
            kind: 'unknown'
        },
    }
    NegatedToken: NegatedTokenRuleAccess = <NegatedTokenRuleAccess><unknown>{
        ExclamationMarkKeyword: {
            kind: 'unknown'
        },
        terminal: {
            kind: Assignment.kind,
            feature: '^terminal',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        terminalTerminalTokenElementRuleCall: {
            kind: 'unknown'
        },
    }
    UntilToken: UntilTokenRuleAccess = <UntilTokenRuleAccess><unknown>{
        DashMoreThanKeyword: {
            kind: 'unknown'
        },
        terminal: {
            kind: Assignment.kind,
            feature: '^terminal',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        terminalTerminalTokenElementRuleCall: {
            kind: 'unknown'
        },
    }
    Wildcard: WildcardRuleAccess = <WildcardRuleAccess><unknown>{
        WildcardAction: {
            kind: Action.kind,
            Type: 'Wildcard',
            feature: 'undefined',
            operator: 'undefined'
        },
        DotKeyword: {
            kind: 'unknown'
        },
    }
    CharacterRange: CharacterRangeRuleAccess = <CharacterRangeRuleAccess><unknown>{
        left: {
            kind: Assignment.kind,
            feature: 'left',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        leftKeywordRuleCall: {
            kind: 'unknown'
        },
        DotDotKeyword: {
            kind: 'unknown'
        },
        right: {
            kind: Assignment.kind,
            feature: 'right',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        rightKeywordRuleCall: {
            kind: 'unknown'
        },
    }
    EnumRule: EnumRuleRuleAccess = <EnumRuleRuleAccess><unknown>{
        EnumKeyword: {
            kind: 'unknown'
        },
        name: {
            kind: Assignment.kind,
            feature: 'name',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        nameIDRuleCall: {
            kind: 'unknown'
        },
        ReturnsKeyword: {
            kind: 'unknown'
        },
        type: {
            kind: Assignment.kind,
            feature: 'type',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        typeIDRuleCall: {
            kind: 'unknown'
        },
        ColonKeyword: {
            kind: 'unknown'
        },
        alternatives: {
            kind: Assignment.kind,
            feature: 'alternatives',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        alternativesEnumLiteralsRuleCall: {
            kind: 'unknown'
        },
        SemicolonKeyword: {
            kind: 'unknown'
        },
    }
    EnumLiterals: EnumLiteralsRuleAccess = <EnumLiteralsRuleAccess><unknown>{
        EnumLiteralDeclarationRuleCall: {
            kind: 'unknown'
        },
        EnumLiteralselementsAction: {
            kind: Action.kind,
            Type: 'EnumLiterals',
            feature: 'elements',
            operator: '+='
        },
        PipeKeyword: {
            kind: 'unknown'
        },
        elements: {
            kind: Assignment.kind,
            feature: 'elements',
            operator: '+=',
            terminal: {
                kind: 'unknown'
            }
        },
        elementsEnumLiteralDeclarationRuleCall: {
            kind: 'unknown'
        },
    }
    EnumLiteralDeclaration: EnumLiteralDeclarationRuleAccess = <EnumLiteralDeclarationRuleAccess><unknown>{
        enumLiteral: {
            kind: Assignment.kind,
            feature: 'enumLiteral',
            operator: '=',
            terminal: {
                kind: CrossReference.kind
            }
        },
        enumLiteralEnumLiteralsCrossReference: {
            kind: 'unknown'
        },
        EqualsKeyword: {
            kind: 'unknown'
        },
        literal: {
            kind: Assignment.kind,
            feature: 'literal',
            operator: '=',
            terminal: {
                kind: 'unknown'
            }
        },
        literalKeywordRuleCall: {
            kind: 'unknown'
        },
    }
}