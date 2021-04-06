import { GrammarAccess } from '../index'
import { Action, Assignment, CrossReference, Keyword, RuleCall } from './ast'

export type GrammarRuleAccess = {
    GrammarKeyword: Keyword;
    Name: Assignment;
    NameIDRuleCall: RuleCall;
    WithKeyword: Keyword;
    UsedGrammars: Assignment;
    UsedGrammarsGrammarCrossReference: CrossReference;
    CommaKeyword: Keyword;
    definesHiddenTokens: Assignment;
    HiddenKeyword: Keyword;
    ParenthesisOpenKeyword: Keyword;
    HiddenTokens: Assignment;
    HiddenTokensAbstractRuleCrossReference: CrossReference;
    ParenthesisCloseKeyword: Keyword;
    MetamodelDeclarations: Assignment;
    MetamodelDeclarationsAbstractMetamodelDeclarationRuleCall: RuleCall;
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
    Name: Assignment;
    NameIDRuleCall: RuleCall;
    EPackage: Assignment;
    EPackagestringCrossReference: CrossReference;
    AsKeyword: Keyword;
    Alias: Assignment;
    AliasIDRuleCall: RuleCall;
}

export type ReferencedMetamodelRuleAccess = {
    ImportKeyword: Keyword;
    EPackage: Assignment;
    EPackagestringCrossReference: CrossReference;
    AsKeyword: Keyword;
    Alias: Assignment;
    AliasIDRuleCall: RuleCall;
}

export type AnnotationRuleAccess = {
    AtKeyword: Keyword;
    Name: Assignment;
    NameIDRuleCall: RuleCall;
}

export type ParserRuleRuleAccess = {
    fragment: Assignment;
    FragmentKeyword: Keyword;
    Name: Assignment;
    NameIDRuleCall: RuleCall;
    LessThanKeyword: Keyword;
    Parameters: Assignment;
    ParametersParameterRuleCall: RuleCall;
    CommaKeyword: Keyword;
    MoreThanKeyword: Keyword;
    wildcard: Assignment;
    AsteriskKeyword: Keyword;
    ReturnsKeyword: Keyword;
    Type: Assignment;
    TypeIDRuleCall: RuleCall;
    DefinesHiddenTokens: Assignment;
    HiddenKeyword: Keyword;
    ParenthesisOpenKeyword: Keyword;
    HiddenTokens: Assignment;
    HiddenTokensAbstractRuleCrossReference: CrossReference;
    ParenthesisCloseKeyword: Keyword;
    ColonKeyword: Keyword;
    Alternatives: Assignment;
    AlternativesAlternativesRuleCall: RuleCall;
    SemicolonKeyword: Keyword;
}

export type RuleNameAndParamsRuleAccess = {
    Name: Assignment;
    NameIDRuleCall: RuleCall;
    LessThanKeyword: Keyword;
    Parameters: Assignment;
    ParametersParameterRuleCall: RuleCall;
    CommaKeyword: Keyword;
    MoreThanKeyword: Keyword;
}

export type ParameterRuleAccess = {
    Name: Assignment;
    NameIDRuleCall: RuleCall;
}

export type AlternativesRuleAccess = {
    UnorderedGroupRuleCall: RuleCall;
    ElementsAction: Action;
    PipeKeyword: Keyword;
    Elements: Assignment;
    ElementsUnorderedGroupRuleCall: RuleCall;
}

export type UnorderedGroupRuleAccess = {
    GroupRuleCall: RuleCall;
    ElementsAction: Action;
    AmpersandKeyword: Keyword;
    Elements: Assignment;
    ElementsGroupRuleCall: RuleCall;
}

export type GroupRuleAccess = {
    Elements: Assignment;
    ElementsAbstractTokenRuleCall: RuleCall;
}

export type AbstractTokenRuleAccess = {
    AbstractTokenWithCardinalityRuleCall: RuleCall;
    ActionRuleCall: RuleCall;
}

export type AbstractTokenWithCardinalityRuleAccess = {
    AssignmentRuleCall: RuleCall;
    AbstractTerminalRuleCall: RuleCall;
    Cardinality: Assignment;
    QuestionMarkKeyword: Keyword;
    AsteriskKeyword: Keyword;
    PlusKeyword: Keyword;
}

export type ActionRuleAccess = {
    CurlyOpenKeyword: Keyword;
    Type: Assignment;
    TypeParserRuleCrossReference: CrossReference;
    DotKeyword: Keyword;
    Feature: Assignment;
    FeatureIDRuleCall: RuleCall;
    Operator: Assignment;
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
    Value: Assignment;
    ValuestringRuleCall: RuleCall;
}

export type RuleCallRuleAccess = {
    Rule: Assignment;
    RuleAbstractRuleCrossReference: CrossReference;
    LessThanKeyword: Keyword;
    Arguments: Assignment;
    ArgumentsNamedArgumentRuleCall: RuleCall;
    CommaKeyword: Keyword;
    MoreThanKeyword: Keyword;
}

export type NamedArgumentRuleAccess = {
    Parameter: Assignment;
    ParameterParameterCrossReference: CrossReference;
    CalledByName: Assignment;
    EqualsKeyword: Keyword;
    Value: Assignment;
    ValueDisjunctionRuleCall: RuleCall;
}

export type LiteralConditionRuleAccess = {
    True: Assignment;
    TrueKeyword: Keyword;
    FalseKeyword: Keyword;
}

export type DisjunctionRuleAccess = {
    ConjunctionRuleCall: RuleCall;
    LeftAction: Action;
    PipeKeyword: Keyword;
    Right: Assignment;
    RightConjunctionRuleCall: RuleCall;
}

export type ConjunctionRuleAccess = {
    NegationRuleCall: RuleCall;
    LeftAction: Action;
    AmpersandKeyword: Keyword;
    Right: Assignment;
    RightNegationRuleCall: RuleCall;
}

export type NegationRuleAccess = {
    AtomRuleCall: RuleCall;
    ExclamationMarkKeyword: Keyword;
    Value: Assignment;
    ValueNegationRuleCall: RuleCall;
}

export type AtomRuleAccess = {
    ParameterReferenceRuleCall: RuleCall;
    ParenthesizedConditionRuleCall: RuleCall;
    LiteralConditionRuleCall: RuleCall;
}

export type ParenthesizedConditionRuleAccess = {
    ParenthesisOpenKeyword: Keyword;
    Value: Assignment;
    ValueDisjunctionRuleCall: RuleCall;
    ParenthesisCloseKeyword: Keyword;
}

export type ParameterReferenceRuleAccess = {
    Parameter: Assignment;
    ParameterParameterCrossReference: CrossReference;
}

export type TerminalRuleCallRuleAccess = {
    Rule: Assignment;
    RuleAbstractRuleCrossReference: CrossReference;
}

export type PredicatedKeywordRuleAccess = {
    Predicated: Assignment;
    EqualsMoreThanKeyword: Keyword;
    FirstSetPredicated: Assignment;
    DashMoreThanKeyword: Keyword;
    Value: Assignment;
    ValuestringRuleCall: RuleCall;
}

export type PredicatedRuleCallRuleAccess = {
    Predicated: Assignment;
    EqualsMoreThanKeyword: Keyword;
    FirstSetPredicated: Assignment;
    DashMoreThanKeyword: Keyword;
    Rule: Assignment;
    RuleAbstractRuleCrossReference: CrossReference;
    LessThanKeyword: Keyword;
    Arguments: Assignment;
    ArgumentsNamedArgumentRuleCall: RuleCall;
    CommaKeyword: Keyword;
    MoreThanKeyword: Keyword;
}

export type AssignmentRuleAccess = {
    Predicated: Assignment;
    EqualsMoreThanKeyword: Keyword;
    FirstSetPredicated: Assignment;
    DashMoreThanKeyword: Keyword;
    Feature: Assignment;
    FeatureIDRuleCall: RuleCall;
    Operator: Assignment;
    PlusEqualsKeyword: Keyword;
    EqualsKeyword: Keyword;
    QuestionMarkEqualsKeyword: Keyword;
    Terminal: Assignment;
    TerminalAssignableTerminalRuleCall: RuleCall;
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
    Elements: Assignment;
    ElementsAssignableTerminalRuleCall: RuleCall;
    PipeKeyword: Keyword;
}

export type CrossReferenceRuleAccess = {
    BracketOpenKeyword: Keyword;
    Type: Assignment;
    TypeParserRuleCrossReference: CrossReference;
    PipeKeyword: Keyword;
    Terminal: Assignment;
    TerminalCrossReferenceableTerminalRuleCall: RuleCall;
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
    Predicated: Assignment;
    EqualsMoreThanKeyword: Keyword;
    FirstSetPredicated: Assignment;
    DashMoreThanKeyword: Keyword;
    ParenthesisOpenKeyword: Keyword;
    Elements: Assignment;
    ElementsAlternativesRuleCall: RuleCall;
    ParenthesisCloseKeyword: Keyword;
}

export type TerminalRuleRuleAccess = {
    TerminalKeyword: Keyword;
    Fragment: Assignment;
    FragmentKeyword: Keyword;
    Name: Assignment;
    NameIDRuleCall: RuleCall;
    ReturnsKeyword: Keyword;
    Type: Assignment;
    TypeIDRuleCall: RuleCall;
    ColonKeyword: Keyword;
    Regex: Assignment;
    RegexRegexLiteralRuleCall: RuleCall;
    SemicolonKeyword: Keyword;
}

export type TerminalAlternativesRuleAccess = {
    TerminalGroupRuleCall: RuleCall;
    ElementsAction: Action;
    PipeKeyword: Keyword;
    Elements: Assignment;
    ElementsTerminalGroupRuleCall: RuleCall;
}

export type TerminalGroupRuleAccess = {
    Elements: Assignment;
    ElementsTerminalTokenRuleCall: RuleCall;
}

export type TerminalTokenRuleAccess = {
    TerminalTokenElementRuleCall: RuleCall;
    Cardinality: Assignment;
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
    Terminal: Assignment;
    TerminalTerminalTokenElementRuleCall: RuleCall;
}

export type UntilTokenRuleAccess = {
    DashMoreThanKeyword: Keyword;
    Terminal: Assignment;
    TerminalTerminalTokenElementRuleCall: RuleCall;
}

export type WildcardRuleAccess = {
    undefinedAction: Action;
    DotKeyword: Keyword;
}

export type CharacterRangeRuleAccess = {
    Left: Assignment;
    LeftKeywordRuleCall: RuleCall;
    DotDotKeyword: Keyword;
    Right: Assignment;
    RightKeywordRuleCall: RuleCall;
}

export type EnumRuleRuleAccess = {
    EnumKeyword: Keyword;
    Name: Assignment;
    NameIDRuleCall: RuleCall;
    ReturnsKeyword: Keyword;
    Type: Assignment;
    TypeIDRuleCall: RuleCall;
    ColonKeyword: Keyword;
    Alternatives: Assignment;
    AlternativesEnumLiteralsRuleCall: RuleCall;
    SemicolonKeyword: Keyword;
}

export type EnumLiteralsRuleAccess = {
    EnumLiteralDeclarationRuleCall: RuleCall;
    ElementsAction: Action;
    PipeKeyword: Keyword;
    Elements: Assignment;
    ElementsEnumLiteralDeclarationRuleCall: RuleCall;
}

export type EnumLiteralDeclarationRuleAccess = {
    EnumLiteral: Assignment;
    EnumLiteralEnumLiteralsCrossReference: CrossReference;
    EqualsKeyword: Keyword;
    Literal: Assignment;
    LiteralKeywordRuleCall: RuleCall;
}

export class xtextGrammarAccess extends GrammarAccess {
    Grammar = this.buildAccess<GrammarRuleAccess>('Grammar');
    AbstractRule = this.buildAccess<AbstractRuleRuleAccess>('AbstractRule');
    AbstractMetamodelDeclaration = this.buildAccess<AbstractMetamodelDeclarationRuleAccess>('AbstractMetamodelDeclaration');
    GeneratedMetamodel = this.buildAccess<GeneratedMetamodelRuleAccess>('GeneratedMetamodel');
    ReferencedMetamodel = this.buildAccess<ReferencedMetamodelRuleAccess>('ReferencedMetamodel');
    Annotation = this.buildAccess<AnnotationRuleAccess>('Annotation');
    ParserRule = this.buildAccess<ParserRuleRuleAccess>('ParserRule');
    RuleNameAndParams = this.buildAccess<RuleNameAndParamsRuleAccess>('RuleNameAndParams');
    Parameter = this.buildAccess<ParameterRuleAccess>('Parameter');
    Alternatives = this.buildAccess<AlternativesRuleAccess>('Alternatives');
    UnorderedGroup = this.buildAccess<UnorderedGroupRuleAccess>('UnorderedGroup');
    Group = this.buildAccess<GroupRuleAccess>('Group');
    AbstractToken = this.buildAccess<AbstractTokenRuleAccess>('AbstractToken');
    AbstractTokenWithCardinality = this.buildAccess<AbstractTokenWithCardinalityRuleAccess>('AbstractTokenWithCardinality');
    Action = this.buildAccess<ActionRuleAccess>('Action');
    AbstractTerminal = this.buildAccess<AbstractTerminalRuleAccess>('AbstractTerminal');
    Keyword = this.buildAccess<KeywordRuleAccess>('Keyword');
    RuleCall = this.buildAccess<RuleCallRuleAccess>('RuleCall');
    NamedArgument = this.buildAccess<NamedArgumentRuleAccess>('NamedArgument');
    LiteralCondition = this.buildAccess<LiteralConditionRuleAccess>('LiteralCondition');
    Disjunction = this.buildAccess<DisjunctionRuleAccess>('Disjunction');
    Conjunction = this.buildAccess<ConjunctionRuleAccess>('Conjunction');
    Negation = this.buildAccess<NegationRuleAccess>('Negation');
    Atom = this.buildAccess<AtomRuleAccess>('Atom');
    ParenthesizedCondition = this.buildAccess<ParenthesizedConditionRuleAccess>('ParenthesizedCondition');
    ParameterReference = this.buildAccess<ParameterReferenceRuleAccess>('ParameterReference');
    TerminalRuleCall = this.buildAccess<TerminalRuleCallRuleAccess>('TerminalRuleCall');
    PredicatedKeyword = this.buildAccess<PredicatedKeywordRuleAccess>('PredicatedKeyword');
    PredicatedRuleCall = this.buildAccess<PredicatedRuleCallRuleAccess>('PredicatedRuleCall');
    Assignment = this.buildAccess<AssignmentRuleAccess>('Assignment');
    AssignableTerminal = this.buildAccess<AssignableTerminalRuleAccess>('AssignableTerminal');
    ParenthesizedAssignableElement = this.buildAccess<ParenthesizedAssignableElementRuleAccess>('ParenthesizedAssignableElement');
    AssignableAlternatives = this.buildAccess<AssignableAlternativesRuleAccess>('AssignableAlternatives');
    CrossReference = this.buildAccess<CrossReferenceRuleAccess>('CrossReference');
    CrossReferenceableTerminal = this.buildAccess<CrossReferenceableTerminalRuleAccess>('CrossReferenceableTerminal');
    ParenthesizedElement = this.buildAccess<ParenthesizedElementRuleAccess>('ParenthesizedElement');
    PredicatedGroup = this.buildAccess<PredicatedGroupRuleAccess>('PredicatedGroup');
    TerminalRule = this.buildAccess<TerminalRuleRuleAccess>('TerminalRule');
    TerminalAlternatives = this.buildAccess<TerminalAlternativesRuleAccess>('TerminalAlternatives');
    TerminalGroup = this.buildAccess<TerminalGroupRuleAccess>('TerminalGroup');
    TerminalToken = this.buildAccess<TerminalTokenRuleAccess>('TerminalToken');
    TerminalTokenElement = this.buildAccess<TerminalTokenElementRuleAccess>('TerminalTokenElement');
    ParenthesizedTerminalElement = this.buildAccess<ParenthesizedTerminalElementRuleAccess>('ParenthesizedTerminalElement');
    AbstractNegatedToken = this.buildAccess<AbstractNegatedTokenRuleAccess>('AbstractNegatedToken');
    NegatedToken = this.buildAccess<NegatedTokenRuleAccess>('NegatedToken');
    UntilToken = this.buildAccess<UntilTokenRuleAccess>('UntilToken');
    Wildcard = this.buildAccess<WildcardRuleAccess>('Wildcard');
    CharacterRange = this.buildAccess<CharacterRangeRuleAccess>('CharacterRange');
    EnumRule = this.buildAccess<EnumRuleRuleAccess>('EnumRule');
    EnumLiterals = this.buildAccess<EnumLiteralsRuleAccess>('EnumLiterals');
    EnumLiteralDeclaration = this.buildAccess<EnumLiteralDeclarationRuleAccess>('EnumLiteralDeclaration');
}