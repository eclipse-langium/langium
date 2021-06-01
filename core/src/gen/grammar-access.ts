import { GrammarAccess } from '../grammar/grammar-access';
import { retrocycle } from '../grammar/grammar-utils';
import { Action, Assignment, CrossReference, Keyword, RuleCall } from './ast';

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
    ePackagestringRuleCall: RuleCall;
    AsKeyword: Keyword;
    alias: Assignment;
    aliasIDRuleCall: RuleCall;
}

export type ReferencedMetamodelRuleAccess = {
    ImportKeyword: Keyword;
    ePackage: Assignment;
    ePackagestringRuleCall: RuleCall;
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
    type: Assignment;
    typeIDRuleCall: RuleCall;
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
    enumLiteralIDRuleCall: RuleCall;
    EqualsKeyword: Keyword;
    literal: Assignment;
    literalKeywordRuleCall: RuleCall;
}

export class LangiumGrammarAccess extends GrammarAccess {
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

    constructor() {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        super(retrocycle(require('./grammar.json')));
    }
}
