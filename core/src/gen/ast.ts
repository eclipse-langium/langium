/* eslint-disable @typescript-eslint/array-type */
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-empty-interface */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { AstNode, Kind, Reference } from '../index';

export interface AbstractElement extends AstNode {
    cardinality: '?' | '*' | '+'
}

export namespace AbstractElement {
    export const kind: Kind = { value: 'AbstractElement', super: [ AstNode.kind ] };
    export function is(item: any): item is AbstractElement {
        return AstNode.is(item, kind);
    }
}

export interface AbstractMetamodelDeclaration extends AstNode {
    ePackage: string
    alias: string
}

export namespace AbstractMetamodelDeclaration {
    export const kind: Kind = { value: 'AbstractMetamodelDeclaration', super: [ AstNode.kind ] };
    export function is(item: any): item is AbstractMetamodelDeclaration {
        return AstNode.is(item, kind);
    }
}

export interface AbstractNegatedToken extends AstNode {
    terminal: TerminalTokenElement
}

export namespace AbstractNegatedToken {
    export const kind: Kind = { value: 'AbstractNegatedToken', super: [ AstNode.kind ] };
    export function is(item: any): item is AbstractNegatedToken {
        return AstNode.is(item, kind);
    }
}

export interface AbstractRule extends AstNode {
    name: string
    type: string
}

export namespace AbstractRule {
    export const kind: Kind = { value: 'AbstractRule', super: [ AstNode.kind ] };
    export function is(item: any): item is AbstractRule {
        return AstNode.is(item, kind);
    }
}

export interface Annotation extends AstNode {
    name: string
}

export namespace Annotation {
    export const kind: Kind = { value: 'Annotation', super: [ AstNode.kind ] };
    export function is(item: any): item is Annotation {
        return AstNode.is(item, kind);
    }
}

export interface Condition extends AstNode {
}

export namespace Condition {
    export const kind: Kind = { value: 'Condition', super: [ AstNode.kind ] };
    export function is(item: any): item is Condition {
        return AstNode.is(item, kind);
    }
}

export interface EnumLiteralDeclaration extends AstNode {
    enumLiteral: string
    literal: Keyword
}

export namespace EnumLiteralDeclaration {
    export const kind: Kind = { value: 'EnumLiteralDeclaration', super: [ AstNode.kind ] };
    export function is(item: any): item is EnumLiteralDeclaration {
        return AstNode.is(item, kind);
    }
}

export interface EnumLiterals extends AstNode {
    elements: Array<EnumLiteralDeclaration>
}

export namespace EnumLiterals {
    export const kind: Kind = { value: 'EnumLiterals', super: [ AstNode.kind ] };
    export function is(item: any): item is EnumLiterals {
        return AstNode.is(item, kind);
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
    export const kind: Kind = { value: 'Grammar', super: [ AstNode.kind ] };
    export function is(item: any): item is Grammar {
        return AstNode.is(item, kind);
    }
}

export interface NamedArgument extends AstNode {
    parameter?: Reference<Parameter>
    calledByName: boolean
    value: Condition
}

export namespace NamedArgument {
    export const kind: Kind = { value: 'NamedArgument', super: [ AstNode.kind ] };
    export function is(item: any): item is NamedArgument {
        return AstNode.is(item, kind);
    }
}

export interface Parameter extends AstNode {
    name: string
}

export namespace Parameter {
    export const kind: Kind = { value: 'Parameter', super: [ AstNode.kind ] };
    export function is(item: any): item is Parameter {
        return AstNode.is(item, kind);
    }
}

export interface ParenthesizedTerminalElement extends AstNode {
    elements: Array<TerminalGroup>
}

export namespace ParenthesizedTerminalElement {
    export const kind: Kind = { value: 'ParenthesizedTerminalElement', super: [ AstNode.kind ] };
    export function is(item: any): item is ParenthesizedTerminalElement {
        return AstNode.is(item, kind);
    }
}

export interface TerminalGroup extends AstNode {
    elements: Array<TerminalToken>
}

export namespace TerminalGroup {
    export const kind: Kind = { value: 'TerminalGroup', super: [ AstNode.kind ] };
    export function is(item: any): item is TerminalGroup {
        return AstNode.is(item, kind);
    }
}

export interface TerminalToken extends AstNode {
    cardinality: '?' | '*' | '+'
}

export namespace TerminalToken {
    export const kind: Kind = { value: 'TerminalToken', super: [ AstNode.kind ] };
    export function is(item: any): item is TerminalToken {
        return AstNode.is(item, kind);
    }
}

export interface TerminalTokenElement extends AstNode {
}

export namespace TerminalTokenElement {
    export const kind: Kind = { value: 'TerminalTokenElement', super: [ AstNode.kind ] };
    export function is(item: any): item is TerminalTokenElement {
        return AstNode.is(item, kind);
    }
}

export interface Action extends AbstractElement {
    type: string
    feature: string
    operator: '=' | '+='
}

export namespace Action {
    export const kind: Kind = { value: 'Action', super: [ AbstractElement.kind ] };
    export function is(item: any): item is Action {
        return AstNode.is(item, kind);
    }
}

export interface Alternatives extends AbstractElement {
    elements: Array<AbstractElement>
}

export namespace Alternatives {
    export const kind: Kind = { value: 'Alternatives', super: [ AbstractElement.kind ] };
    export function is(item: any): item is Alternatives {
        return AstNode.is(item, kind);
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
    export const kind: Kind = { value: 'Assignment', super: [ AbstractElement.kind ] };
    export function is(item: any): item is Assignment {
        return AstNode.is(item, kind);
    }
}

export interface CrossReference extends AbstractElement {
    type: Reference<ParserRule>
    terminal: AbstractElement
}

export namespace CrossReference {
    export const kind: Kind = { value: 'CrossReference', super: [ AbstractElement.kind ] };
    export function is(item: any): item is CrossReference {
        return AstNode.is(item, kind);
    }
}

export interface Group extends AbstractElement, AbstractElement {
    elements: Array<AbstractElement>
    predicated: boolean
    firstSetPredicated: boolean
}

export namespace Group {
    export const kind: Kind = { value: 'Group', super: [ AbstractElement.kind, AbstractElement.kind ] };
    export function is(item: any): item is Group {
        return AstNode.is(item, kind);
    }
}

export interface Keyword extends AbstractElement {
    value: string
    predicated: boolean
    firstSetPredicated: boolean
}

export namespace Keyword {
    export const kind: Kind = { value: 'Keyword', super: [ AbstractElement.kind ] };
    export function is(item: any): item is Keyword {
        return AstNode.is(item, kind);
    }
}

export interface RuleCall extends AbstractElement {
    rule: Reference<AbstractRule>
    arguments: Array<NamedArgument>
    predicated: boolean
    firstSetPredicated: boolean
}

export namespace RuleCall {
    export const kind: Kind = { value: 'RuleCall', super: [ AbstractElement.kind ] };
    export function is(item: any): item is RuleCall {
        return AstNode.is(item, kind);
    }
}

export interface UnorderedGroup extends AbstractElement {
    elements: Array<AbstractElement>
}

export namespace UnorderedGroup {
    export const kind: Kind = { value: 'UnorderedGroup', super: [ AbstractElement.kind ] };
    export function is(item: any): item is UnorderedGroup {
        return AstNode.is(item, kind);
    }
}

export interface GeneratedMetamodel extends AbstractMetamodelDeclaration {
    name: string
}

export namespace GeneratedMetamodel {
    export const kind: Kind = { value: 'GeneratedMetamodel', super: [ AbstractMetamodelDeclaration.kind ] };
    export function is(item: any): item is GeneratedMetamodel {
        return AstNode.is(item, kind);
    }
}

export interface ReferencedMetamodel extends AbstractMetamodelDeclaration {
}

export namespace ReferencedMetamodel {
    export const kind: Kind = { value: 'ReferencedMetamodel', super: [ AbstractMetamodelDeclaration.kind ] };
    export function is(item: any): item is ReferencedMetamodel {
        return AstNode.is(item, kind);
    }
}

export interface NegatedToken extends AbstractNegatedToken {
}

export namespace NegatedToken {
    export const kind: Kind = { value: 'NegatedToken', super: [ AbstractNegatedToken.kind ] };
    export function is(item: any): item is NegatedToken {
        return AstNode.is(item, kind);
    }
}

export interface UntilToken extends AbstractNegatedToken {
}

export namespace UntilToken {
    export const kind: Kind = { value: 'UntilToken', super: [ AbstractNegatedToken.kind ] };
    export function is(item: any): item is UntilToken {
        return AstNode.is(item, kind);
    }
}

export interface EnumRule extends AbstractRule {
    alternatives: EnumLiterals
}

export namespace EnumRule {
    export const kind: Kind = { value: 'EnumRule', super: [ AbstractRule.kind ] };
    export function is(item: any): item is EnumRule {
        return AstNode.is(item, kind);
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
    export const kind: Kind = { value: 'ParserRule', super: [ AbstractRule.kind ] };
    export function is(item: any): item is ParserRule {
        return AstNode.is(item, kind);
    }
}

export interface TerminalRule extends AbstractRule {
    fragment: boolean
    regex: string
}

export namespace TerminalRule {
    export const kind: Kind = { value: 'TerminalRule', super: [ AbstractRule.kind ] };
    export function is(item: any): item is TerminalRule {
        return AstNode.is(item, kind);
    }
}

export interface Conjunction extends Condition {
    left: Condition
    right: Condition
}

export namespace Conjunction {
    export const kind: Kind = { value: 'Conjunction', super: [ Condition.kind ] };
    export function is(item: any): item is Conjunction {
        return AstNode.is(item, kind);
    }
}

export interface Disjunction extends Condition {
    left: Condition
    right: Condition
}

export namespace Disjunction {
    export const kind: Kind = { value: 'Disjunction', super: [ Condition.kind ] };
    export function is(item: any): item is Disjunction {
        return AstNode.is(item, kind);
    }
}

export interface LiteralCondition extends Condition {
    true: boolean
}

export namespace LiteralCondition {
    export const kind: Kind = { value: 'LiteralCondition', super: [ Condition.kind ] };
    export function is(item: any): item is LiteralCondition {
        return AstNode.is(item, kind);
    }
}

export interface Negation extends Condition {
    value: Condition
}

export namespace Negation {
    export const kind: Kind = { value: 'Negation', super: [ Condition.kind ] };
    export function is(item: any): item is Negation {
        return AstNode.is(item, kind);
    }
}

export interface ParameterReference extends Condition {
    parameter: Reference<Parameter>
}

export namespace ParameterReference {
    export const kind: Kind = { value: 'ParameterReference', super: [ Condition.kind ] };
    export function is(item: any): item is ParameterReference {
        return AstNode.is(item, kind);
    }
}

export interface TerminalAlternatives extends ParenthesizedTerminalElement {
}

export namespace TerminalAlternatives {
    export const kind: Kind = { value: 'TerminalAlternatives', super: [ ParenthesizedTerminalElement.kind ] };
    export function is(item: any): item is TerminalAlternatives {
        return AstNode.is(item, kind);
    }
}

export interface CharacterRange extends TerminalTokenElement {
    left: Keyword
    right: Keyword
}

export namespace CharacterRange {
    export const kind: Kind = { value: 'CharacterRange', super: [ TerminalTokenElement.kind ] };
    export function is(item: any): item is CharacterRange {
        return AstNode.is(item, kind);
    }
}

export interface TerminalRuleCall extends TerminalTokenElement {
    rule: Reference<AbstractRule>
}

export namespace TerminalRuleCall {
    export const kind: Kind = { value: 'TerminalRuleCall', super: [ TerminalTokenElement.kind ] };
    export function is(item: any): item is TerminalRuleCall {
        return AstNode.is(item, kind);
    }
}

export interface Wildcard extends TerminalTokenElement {
}

export namespace Wildcard {
    export const kind: Kind = { value: 'Wildcard', super: [ TerminalTokenElement.kind ] };
    export function is(item: any): item is Wildcard {
        return AstNode.is(item, kind);
    }
}

