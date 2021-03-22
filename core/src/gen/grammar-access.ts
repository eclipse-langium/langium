import { GrammarAccess } from '../grammar/grammar-access'
import { Action, Assignment, CrossReference, Keyword, RuleCall } from './ast'

type GrammarRuleAccess = {
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

type AbstractRuleRuleAccess = {
    ParserRuleRuleCall: RuleCall;
    TerminalRuleRuleCall: RuleCall;
    EnumRuleRuleCall: RuleCall;
}

type AbstractMetamodelDeclarationRuleAccess = {
    GeneratedMetamodelRuleCall: RuleCall;
    ReferencedMetamodelRuleCall: RuleCall;
}

type GeneratedMetamodelRuleAccess = {
    GenerateKeyword: Keyword;
    Name: Assignment;
    NameIDRuleCall: RuleCall;
    EPackage: Assignment;
    EPackagestringCrossReference: CrossReference;
    AsKeyword: Keyword;
    Alias: Assignment;
    AliasIDRuleCall: RuleCall;
}

type ReferencedMetamodelRuleAccess = {
    ImportKeyword: Keyword;
    EPackage: Assignment;
    EPackagestringCrossReference: CrossReference;
    AsKeyword: Keyword;
    Alias: Assignment;
    AliasIDRuleCall: RuleCall;
}

type AnnotationRuleAccess = {
    AtKeyword: Keyword;
    Name: Assignment;
    NameIDRuleCall: RuleCall;
}

type ParserRuleRuleAccess = {
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

type RuleNameAndParamsRuleAccess = {
    Name: Assignment;
    NameIDRuleCall: RuleCall;
    LessThanKeyword: Keyword;
    Parameters: Assignment;
    ParametersParameterRuleCall: RuleCall;
    CommaKeyword: Keyword;
    MoreThanKeyword: Keyword;
}

type ParameterRuleAccess = {
    Name: Assignment;
    NameIDRuleCall: RuleCall;
}

type AlternativesRuleAccess = {
    UnorderedGroupRuleCall: RuleCall;
    ElementsAction: Action;
    PipeKeyword: Keyword;
    Elements: Assignment;
    ElementsUnorderedGroupRuleCall: RuleCall;
}

type UnorderedGroupRuleAccess = {
    GroupRuleCall: RuleCall;
    ElementsAction: Action;
    AmpersandKeyword: Keyword;
    Elements: Assignment;
    ElementsGroupRuleCall: RuleCall;
}

type GroupRuleAccess = {
    Elements: Assignment;
    ElementsAbstractTokenRuleCall: RuleCall;
}

type AbstractTokenRuleAccess = {
    AbstractTokenWithCardinalityRuleCall: RuleCall;
    ActionRuleCall: RuleCall;
}

type AbstractTokenWithCardinalityRuleAccess = {
    AssignmentRuleCall: RuleCall;
    AbstractTerminalRuleCall: RuleCall;
    Cardinality: Assignment;
    QuestionMarkKeyword: Keyword;
    AsteriskKeyword: Keyword;
    PlusKeyword: Keyword;
}

type ActionRuleAccess = {
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

type AbstractTerminalRuleAccess = {
    KeywordRuleCall: RuleCall;
    RuleCallRuleCall: RuleCall;
    ParenthesizedElementRuleCall: RuleCall;
    PredicatedKeywordRuleCall: RuleCall;
    PredicatedRuleCallRuleCall: RuleCall;
    PredicatedGroupRuleCall: RuleCall;
}

type KeywordRuleAccess = {
    Value: Assignment;
    ValuestringRuleCall: RuleCall;
}

type RuleCallRuleAccess = {
    Rule: Assignment;
    RuleAbstractRuleCrossReference: CrossReference;
    LessThanKeyword: Keyword;
    Arguments: Assignment;
    ArgumentsNamedArgumentRuleCall: RuleCall;
    CommaKeyword: Keyword;
    MoreThanKeyword: Keyword;
}

type NamedArgumentRuleAccess = {
    Parameter: Assignment;
    ParameterParameterCrossReference: CrossReference;
    CalledByName: Assignment;
    EqualsKeyword: Keyword;
    Value: Assignment;
    ValueDisjunctionRuleCall: RuleCall;
}

type LiteralConditionRuleAccess = {
    undefinedAction: Action;
    True: Assignment;
    TrueKeyword: Keyword;
    FalseKeyword: Keyword;
}

type DisjunctionRuleAccess = {
    Left: Assignment;
    LeftConjunctionRuleCall: RuleCall;
    PipeKeyword: Keyword;
    Right: Assignment;
    RightConjunctionRuleCall: RuleCall;
}

type ConjunctionRuleAccess = {
    Left: Assignment;
    LeftNegationRuleCall: RuleCall;
    AmpersandKeyword: Keyword;
    Right: Assignment;
    RightNegationRuleCall: RuleCall;
}

type NegationRuleAccess = {
    AtomRuleCall: RuleCall;
    undefinedAction: Action;
    ExclamationMarkKeyword: Keyword;
    Value: Assignment;
    ValueNegationRuleCall: RuleCall;
}

type AtomRuleAccess = {
    ParameterReferenceRuleCall: RuleCall;
    ParenthesizedConditionRuleCall: RuleCall;
    LiteralConditionRuleCall: RuleCall;
}

type ParenthesizedConditionRuleAccess = {
    ParenthesisOpenKeyword: Keyword;
    DisjunctionRuleCall: RuleCall;
    ParenthesisCloseKeyword: Keyword;
}

type ParameterReferenceRuleAccess = {
    Parameter: Assignment;
    ParameterParameterCrossReference: CrossReference;
}

type TerminalRuleCallRuleAccess = {
    Rule: Assignment;
    RuleAbstractRuleCrossReference: CrossReference;
}

type PredicatedKeywordRuleAccess = {
    Predicated: Assignment;
    EqualsMoreThanKeyword: Keyword;
    FirstSetPredicated: Assignment;
    DashMoreThanKeyword: Keyword;
    Value: Assignment;
    ValuestringRuleCall: RuleCall;
}

type PredicatedRuleCallRuleAccess = {
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

type AssignmentRuleAccess = {
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

type AssignableTerminalRuleAccess = {
    KeywordRuleCall: RuleCall;
    RuleCallRuleCall: RuleCall;
    ParenthesizedAssignableElementRuleCall: RuleCall;
    CrossReferenceRuleCall: RuleCall;
}

type ParenthesizedAssignableElementRuleAccess = {
    ParenthesisOpenKeyword: Keyword;
    Alternatives: Assignment;
    AlternativesAssignableAlternativesRuleCall: RuleCall;
    ParenthesisCloseKeyword: Keyword;
}

type AssignableAlternativesRuleAccess = {
    Elements: Assignment;
    ElementsAssignableTerminalRuleCall: RuleCall;
    PipeKeyword: Keyword;
}

type CrossReferenceRuleAccess = {
    BracketOpenKeyword: Keyword;
    Type: Assignment;
    TypeParserRuleCrossReference: CrossReference;
    PipeKeyword: Keyword;
    Terminal: Assignment;
    TerminalCrossReferenceableTerminalRuleCall: RuleCall;
    BracketCloseKeyword: Keyword;
}

type CrossReferenceableTerminalRuleAccess = {
    KeywordRuleCall: RuleCall;
    RuleCallRuleCall: RuleCall;
}

type ParenthesizedElementRuleAccess = {
    ParenthesisOpenKeyword: Keyword;
    Alternatives: Assignment;
    AlternativesAlternativesRuleCall: RuleCall;
    ParenthesisCloseKeyword: Keyword;
}

type PredicatedGroupRuleAccess = {
    Predicated: Assignment;
    EqualsMoreThanKeyword: Keyword;
    FirstSetPredicated: Assignment;
    DashMoreThanKeyword: Keyword;
    ParenthesisOpenKeyword: Keyword;
    Elements: Assignment;
    ElementsAlternativesRuleCall: RuleCall;
    ParenthesisCloseKeyword: Keyword;
}

type TerminalRuleRuleAccess = {
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

type TerminalAlternativesRuleAccess = {
    Elements: Assignment;
    ElementsTerminalGroupRuleCall: RuleCall;
    PipeKeyword: Keyword;
}

type TerminalGroupRuleAccess = {
    Elements: Assignment;
    ElementsTerminalTokenRuleCall: RuleCall;
}

type TerminalTokenRuleAccess = {
    TerminalTokenElementRuleCall: RuleCall;
    Cardinality: Assignment;
    QuestionMarkKeyword: Keyword;
    AsteriskKeyword: Keyword;
    PlusKeyword: Keyword;
}

type TerminalTokenElementRuleAccess = {
    CharacterRangeRuleCall: RuleCall;
    TerminalRuleCallRuleCall: RuleCall;
    ParenthesizedTerminalElementRuleCall: RuleCall;
    AbstractNegatedTokenRuleCall: RuleCall;
    WildcardRuleCall: RuleCall;
}

type ParenthesizedTerminalElementRuleAccess = {
    ParenthesisOpenKeyword: Keyword;
    TerminalAlternativesRuleCall: RuleCall;
    ParenthesisCloseKeyword: Keyword;
}

type AbstractNegatedTokenRuleAccess = {
    NegatedTokenRuleCall: RuleCall;
    UntilTokenRuleCall: RuleCall;
}

type NegatedTokenRuleAccess = {
    ExclamationMarkKeyword: Keyword;
    Terminal: Assignment;
    TerminalTerminalTokenElementRuleCall: RuleCall;
}

type UntilTokenRuleAccess = {
    DashMoreThanKeyword: Keyword;
    Terminal: Assignment;
    TerminalTerminalTokenElementRuleCall: RuleCall;
}

type WildcardRuleAccess = {
    undefinedAction: Action;
    DotKeyword: Keyword;
}

type CharacterRangeRuleAccess = {
    Left: Assignment;
    LeftKeywordRuleCall: RuleCall;
    DotDotKeyword: Keyword;
    Right: Assignment;
    RightKeywordRuleCall: RuleCall;
}

type EnumRuleRuleAccess = {
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

type EnumLiteralsRuleAccess = {
    Elements: Assignment;
    ElementsEnumLiteralDeclarationRuleCall: RuleCall;
    PipeKeyword: Keyword;
}

type EnumLiteralDeclarationRuleAccess = {
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