/* eslint-disable @typescript-eslint/array-type */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-empty-interface */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { AstNode, Type, Reference } from '../index';

export interface AbstractElement extends AstNode {
    cardinality: '?' | '*' | '+'
}

export function isAbstractElement(item: any): item is AbstractElement {
    return reflectionInstance.isInstance(item, 'AbstractElement');
}

export namespace AbstractElement{
    export const type: Type = { value: 'AbstractElement', super: [ AstNode.type ] };
}

export interface AbstractMetamodelDeclaration extends AstNode {
    ePackage: string
    alias: string
}

export function isAbstractMetamodelDeclaration(item: any): item is AbstractMetamodelDeclaration {
    return reflectionInstance.isInstance(item, 'AbstractMetamodelDeclaration');
}

export namespace AbstractMetamodelDeclaration{
    export const type: Type = { value: 'AbstractMetamodelDeclaration', super: [ AstNode.type ] };
}

export interface AbstractNegatedToken extends AstNode {
    terminal: TerminalTokenElement
}

export function isAbstractNegatedToken(item: any): item is AbstractNegatedToken {
    return reflectionInstance.isInstance(item, 'AbstractNegatedToken');
}

export namespace AbstractNegatedToken{
    export const type: Type = { value: 'AbstractNegatedToken', super: [ AstNode.type ] };
}

export interface AbstractRule extends AstNode {
    name: string
    type: string
}

export function isAbstractRule(item: any): item is AbstractRule {
    return reflectionInstance.isInstance(item, 'AbstractRule');
}

export namespace AbstractRule{
    export const type: Type = { value: 'AbstractRule', super: [ AstNode.type ] };
}

export interface Annotation extends AstNode {
    name: string
}

export function isAnnotation(item: any): item is Annotation {
    return reflectionInstance.isInstance(item, 'Annotation');
}

export namespace Annotation{
    export const type: Type = { value: 'Annotation', super: [ AstNode.type ] };
}

export interface Condition extends AstNode {
}

export function isCondition(item: any): item is Condition {
    return reflectionInstance.isInstance(item, 'Condition');
}

export namespace Condition{
    export const type: Type = { value: 'Condition', super: [ AstNode.type ] };
}

export interface EnumLiteralDeclaration extends AstNode {
    enumLiteral: string
    literal: Keyword
}

export function isEnumLiteralDeclaration(item: any): item is EnumLiteralDeclaration {
    return reflectionInstance.isInstance(item, 'EnumLiteralDeclaration');
}

export namespace EnumLiteralDeclaration{
    export const type: Type = { value: 'EnumLiteralDeclaration', super: [ AstNode.type ] };
}

export interface EnumLiterals extends AstNode {
    elements: Array<EnumLiteralDeclaration>
}

export function isEnumLiterals(item: any): item is EnumLiterals {
    return reflectionInstance.isInstance(item, 'EnumLiterals');
}

export namespace EnumLiterals{
    export const type: Type = { value: 'EnumLiterals', super: [ AstNode.type ] };
}

export interface Grammar extends AstNode {
    name: string
    usedGrammars: Array<Reference<Grammar>>
    definesHiddenTokens: boolean
    hiddenTokens: Array<Reference<AbstractRule>>
    metamodelDeclarations: Array<AbstractMetamodelDeclaration>
    rules: Array<AbstractRule>
}

export function isGrammar(item: any): item is Grammar {
    return reflectionInstance.isInstance(item, 'Grammar');
}

export namespace Grammar{
    export const type: Type = { value: 'Grammar', super: [ AstNode.type ] };
}

export interface NamedArgument extends AstNode {
    parameter?: Reference<Parameter>
    calledByName: boolean
    value: Condition
}

export function isNamedArgument(item: any): item is NamedArgument {
    return reflectionInstance.isInstance(item, 'NamedArgument');
}

export namespace NamedArgument{
    export const type: Type = { value: 'NamedArgument', super: [ AstNode.type ] };
}

export interface Parameter extends AstNode {
    name: string
}

export function isParameter(item: any): item is Parameter {
    return reflectionInstance.isInstance(item, 'Parameter');
}

export namespace Parameter{
    export const type: Type = { value: 'Parameter', super: [ AstNode.type ] };
}

export interface TerminalGroup extends AstNode {
    elements: Array<TerminalToken>
}

export function isTerminalGroup(item: any): item is TerminalGroup {
    return reflectionInstance.isInstance(item, 'TerminalGroup');
}

export namespace TerminalGroup{
    export const type: Type = { value: 'TerminalGroup', super: [ AstNode.type ] };
}

export interface TerminalToken extends AstNode {
    cardinality: '?' | '*' | '+'
}

export function isTerminalToken(item: any): item is TerminalToken {
    return reflectionInstance.isInstance(item, 'TerminalToken');
}

export namespace TerminalToken{
    export const type: Type = { value: 'TerminalToken', super: [ AstNode.type ] };
}

export interface TerminalTokenElement extends AstNode {
}

export function isTerminalTokenElement(item: any): item is TerminalTokenElement {
    return reflectionInstance.isInstance(item, 'TerminalTokenElement');
}

export namespace TerminalTokenElement{
    export const type: Type = { value: 'TerminalTokenElement', super: [ AstNode.type ] };
}

export interface Action extends AbstractElement {
    type: string
    feature: string
    operator: '=' | '+='
}

export function isAction(item: any): item is Action {
    return reflectionInstance.isInstance(item, 'Action');
}

export namespace Action{
    export const type: Type = { value: 'Action', super: [ AbstractElement.type ] };
}

export interface Alternatives extends AbstractElement {
    elements: Array<AbstractElement>
}

export function isAlternatives(item: any): item is Alternatives {
    return reflectionInstance.isInstance(item, 'Alternatives');
}

export namespace Alternatives{
    export const type: Type = { value: 'Alternatives', super: [ AbstractElement.type ] };
}

export interface Assignment extends AbstractElement {
    predicated: boolean
    firstSetPredicated: boolean
    feature: string
    operator: '+=' | '=' | '?='
    terminal: AbstractElement
}

export function isAssignment(item: any): item is Assignment {
    return reflectionInstance.isInstance(item, 'Assignment');
}

export namespace Assignment{
    export const type: Type = { value: 'Assignment', super: [ AbstractElement.type ] };
}

export interface CrossReference extends AbstractElement {
    type: Reference<ParserRule>
    terminal: AbstractElement
}

export function isCrossReference(item: any): item is CrossReference {
    return reflectionInstance.isInstance(item, 'CrossReference');
}

export namespace CrossReference{
    export const type: Type = { value: 'CrossReference', super: [ AbstractElement.type ] };
}

export interface Group extends AbstractElement {
    elements: Array<AbstractElement>
    predicated: boolean
    firstSetPredicated: boolean
}

export function isGroup(item: any): item is Group {
    return reflectionInstance.isInstance(item, 'Group');
}

export namespace Group{
    export const type: Type = { value: 'Group', super: [ AbstractElement.type ] };
}

export interface Keyword extends AbstractElement {
    value: string
    predicated: boolean
    firstSetPredicated: boolean
}

export function isKeyword(item: any): item is Keyword {
    return reflectionInstance.isInstance(item, 'Keyword');
}

export namespace Keyword{
    export const type: Type = { value: 'Keyword', super: [ AbstractElement.type ] };
}

export interface RuleCall extends AbstractElement {
    rule: Reference<AbstractRule>
    arguments: Array<NamedArgument>
    predicated: boolean
    firstSetPredicated: boolean
}

export function isRuleCall(item: any): item is RuleCall {
    return reflectionInstance.isInstance(item, 'RuleCall');
}

export namespace RuleCall{
    export const type: Type = { value: 'RuleCall', super: [ AbstractElement.type ] };
}

export interface UnorderedGroup extends AbstractElement {
    elements: Array<AbstractElement>
}

export function isUnorderedGroup(item: any): item is UnorderedGroup {
    return reflectionInstance.isInstance(item, 'UnorderedGroup');
}

export namespace UnorderedGroup{
    export const type: Type = { value: 'UnorderedGroup', super: [ AbstractElement.type ] };
}

export interface GeneratedMetamodel extends AbstractMetamodelDeclaration {
    name: string
}

export function isGeneratedMetamodel(item: any): item is GeneratedMetamodel {
    return reflectionInstance.isInstance(item, 'GeneratedMetamodel');
}

export namespace GeneratedMetamodel{
    export const type: Type = { value: 'GeneratedMetamodel', super: [ AbstractMetamodelDeclaration.type ] };
}

export interface ReferencedMetamodel extends AbstractMetamodelDeclaration {
}

export function isReferencedMetamodel(item: any): item is ReferencedMetamodel {
    return reflectionInstance.isInstance(item, 'ReferencedMetamodel');
}

export namespace ReferencedMetamodel{
    export const type: Type = { value: 'ReferencedMetamodel', super: [ AbstractMetamodelDeclaration.type ] };
}

export interface NegatedToken extends AbstractNegatedToken {
}

export function isNegatedToken(item: any): item is NegatedToken {
    return reflectionInstance.isInstance(item, 'NegatedToken');
}

export namespace NegatedToken{
    export const type: Type = { value: 'NegatedToken', super: [ AbstractNegatedToken.type ] };
}

export interface UntilToken extends AbstractNegatedToken {
}

export function isUntilToken(item: any): item is UntilToken {
    return reflectionInstance.isInstance(item, 'UntilToken');
}

export namespace UntilToken{
    export const type: Type = { value: 'UntilToken', super: [ AbstractNegatedToken.type ] };
}

export interface EnumRule extends AbstractRule {
    alternatives: EnumLiterals
}

export function isEnumRule(item: any): item is EnumRule {
    return reflectionInstance.isInstance(item, 'EnumRule');
}

export namespace EnumRule{
    export const type: Type = { value: 'EnumRule', super: [ AbstractRule.type ] };
}

export interface ParserRule extends AbstractRule {
    fragment: boolean
    parameters: Array<Parameter>
    wildcard: boolean
    definesHiddenTokens: boolean
    hiddenTokens: Array<Reference<AbstractRule>>
    alternatives: AbstractElement
}

export function isParserRule(item: any): item is ParserRule {
    return reflectionInstance.isInstance(item, 'ParserRule');
}

export namespace ParserRule{
    export const type: Type = { value: 'ParserRule', super: [ AbstractRule.type ] };
}

export interface TerminalRule extends AbstractRule {
    fragment: boolean
    regex: string
}

export function isTerminalRule(item: any): item is TerminalRule {
    return reflectionInstance.isInstance(item, 'TerminalRule');
}

export namespace TerminalRule{
    export const type: Type = { value: 'TerminalRule', super: [ AbstractRule.type ] };
}

export interface Conjunction extends Condition {
    left: Condition
    right: Condition
}

export function isConjunction(item: any): item is Conjunction {
    return reflectionInstance.isInstance(item, 'Conjunction');
}

export namespace Conjunction{
    export const type: Type = { value: 'Conjunction', super: [ Condition.type ] };
}

export interface Disjunction extends Condition {
    left: Condition
    right: Condition
}

export function isDisjunction(item: any): item is Disjunction {
    return reflectionInstance.isInstance(item, 'Disjunction');
}

export namespace Disjunction{
    export const type: Type = { value: 'Disjunction', super: [ Condition.type ] };
}

export interface LiteralCondition extends Condition {
    true: boolean
}

export function isLiteralCondition(item: any): item is LiteralCondition {
    return reflectionInstance.isInstance(item, 'LiteralCondition');
}

export namespace LiteralCondition{
    export const type: Type = { value: 'LiteralCondition', super: [ Condition.type ] };
}

export interface Negation extends Condition {
    value: Condition
}

export function isNegation(item: any): item is Negation {
    return reflectionInstance.isInstance(item, 'Negation');
}

export namespace Negation{
    export const type: Type = { value: 'Negation', super: [ Condition.type ] };
}

export interface ParameterReference extends Condition {
    parameter: Reference<Parameter>
}

export function isParameterReference(item: any): item is ParameterReference {
    return reflectionInstance.isInstance(item, 'ParameterReference');
}

export namespace ParameterReference{
    export const type: Type = { value: 'ParameterReference', super: [ Condition.type ] };
}

export interface CharacterRange extends TerminalTokenElement {
    left: Keyword
    right: Keyword
}

export function isCharacterRange(item: any): item is CharacterRange {
    return reflectionInstance.isInstance(item, 'CharacterRange');
}

export namespace CharacterRange{
    export const type: Type = { value: 'CharacterRange', super: [ TerminalTokenElement.type ] };
}

export interface TerminalAlternatives extends TerminalTokenElement {
    elements: Array<TerminalGroup>
}

export function isTerminalAlternatives(item: any): item is TerminalAlternatives {
    return reflectionInstance.isInstance(item, 'TerminalAlternatives');
}

export namespace TerminalAlternatives{
    export const type: Type = { value: 'TerminalAlternatives', super: [ TerminalTokenElement.type ] };
}

export interface TerminalRuleCall extends TerminalTokenElement {
    rule: Reference<AbstractRule>
}

export function isTerminalRuleCall(item: any): item is TerminalRuleCall {
    return reflectionInstance.isInstance(item, 'TerminalRuleCall');
}

export namespace TerminalRuleCall{
    export const type: Type = { value: 'TerminalRuleCall', super: [ TerminalTokenElement.type ] };
}

export interface Wildcard extends TerminalTokenElement {
}

export function isWildcard(item: any): item is Wildcard {
    return reflectionInstance.isInstance(item, 'Wildcard');
}

export namespace Wildcard{
    export const type: Type = { value: 'Wildcard', super: [ TerminalTokenElement.type ] };
}

export type AstReference = 'Grammar:usedGrammars' | 'Grammar:hiddenTokens' | 'NamedArgument:parameter' | 'CrossReference:type' | 'RuleCall:rule' | 'ParserRule:hiddenTokens' | 'ParameterReference:parameter' | 'TerminalRuleCall:rule';

export class LangiumAstReflection {

    isInstance(node: AstNode, type: string): boolean {
        return this.isSubtype(node.$type.value, type);
    }

    isSubtype(subtype: string, supertype: string): boolean {
        if (subtype === supertype) {
            return true;
        }
        switch (subtype) {
            case 'Action':
            case 'Alternatives':
            case 'Assignment':
            case 'CrossReference':
            case 'Group':
            case 'Keyword':
            case 'RuleCall':
            case 'UnorderedGroup': {
                return this.isSubtype('AbstractElement', supertype);
            }
            case 'GeneratedMetamodel':
            case 'ReferencedMetamodel': {
                return this.isSubtype('AbstractMetamodelDeclaration', supertype);
            }
            case 'NegatedToken':
            case 'UntilToken': {
                return this.isSubtype('AbstractNegatedToken', supertype);
            }
            case 'EnumRule':
            case 'ParserRule':
            case 'TerminalRule': {
                return this.isSubtype('AbstractRule', supertype);
            }
            case 'Conjunction':
            case 'Disjunction':
            case 'LiteralCondition':
            case 'Negation':
            case 'ParameterReference': {
                return this.isSubtype('Condition', supertype);
            }
            case 'CharacterRange':
            case 'TerminalAlternatives':
            case 'TerminalRuleCall':
            case 'Wildcard': {
                return this.isSubtype('TerminalTokenElement', supertype);
            }
            default: {
                return false;
            }
        }
    }

    getReferenceType(referenceId: AstReference): string {
        switch (referenceId) {
            case 'Grammar:usedGrammars': {
                return 'Grammar';
            }
            case 'Grammar:hiddenTokens': {
                return 'AbstractRule';
            }
            case 'NamedArgument:parameter': {
                return 'Parameter';
            }
            case 'CrossReference:type': {
                return 'ParserRule';
            }
            case 'RuleCall:rule': {
                return 'AbstractRule';
            }
            case 'ParserRule:hiddenTokens': {
                return 'AbstractRule';
            }
            case 'ParameterReference:parameter': {
                return 'Parameter';
            }
            case 'TerminalRuleCall:rule': {
                return 'AbstractRule';
            }
            default: {
                throw new Error(`${referenceId} is not a valid reference id.`);
            }
        }
    }
}

export const reflectionInstance = new LangiumAstReflection();
