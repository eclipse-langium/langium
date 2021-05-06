/* eslint-disable @typescript-eslint/array-type */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-empty-interface */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { AstNode, Type, Reference } from '../index';

export interface AbstractElement extends AstNode {
    cardinality: '?' | '*' | '+'
}

export namespace AbstractElement {
    export const type: Type = { value: 'AbstractElement', super: [ AstNode.type ] };
    export function is(item: any): item is AbstractElement {
        return AstNode.is(item, type);
    }
}

export interface AbstractMetamodelDeclaration extends AstNode {
    ePackage: string
    alias: string
}

export namespace AbstractMetamodelDeclaration {
    export const type: Type = { value: 'AbstractMetamodelDeclaration', super: [ AstNode.type ] };
    export function is(item: any): item is AbstractMetamodelDeclaration {
        return AstNode.is(item, type);
    }
}

export interface AbstractNegatedToken extends AstNode {
    terminal: TerminalTokenElement
}

export namespace AbstractNegatedToken {
    export const type: Type = { value: 'AbstractNegatedToken', super: [ AstNode.type ] };
    export function is(item: any): item is AbstractNegatedToken {
        return AstNode.is(item, type);
    }
}

export interface AbstractRule extends AstNode {
    name: string
    type: string
}

export namespace AbstractRule {
    export const type: Type = { value: 'AbstractRule', super: [ AstNode.type ] };
    export function is(item: any): item is AbstractRule {
        return AstNode.is(item, type);
    }
}

export interface Annotation extends AstNode {
    name: string
}

export namespace Annotation {
    export const type: Type = { value: 'Annotation', super: [ AstNode.type ] };
    export function is(item: any): item is Annotation {
        return AstNode.is(item, type);
    }
}

export interface Condition extends AstNode {
}

export namespace Condition {
    export const type: Type = { value: 'Condition', super: [ AstNode.type ] };
    export function is(item: any): item is Condition {
        return AstNode.is(item, type);
    }
}

export interface EnumLiteralDeclaration extends AstNode {
    enumLiteral: string
    literal: Keyword
}

export namespace EnumLiteralDeclaration {
    export const type: Type = { value: 'EnumLiteralDeclaration', super: [ AstNode.type ] };
    export function is(item: any): item is EnumLiteralDeclaration {
        return AstNode.is(item, type);
    }
}

export interface EnumLiterals extends AstNode {
    elements: Array<EnumLiteralDeclaration>
}

export namespace EnumLiterals {
    export const type: Type = { value: 'EnumLiterals', super: [ AstNode.type ] };
    export function is(item: any): item is EnumLiterals {
        return AstNode.is(item, type);
    }
}

export interface Grammar extends AstNode {
    name: string
    usedGrammars: Array<Reference<Grammar>>
    definesHiddenTokens: boolean
    hiddenTokens: Array<Reference<AbstractRule>>
    metamodelDeclarations: Array<AbstractMetamodelDeclaration>
    rules: Array<AbstractRule>
}

export namespace Grammar {
    export const type: Type = { value: 'Grammar', super: [ AstNode.type ] };
    export function is(item: any): item is Grammar {
        return AstNode.is(item, type);
    }
}

export interface NamedArgument extends AstNode {
    parameter?: Reference<Parameter>
    calledByName: boolean
    value: Condition
}

export namespace NamedArgument {
    export const type: Type = { value: 'NamedArgument', super: [ AstNode.type ] };
    export function is(item: any): item is NamedArgument {
        return AstNode.is(item, type);
    }
}

export interface Parameter extends AstNode {
    name: string
}

export namespace Parameter {
    export const type: Type = { value: 'Parameter', super: [ AstNode.type ] };
    export function is(item: any): item is Parameter {
        return AstNode.is(item, type);
    }
}

export interface ParenthesizedTerminalElement extends AstNode {
    elements: Array<TerminalGroup>
}

export namespace ParenthesizedTerminalElement {
    export const type: Type = { value: 'ParenthesizedTerminalElement', super: [ AstNode.type ] };
    export function is(item: any): item is ParenthesizedTerminalElement {
        return AstNode.is(item, type);
    }
}

export interface TerminalGroup extends AstNode {
    elements: Array<TerminalToken>
}

export namespace TerminalGroup {
    export const type: Type = { value: 'TerminalGroup', super: [ AstNode.type ] };
    export function is(item: any): item is TerminalGroup {
        return AstNode.is(item, type);
    }
}

export interface TerminalToken extends AstNode {
    cardinality: '?' | '*' | '+'
}

export namespace TerminalToken {
    export const type: Type = { value: 'TerminalToken', super: [ AstNode.type ] };
    export function is(item: any): item is TerminalToken {
        return AstNode.is(item, type);
    }
}

export interface TerminalTokenElement extends AstNode {
}

export namespace TerminalTokenElement {
    export const type: Type = { value: 'TerminalTokenElement', super: [ AstNode.type ] };
    export function is(item: any): item is TerminalTokenElement {
        return AstNode.is(item, type);
    }
}

export interface Action extends AbstractElement {
    type: string
    feature: string
    operator: '=' | '+='
}

export namespace Action {
    export const type: Type = { value: 'Action', super: [ AbstractElement.type ] };
    export function is(item: any): item is Action {
        return AstNode.is(item, type);
    }
}

export interface Alternatives extends AbstractElement {
    elements: Array<AbstractElement>
}

export namespace Alternatives {
    export const type: Type = { value: 'Alternatives', super: [ AbstractElement.type ] };
    export function is(item: any): item is Alternatives {
        return AstNode.is(item, type);
    }
}

export interface Assignment extends AbstractElement {
    predicated: boolean
    firstSetPredicated: boolean
    feature: string
    operator: '+=' | '=' | '?='
    terminal: AbstractElement
}

export namespace Assignment {
    export const type: Type = { value: 'Assignment', super: [ AbstractElement.type ] };
    export function is(item: any): item is Assignment {
        return AstNode.is(item, type);
    }
}

export interface CrossReference extends AbstractElement {
    type: Reference<ParserRule>
    terminal: AbstractElement
}

export namespace CrossReference {
    export const type: Type = { value: 'CrossReference', super: [ AbstractElement.type ] };
    export function is(item: any): item is CrossReference {
        return AstNode.is(item, type);
    }
}

export interface Group extends AbstractElement, AbstractElement {
    elements: Array<AbstractElement>
    predicated: boolean
    firstSetPredicated: boolean
}

export namespace Group {
    export const type: Type = { value: 'Group', super: [ AbstractElement.type, AbstractElement.type ] };
    export function is(item: any): item is Group {
        return AstNode.is(item, type);
    }
}

export interface Keyword extends AbstractElement {
    value: string
    predicated: boolean
    firstSetPredicated: boolean
}

export namespace Keyword {
    export const type: Type = { value: 'Keyword', super: [ AbstractElement.type ] };
    export function is(item: any): item is Keyword {
        return AstNode.is(item, type);
    }
}

export interface RuleCall extends AbstractElement {
    rule: Reference<AbstractRule>
    arguments: Array<NamedArgument>
    predicated: boolean
    firstSetPredicated: boolean
}

export namespace RuleCall {
    export const type: Type = { value: 'RuleCall', super: [ AbstractElement.type ] };
    export function is(item: any): item is RuleCall {
        return AstNode.is(item, type);
    }
}

export interface UnorderedGroup extends AbstractElement {
    elements: Array<AbstractElement>
}

export namespace UnorderedGroup {
    export const type: Type = { value: 'UnorderedGroup', super: [ AbstractElement.type ] };
    export function is(item: any): item is UnorderedGroup {
        return AstNode.is(item, type);
    }
}

export interface GeneratedMetamodel extends AbstractMetamodelDeclaration {
    name: string
}

export namespace GeneratedMetamodel {
    export const type: Type = { value: 'GeneratedMetamodel', super: [ AbstractMetamodelDeclaration.type ] };
    export function is(item: any): item is GeneratedMetamodel {
        return AstNode.is(item, type);
    }
}

export interface ReferencedMetamodel extends AbstractMetamodelDeclaration {
}

export namespace ReferencedMetamodel {
    export const type: Type = { value: 'ReferencedMetamodel', super: [ AbstractMetamodelDeclaration.type ] };
    export function is(item: any): item is ReferencedMetamodel {
        return AstNode.is(item, type);
    }
}

export interface NegatedToken extends AbstractNegatedToken {
}

export namespace NegatedToken {
    export const type: Type = { value: 'NegatedToken', super: [ AbstractNegatedToken.type ] };
    export function is(item: any): item is NegatedToken {
        return AstNode.is(item, type);
    }
}

export interface UntilToken extends AbstractNegatedToken {
}

export namespace UntilToken {
    export const type: Type = { value: 'UntilToken', super: [ AbstractNegatedToken.type ] };
    export function is(item: any): item is UntilToken {
        return AstNode.is(item, type);
    }
}

export interface EnumRule extends AbstractRule {
    alternatives: EnumLiterals
}

export namespace EnumRule {
    export const type: Type = { value: 'EnumRule', super: [ AbstractRule.type ] };
    export function is(item: any): item is EnumRule {
        return AstNode.is(item, type);
    }
}

export interface ParserRule extends AbstractRule {
    fragment: boolean
    parameters: Array<Parameter>
    wildcard: boolean
    definesHiddenTokens: boolean
    hiddenTokens: Array<Reference<AbstractRule>>
    alternatives: AbstractElement
}

export namespace ParserRule {
    export const type: Type = { value: 'ParserRule', super: [ AbstractRule.type ] };
    export function is(item: any): item is ParserRule {
        return AstNode.is(item, type);
    }
}

export interface TerminalRule extends AbstractRule {
    fragment: boolean
    regex: string
}

export namespace TerminalRule {
    export const type: Type = { value: 'TerminalRule', super: [ AbstractRule.type ] };
    export function is(item: any): item is TerminalRule {
        return AstNode.is(item, type);
    }
}

export interface Conjunction extends Condition {
    left: Condition
    right: Condition
}

export namespace Conjunction {
    export const type: Type = { value: 'Conjunction', super: [ Condition.type ] };
    export function is(item: any): item is Conjunction {
        return AstNode.is(item, type);
    }
}

export interface Disjunction extends Condition {
    left: Condition
    right: Condition
}

export namespace Disjunction {
    export const type: Type = { value: 'Disjunction', super: [ Condition.type ] };
    export function is(item: any): item is Disjunction {
        return AstNode.is(item, type);
    }
}

export interface LiteralCondition extends Condition {
    true: boolean
}

export namespace LiteralCondition {
    export const type: Type = { value: 'LiteralCondition', super: [ Condition.type ] };
    export function is(item: any): item is LiteralCondition {
        return AstNode.is(item, type);
    }
}

export interface Negation extends Condition {
    value: Condition
}

export namespace Negation {
    export const type: Type = { value: 'Negation', super: [ Condition.type ] };
    export function is(item: any): item is Negation {
        return AstNode.is(item, type);
    }
}

export interface ParameterReference extends Condition {
    parameter: Reference<Parameter>
}

export namespace ParameterReference {
    export const type: Type = { value: 'ParameterReference', super: [ Condition.type ] };
    export function is(item: any): item is ParameterReference {
        return AstNode.is(item, type);
    }
}

export interface TerminalAlternatives extends ParenthesizedTerminalElement {
}

export namespace TerminalAlternatives {
    export const type: Type = { value: 'TerminalAlternatives', super: [ ParenthesizedTerminalElement.type ] };
    export function is(item: any): item is TerminalAlternatives {
        return AstNode.is(item, type);
    }
}

export interface CharacterRange extends TerminalTokenElement {
    left: Keyword
    right: Keyword
}

export namespace CharacterRange {
    export const type: Type = { value: 'CharacterRange', super: [ TerminalTokenElement.type ] };
    export function is(item: any): item is CharacterRange {
        return AstNode.is(item, type);
    }
}

export interface TerminalRuleCall extends TerminalTokenElement {
    rule: Reference<AbstractRule>
}

export namespace TerminalRuleCall {
    export const type: Type = { value: 'TerminalRuleCall', super: [ TerminalTokenElement.type ] };
    export function is(item: any): item is TerminalRuleCall {
        return AstNode.is(item, type);
    }
}

export interface Wildcard extends TerminalTokenElement {
}

export namespace Wildcard {
    export const type: Type = { value: 'Wildcard', super: [ TerminalTokenElement.type ] };
    export function is(item: any): item is Wildcard {
        return AstNode.is(item, type);
    }
}

