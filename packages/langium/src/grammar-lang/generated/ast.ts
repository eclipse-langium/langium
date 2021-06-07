/* eslint-disable @typescript-eslint/array-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-empty-interface */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { AstNode, AstReflection, Reference } from '../../generator/ast-node';

export interface AbstractElement extends AstNode {
    cardinality: '?' | '*' | '+'
}

export const AbstractElement = 'AbstractElement';

export function isAbstractElement(item: any): item is AbstractElement {
    return reflection.isInstance(item, AbstractElement);
}

export interface AbstractMetamodelDeclaration extends AstNode {
    ePackage: string
    alias: string
}

export const AbstractMetamodelDeclaration = 'AbstractMetamodelDeclaration';

export function isAbstractMetamodelDeclaration(item: any): item is AbstractMetamodelDeclaration {
    return reflection.isInstance(item, AbstractMetamodelDeclaration);
}

export interface AbstractNegatedToken extends AstNode {
    terminal: TerminalTokenElement
}

export const AbstractNegatedToken = 'AbstractNegatedToken';

export function isAbstractNegatedToken(item: any): item is AbstractNegatedToken {
    return reflection.isInstance(item, AbstractNegatedToken);
}

export interface AbstractRule extends AstNode {
    name: string
    type: string
}

export const AbstractRule = 'AbstractRule';

export function isAbstractRule(item: any): item is AbstractRule {
    return reflection.isInstance(item, AbstractRule);
}

export interface Annotation extends AstNode {
    name: string
}

export const Annotation = 'Annotation';

export function isAnnotation(item: any): item is Annotation {
    return reflection.isInstance(item, Annotation);
}

export interface Condition extends AstNode {
}

export const Condition = 'Condition';

export function isCondition(item: any): item is Condition {
    return reflection.isInstance(item, Condition);
}

export interface EnumLiteralDeclaration extends AstNode {
    enumLiteral: string
    literal: Keyword
}

export const EnumLiteralDeclaration = 'EnumLiteralDeclaration';

export function isEnumLiteralDeclaration(item: any): item is EnumLiteralDeclaration {
    return reflection.isInstance(item, EnumLiteralDeclaration);
}

export interface EnumLiterals extends AstNode {
    elements: Array<EnumLiteralDeclaration>
}

export const EnumLiterals = 'EnumLiterals';

export function isEnumLiterals(item: any): item is EnumLiterals {
    return reflection.isInstance(item, EnumLiterals);
}

export interface Grammar extends AstNode {
    name: string
    usedGrammars: Array<Reference<Grammar>>
    definesHiddenTokens: boolean
    hiddenTokens: Array<Reference<AbstractRule>>
    metamodelDeclarations: Array<AbstractMetamodelDeclaration>
    rules: Array<AbstractRule>
}

export const Grammar = 'Grammar';

export function isGrammar(item: any): item is Grammar {
    return reflection.isInstance(item, Grammar);
}

export interface NamedArgument extends AstNode {
    parameter?: Reference<Parameter>
    calledByName: boolean
    value: Condition
}

export const NamedArgument = 'NamedArgument';

export function isNamedArgument(item: any): item is NamedArgument {
    return reflection.isInstance(item, NamedArgument);
}

export interface Parameter extends AstNode {
    name: string
}

export const Parameter = 'Parameter';

export function isParameter(item: any): item is Parameter {
    return reflection.isInstance(item, Parameter);
}

export interface TerminalGroup extends AstNode {
    elements: Array<TerminalToken>
}

export const TerminalGroup = 'TerminalGroup';

export function isTerminalGroup(item: any): item is TerminalGroup {
    return reflection.isInstance(item, TerminalGroup);
}

export interface TerminalToken extends AstNode {
    cardinality: '?' | '*' | '+'
}

export const TerminalToken = 'TerminalToken';

export function isTerminalToken(item: any): item is TerminalToken {
    return reflection.isInstance(item, TerminalToken);
}

export interface TerminalTokenElement extends AstNode {
}

export const TerminalTokenElement = 'TerminalTokenElement';

export function isTerminalTokenElement(item: any): item is TerminalTokenElement {
    return reflection.isInstance(item, TerminalTokenElement);
}

export interface Action extends AbstractElement {
    type: string
    feature: string
    operator: '=' | '+='
}

export const Action = 'Action';

export function isAction(item: any): item is Action {
    return reflection.isInstance(item, Action);
}

export interface Alternatives extends AbstractElement {
    elements: Array<AbstractElement>
}

export const Alternatives = 'Alternatives';

export function isAlternatives(item: any): item is Alternatives {
    return reflection.isInstance(item, Alternatives);
}

export interface Assignment extends AbstractElement {
    predicated: boolean
    firstSetPredicated: boolean
    feature: string
    operator: '+=' | '=' | '?='
    terminal: AbstractElement
}

export const Assignment = 'Assignment';

export function isAssignment(item: any): item is Assignment {
    return reflection.isInstance(item, Assignment);
}

export interface CrossReference extends AbstractElement {
    type: Reference<ParserRule>
    terminal: AbstractElement
}

export const CrossReference = 'CrossReference';

export function isCrossReference(item: any): item is CrossReference {
    return reflection.isInstance(item, CrossReference);
}

export interface Group extends AbstractElement {
    elements: Array<AbstractElement>
    predicated: boolean
    firstSetPredicated: boolean
}

export const Group = 'Group';

export function isGroup(item: any): item is Group {
    return reflection.isInstance(item, Group);
}

export interface Keyword extends AbstractElement {
    value: string
    predicated: boolean
    firstSetPredicated: boolean
}

export const Keyword = 'Keyword';

export function isKeyword(item: any): item is Keyword {
    return reflection.isInstance(item, Keyword);
}

export interface RuleCall extends AbstractElement {
    rule: Reference<AbstractRule>
    arguments: Array<NamedArgument>
    predicated: boolean
    firstSetPredicated: boolean
}

export const RuleCall = 'RuleCall';

export function isRuleCall(item: any): item is RuleCall {
    return reflection.isInstance(item, RuleCall);
}

export interface UnorderedGroup extends AbstractElement {
    elements: Array<AbstractElement>
}

export const UnorderedGroup = 'UnorderedGroup';

export function isUnorderedGroup(item: any): item is UnorderedGroup {
    return reflection.isInstance(item, UnorderedGroup);
}

export interface GeneratedMetamodel extends AbstractMetamodelDeclaration {
    name: string
}

export const GeneratedMetamodel = 'GeneratedMetamodel';

export function isGeneratedMetamodel(item: any): item is GeneratedMetamodel {
    return reflection.isInstance(item, GeneratedMetamodel);
}

export interface ReferencedMetamodel extends AbstractMetamodelDeclaration {
}

export const ReferencedMetamodel = 'ReferencedMetamodel';

export function isReferencedMetamodel(item: any): item is ReferencedMetamodel {
    return reflection.isInstance(item, ReferencedMetamodel);
}

export interface NegatedToken extends AbstractNegatedToken {
}

export const NegatedToken = 'NegatedToken';

export function isNegatedToken(item: any): item is NegatedToken {
    return reflection.isInstance(item, NegatedToken);
}

export interface UntilToken extends AbstractNegatedToken {
}

export const UntilToken = 'UntilToken';

export function isUntilToken(item: any): item is UntilToken {
    return reflection.isInstance(item, UntilToken);
}

export interface EnumRule extends AbstractRule {
    alternatives: EnumLiterals
}

export const EnumRule = 'EnumRule';

export function isEnumRule(item: any): item is EnumRule {
    return reflection.isInstance(item, EnumRule);
}

export interface ParserRule extends AbstractRule {
    fragment: boolean
    parameters: Array<Parameter>
    wildcard: boolean
    definesHiddenTokens: boolean
    hiddenTokens: Array<Reference<AbstractRule>>
    alternatives: AbstractElement
}

export const ParserRule = 'ParserRule';

export function isParserRule(item: any): item is ParserRule {
    return reflection.isInstance(item, ParserRule);
}

export interface TerminalRule extends AbstractRule {
    fragment: boolean
    regex: string
}

export const TerminalRule = 'TerminalRule';

export function isTerminalRule(item: any): item is TerminalRule {
    return reflection.isInstance(item, TerminalRule);
}

export interface Conjunction extends Condition {
    left: Condition
    right: Condition
}

export const Conjunction = 'Conjunction';

export function isConjunction(item: any): item is Conjunction {
    return reflection.isInstance(item, Conjunction);
}

export interface Disjunction extends Condition {
    left: Condition
    right: Condition
}

export const Disjunction = 'Disjunction';

export function isDisjunction(item: any): item is Disjunction {
    return reflection.isInstance(item, Disjunction);
}

export interface LiteralCondition extends Condition {
    true: boolean
}

export const LiteralCondition = 'LiteralCondition';

export function isLiteralCondition(item: any): item is LiteralCondition {
    return reflection.isInstance(item, LiteralCondition);
}

export interface Negation extends Condition {
    value: Condition
}

export const Negation = 'Negation';

export function isNegation(item: any): item is Negation {
    return reflection.isInstance(item, Negation);
}

export interface ParameterReference extends Condition {
    parameter: Reference<Parameter>
}

export const ParameterReference = 'ParameterReference';

export function isParameterReference(item: any): item is ParameterReference {
    return reflection.isInstance(item, ParameterReference);
}

export interface CharacterRange extends TerminalTokenElement {
    left: Keyword
    right: Keyword
}

export const CharacterRange = 'CharacterRange';

export function isCharacterRange(item: any): item is CharacterRange {
    return reflection.isInstance(item, CharacterRange);
}

export interface TerminalAlternatives extends TerminalTokenElement {
    elements: Array<TerminalGroup>
}

export const TerminalAlternatives = 'TerminalAlternatives';

export function isTerminalAlternatives(item: any): item is TerminalAlternatives {
    return reflection.isInstance(item, TerminalAlternatives);
}

export interface TerminalRuleCall extends TerminalTokenElement {
    rule: Reference<AbstractRule>
}

export const TerminalRuleCall = 'TerminalRuleCall';

export function isTerminalRuleCall(item: any): item is TerminalRuleCall {
    return reflection.isInstance(item, TerminalRuleCall);
}

export interface Wildcard extends TerminalTokenElement {
}

export const Wildcard = 'Wildcard';

export function isWildcard(item: any): item is Wildcard {
    return reflection.isInstance(item, Wildcard);
}

export type LangiumGrammarAstType = 'AbstractElement' | 'AbstractMetamodelDeclaration' | 'AbstractNegatedToken' | 'AbstractRule' | 'Annotation' | 'Condition' | 'EnumLiteralDeclaration' | 'EnumLiterals' | 'Grammar' | 'NamedArgument' | 'Parameter' | 'TerminalGroup' | 'TerminalToken' | 'TerminalTokenElement' | 'Action' | 'Alternatives' | 'Assignment' | 'CrossReference' | 'Group' | 'Keyword' | 'RuleCall' | 'UnorderedGroup' | 'GeneratedMetamodel' | 'ReferencedMetamodel' | 'NegatedToken' | 'UntilToken' | 'EnumRule' | 'ParserRule' | 'TerminalRule' | 'Conjunction' | 'Disjunction' | 'LiteralCondition' | 'Negation' | 'ParameterReference' | 'CharacterRange' | 'TerminalAlternatives' | 'TerminalRuleCall' | 'Wildcard';

export type LangiumGrammarAstReference = 'Grammar:usedGrammars' | 'Grammar:hiddenTokens' | 'NamedArgument:parameter' | 'CrossReference:type' | 'RuleCall:rule' | 'ParserRule:hiddenTokens' | 'ParameterReference:parameter' | 'TerminalRuleCall:rule';

export class LangiumGrammarAstReflection implements AstReflection {

    getAllTypes(): string[] {
        return ['AbstractElement', 'AbstractMetamodelDeclaration', 'AbstractNegatedToken', 'AbstractRule', 'Annotation', 'Condition', 'EnumLiteralDeclaration', 'EnumLiterals', 'Grammar', 'NamedArgument', 'Parameter', 'TerminalGroup', 'TerminalToken', 'TerminalTokenElement', 'Action', 'Alternatives', 'Assignment', 'CrossReference', 'Group', 'Keyword', 'RuleCall', 'UnorderedGroup', 'GeneratedMetamodel', 'ReferencedMetamodel', 'NegatedToken', 'UntilToken', 'EnumRule', 'ParserRule', 'TerminalRule', 'Conjunction', 'Disjunction', 'LiteralCondition', 'Negation', 'ParameterReference', 'CharacterRange', 'TerminalAlternatives', 'TerminalRuleCall', 'Wildcard'];
    }

    isInstance(node: AstNode, type: string): boolean {
        return this.isSubtype(node.$type, type);
    }

    isSubtype(subtype: string, supertype: string): boolean {
        if (subtype === supertype) {
            return true;
        }
        switch (subtype) {
            case Action:
            case Alternatives:
            case Assignment:
            case CrossReference:
            case Group:
            case Keyword:
            case RuleCall:
            case UnorderedGroup: {
                return this.isSubtype(AbstractElement, supertype);
            }
            case GeneratedMetamodel:
            case ReferencedMetamodel: {
                return this.isSubtype(AbstractMetamodelDeclaration, supertype);
            }
            case NegatedToken:
            case UntilToken: {
                return this.isSubtype(AbstractNegatedToken, supertype);
            }
            case EnumRule:
            case ParserRule:
            case TerminalRule: {
                return this.isSubtype(AbstractRule, supertype);
            }
            case Conjunction:
            case Disjunction:
            case LiteralCondition:
            case Negation:
            case ParameterReference: {
                return this.isSubtype(Condition, supertype);
            }
            case CharacterRange:
            case TerminalAlternatives:
            case TerminalRuleCall:
            case Wildcard: {
                return this.isSubtype(TerminalTokenElement, supertype);
            }
            default: {
                return false;
            }
        }
    }

    getReferenceType(referenceId: LangiumGrammarAstReference): string {
        switch (referenceId) {
            case 'Grammar:usedGrammars': {
                return Grammar;
            }
            case 'Grammar:hiddenTokens': {
                return AbstractRule;
            }
            case 'NamedArgument:parameter': {
                return Parameter;
            }
            case 'CrossReference:type': {
                return ParserRule;
            }
            case 'RuleCall:rule': {
                return AbstractRule;
            }
            case 'ParserRule:hiddenTokens': {
                return AbstractRule;
            }
            case 'ParameterReference:parameter': {
                return Parameter;
            }
            case 'TerminalRuleCall:rule': {
                return AbstractRule;
            }
            default: {
                throw new Error(`${referenceId} is not a valid reference id.`);
            }
        }
    }
}

export const reflection = new LangiumGrammarAstReflection();
