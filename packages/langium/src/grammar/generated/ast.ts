/******************************************************************************
 * This file was generated by langium-cli 0.2.0.
 * DO NOT EDIT MANUALLY!
 ******************************************************************************/

/* eslint-disable @typescript-eslint/array-type */
/* eslint-disable @typescript-eslint/no-empty-interface */
import { AstNode, AstReflection, Reference } from '../../syntax-tree';
import { isAstNode } from '../../utils/ast-util';

export type AbstractRule = ParserRule | TerminalRule;

export const AbstractRule = 'AbstractRule';

export function isAbstractRule(item: unknown): item is AbstractRule {
    return reflection.isInstance(item, AbstractRule);
}

export type AbstractType = Interface | ParserRule | Type;

export const AbstractType = 'AbstractType';

export function isAbstractType(item: unknown): item is AbstractType {
    return reflection.isInstance(item, AbstractType);
}

export type Condition = Conjunction | Disjunction | LiteralCondition | Negation | ParameterReference;

export const Condition = 'Condition';

export function isCondition(item: unknown): item is Condition {
    return reflection.isInstance(item, Condition);
}

export type PrimitiveType = 'boolean' | 'date' | 'number' | 'string';

export interface AbstractElement extends AstNode {
    readonly $container: Alternatives | Assignment | AtomType | CharacterRange | CrossReference | Group | NegatedToken | ParserRule | TerminalAlternatives | TerminalGroup | TerminalRule | UnorderedGroup | UntilToken;
    cardinality: '*' | '+' | '?'
}

export const AbstractElement = 'AbstractElement';

export function isAbstractElement(item: unknown): item is AbstractElement {
    return reflection.isInstance(item, AbstractElement);
}

export interface Action extends AbstractElement {
    readonly $container: Alternatives | Assignment | AtomType | CharacterRange | CrossReference | Group | NegatedToken | ParserRule | TerminalAlternatives | TerminalGroup | TerminalRule | UnorderedGroup | UntilToken;
    feature: string
    operator: '+=' | '='
    type: string
}

export const Action = 'Action';

export function isAction(item: unknown): item is Action {
    return reflection.isInstance(item, Action);
}

export interface Alternatives extends AbstractElement {
    readonly $container: Alternatives | Assignment | AtomType | CharacterRange | CrossReference | Group | NegatedToken | ParserRule | TerminalAlternatives | TerminalGroup | TerminalRule | UnorderedGroup | UntilToken;
    elements: Array<AbstractElement>
}

export const Alternatives = 'Alternatives';

export function isAlternatives(item: unknown): item is Alternatives {
    return reflection.isInstance(item, Alternatives);
}

export interface Assignment extends AbstractElement {
    readonly $container: Alternatives | Assignment | AtomType | CharacterRange | CrossReference | Group | NegatedToken | ParserRule | TerminalAlternatives | TerminalGroup | TerminalRule | UnorderedGroup | UntilToken;
    feature: string
    firstSetPredicated: boolean
    operator: '+=' | '=' | '?='
    predicated: boolean
    terminal: AbstractElement
}

export const Assignment = 'Assignment';

export function isAssignment(item: unknown): item is Assignment {
    return reflection.isInstance(item, Assignment);
}

export interface AtomType extends AstNode {
    readonly $container: Type | TypeAttribute;
    isArray: boolean
    isRef: boolean
    keywordType: Keyword
    primitiveType: PrimitiveType
    refType: Reference<AbstractType>
}

export const AtomType = 'AtomType';

export function isAtomType(item: unknown): item is AtomType {
    return reflection.isInstance(item, AtomType);
}

export interface CharacterRange extends AbstractElement {
    readonly $container: Alternatives | Assignment | AtomType | CharacterRange | CrossReference | Group | NegatedToken | ParserRule | TerminalAlternatives | TerminalGroup | TerminalRule | UnorderedGroup | UntilToken;
    left: Keyword
    right: Keyword
}

export const CharacterRange = 'CharacterRange';

export function isCharacterRange(item: unknown): item is CharacterRange {
    return reflection.isInstance(item, CharacterRange);
}

export interface Conjunction extends AstNode {
    readonly $container: Conjunction | Disjunction | Group | NamedArgument | Negation;
    left: Condition
    right: Condition
}

export const Conjunction = 'Conjunction';

export function isConjunction(item: unknown): item is Conjunction {
    return reflection.isInstance(item, Conjunction);
}

export interface CrossReference extends AbstractElement {
    readonly $container: Alternatives | Assignment | AtomType | CharacterRange | CrossReference | Group | NegatedToken | ParserRule | TerminalAlternatives | TerminalGroup | TerminalRule | UnorderedGroup | UntilToken;
    deprecatedSyntax: boolean
    terminal: AbstractElement
    type: Reference<AbstractType>
}

export const CrossReference = 'CrossReference';

export function isCrossReference(item: unknown): item is CrossReference {
    return reflection.isInstance(item, CrossReference);
}

export interface Disjunction extends AstNode {
    readonly $container: Conjunction | Disjunction | Group | NamedArgument | Negation;
    left: Condition
    right: Condition
}

export const Disjunction = 'Disjunction';

export function isDisjunction(item: unknown): item is Disjunction {
    return reflection.isInstance(item, Disjunction);
}

export interface Grammar extends AstNode {
    definesHiddenTokens: boolean
    hiddenTokens: Array<Reference<AbstractRule>>
    imports: Array<GrammarImport>
    interfaces: Array<Interface>
    isDeclared: boolean
    name: string
    rules: Array<AbstractRule>
    types: Array<Type>
    usedGrammars: Array<Reference<Grammar>>
}

export const Grammar = 'Grammar';

export function isGrammar(item: unknown): item is Grammar {
    return reflection.isInstance(item, Grammar);
}

export interface GrammarImport extends AstNode {
    readonly $container: Grammar;
    path: string
}

export const GrammarImport = 'GrammarImport';

export function isGrammarImport(item: unknown): item is GrammarImport {
    return reflection.isInstance(item, GrammarImport);
}

export interface Group extends AbstractElement {
    readonly $container: Alternatives | Assignment | AtomType | CharacterRange | CrossReference | Group | NegatedToken | ParserRule | TerminalAlternatives | TerminalGroup | TerminalRule | UnorderedGroup | UntilToken;
    elements: Array<AbstractElement>
    firstSetPredicated: boolean
    guardCondition: Condition
    predicated: boolean
}

export const Group = 'Group';

export function isGroup(item: unknown): item is Group {
    return reflection.isInstance(item, Group);
}

export interface Interface extends AstNode {
    readonly $container: Grammar;
    attributes: Array<TypeAttribute>
    name: string
    superTypes: Array<Reference<AbstractType>>
}

export const Interface = 'Interface';

export function isInterface(item: unknown): item is Interface {
    return reflection.isInstance(item, Interface);
}

export interface Keyword extends AbstractElement {
    readonly $container: Alternatives | Assignment | AtomType | CharacterRange | CrossReference | Group | NegatedToken | ParserRule | TerminalAlternatives | TerminalGroup | TerminalRule | UnorderedGroup | UntilToken;
    firstSetPredicated: boolean
    predicated: boolean
    value: string
}

export const Keyword = 'Keyword';

export function isKeyword(item: unknown): item is Keyword {
    return reflection.isInstance(item, Keyword);
}

export interface LiteralCondition extends AstNode {
    readonly $container: Conjunction | Disjunction | Group | NamedArgument | Negation;
    true: boolean
}

export const LiteralCondition = 'LiteralCondition';

export function isLiteralCondition(item: unknown): item is LiteralCondition {
    return reflection.isInstance(item, LiteralCondition);
}

export interface NamedArgument extends AstNode {
    readonly $container: RuleCall;
    calledByName: boolean
    parameter?: Reference<Parameter>
    value: Condition
}

export const NamedArgument = 'NamedArgument';

export function isNamedArgument(item: unknown): item is NamedArgument {
    return reflection.isInstance(item, NamedArgument);
}

export interface NegatedToken extends AbstractElement {
    readonly $container: Alternatives | Assignment | AtomType | CharacterRange | CrossReference | Group | NegatedToken | ParserRule | TerminalAlternatives | TerminalGroup | TerminalRule | UnorderedGroup | UntilToken;
    terminal: AbstractElement
}

export const NegatedToken = 'NegatedToken';

export function isNegatedToken(item: unknown): item is NegatedToken {
    return reflection.isInstance(item, NegatedToken);
}

export interface Negation extends AstNode {
    readonly $container: Conjunction | Disjunction | Group | NamedArgument | Negation;
    value: Condition
}

export const Negation = 'Negation';

export function isNegation(item: unknown): item is Negation {
    return reflection.isInstance(item, Negation);
}

export interface Parameter extends AstNode {
    readonly $container: ParserRule;
    name: string
}

export const Parameter = 'Parameter';

export function isParameter(item: unknown): item is Parameter {
    return reflection.isInstance(item, Parameter);
}

export interface ParameterReference extends AstNode {
    readonly $container: Conjunction | Disjunction | Group | NamedArgument | Negation;
    parameter: Reference<Parameter>
}

export const ParameterReference = 'ParameterReference';

export function isParameterReference(item: unknown): item is ParameterReference {
    return reflection.isInstance(item, ParameterReference);
}

export interface ParserRule extends AstNode {
    readonly $container: Grammar;
    alternatives: AbstractElement
    definesHiddenTokens: boolean
    entry: boolean
    fragment: boolean
    hiddenTokens: Array<Reference<AbstractRule>>
    name: string
    parameters: Array<Parameter>
    type: ReturnType
    wildcard: boolean
}

export const ParserRule = 'ParserRule';

export function isParserRule(item: unknown): item is ParserRule {
    return reflection.isInstance(item, ParserRule);
}

export interface RegexToken extends AbstractElement {
    readonly $container: Alternatives | Assignment | AtomType | CharacterRange | CrossReference | Group | NegatedToken | ParserRule | TerminalAlternatives | TerminalGroup | TerminalRule | UnorderedGroup | UntilToken;
    regex: string
}

export const RegexToken = 'RegexToken';

export function isRegexToken(item: unknown): item is RegexToken {
    return reflection.isInstance(item, RegexToken);
}

export interface ReturnType extends AstNode {
    readonly $container: ParserRule | TerminalRule;
    name: PrimitiveType | string
}

export const ReturnType = 'ReturnType';

export function isReturnType(item: unknown): item is ReturnType {
    return reflection.isInstance(item, ReturnType);
}

export interface RuleCall extends AbstractElement {
    readonly $container: Alternatives | Assignment | AtomType | CharacterRange | CrossReference | Group | NegatedToken | ParserRule | TerminalAlternatives | TerminalGroup | TerminalRule | UnorderedGroup | UntilToken;
    arguments: Array<NamedArgument>
    firstSetPredicated: boolean
    predicated: boolean
    rule: Reference<AbstractRule>
}

export const RuleCall = 'RuleCall';

export function isRuleCall(item: unknown): item is RuleCall {
    return reflection.isInstance(item, RuleCall);
}

export interface TerminalAlternatives extends AbstractElement {
    readonly $container: Alternatives | Assignment | AtomType | CharacterRange | CrossReference | Group | NegatedToken | ParserRule | TerminalAlternatives | TerminalGroup | TerminalRule | UnorderedGroup | UntilToken;
    elements: Array<AbstractElement>
}

export const TerminalAlternatives = 'TerminalAlternatives';

export function isTerminalAlternatives(item: unknown): item is TerminalAlternatives {
    return reflection.isInstance(item, TerminalAlternatives);
}

export interface TerminalGroup extends AbstractElement {
    readonly $container: Alternatives | Assignment | AtomType | CharacterRange | CrossReference | Group | NegatedToken | ParserRule | TerminalAlternatives | TerminalGroup | TerminalRule | UnorderedGroup | UntilToken;
    elements: Array<AbstractElement>
}

export const TerminalGroup = 'TerminalGroup';

export function isTerminalGroup(item: unknown): item is TerminalGroup {
    return reflection.isInstance(item, TerminalGroup);
}

export interface TerminalRule extends AstNode {
    readonly $container: Grammar;
    fragment: boolean
    hidden: boolean
    name: string
    terminal: AbstractElement
    type: ReturnType
}

export const TerminalRule = 'TerminalRule';

export function isTerminalRule(item: unknown): item is TerminalRule {
    return reflection.isInstance(item, TerminalRule);
}

export interface TerminalRuleCall extends AbstractElement {
    readonly $container: Alternatives | Assignment | AtomType | CharacterRange | CrossReference | Group | NegatedToken | ParserRule | TerminalAlternatives | TerminalGroup | TerminalRule | UnorderedGroup | UntilToken;
    rule: Reference<TerminalRule>
}

export const TerminalRuleCall = 'TerminalRuleCall';

export function isTerminalRuleCall(item: unknown): item is TerminalRuleCall {
    return reflection.isInstance(item, TerminalRuleCall);
}

export interface Type extends AstNode {
    readonly $container: Grammar;
    name: string
    typeAlternatives: Array<AtomType>
}

export const Type = 'Type';

export function isType(item: unknown): item is Type {
    return reflection.isInstance(item, Type);
}

export interface TypeAttribute extends AstNode {
    readonly $container: Interface;
    isOptional: boolean
    name: string
    type: AtomType
}

export const TypeAttribute = 'TypeAttribute';

export function isTypeAttribute(item: unknown): item is TypeAttribute {
    return reflection.isInstance(item, TypeAttribute);
}

export interface UnorderedGroup extends AbstractElement {
    readonly $container: Alternatives | Assignment | AtomType | CharacterRange | CrossReference | Group | NegatedToken | ParserRule | TerminalAlternatives | TerminalGroup | TerminalRule | UnorderedGroup | UntilToken;
    elements: Array<AbstractElement>
}

export const UnorderedGroup = 'UnorderedGroup';

export function isUnorderedGroup(item: unknown): item is UnorderedGroup {
    return reflection.isInstance(item, UnorderedGroup);
}

export interface UntilToken extends AbstractElement {
    readonly $container: Alternatives | Assignment | AtomType | CharacterRange | CrossReference | Group | NegatedToken | ParserRule | TerminalAlternatives | TerminalGroup | TerminalRule | UnorderedGroup | UntilToken;
    terminal: AbstractElement
}

export const UntilToken = 'UntilToken';

export function isUntilToken(item: unknown): item is UntilToken {
    return reflection.isInstance(item, UntilToken);
}

export interface Wildcard extends AbstractElement {
    readonly $container: Alternatives | Assignment | AtomType | CharacterRange | CrossReference | Group | NegatedToken | ParserRule | TerminalAlternatives | TerminalGroup | TerminalRule | UnorderedGroup | UntilToken;
}

export const Wildcard = 'Wildcard';

export function isWildcard(item: unknown): item is Wildcard {
    return reflection.isInstance(item, Wildcard);
}

export type LangiumGrammarAstType = 'AbstractElement' | 'AbstractRule' | 'AbstractType' | 'Action' | 'Alternatives' | 'Assignment' | 'AtomType' | 'CharacterRange' | 'Condition' | 'Conjunction' | 'CrossReference' | 'Disjunction' | 'Grammar' | 'GrammarImport' | 'Group' | 'Interface' | 'Keyword' | 'LiteralCondition' | 'NamedArgument' | 'NegatedToken' | 'Negation' | 'Parameter' | 'ParameterReference' | 'ParserRule' | 'RegexToken' | 'ReturnType' | 'RuleCall' | 'TerminalAlternatives' | 'TerminalGroup' | 'TerminalRule' | 'TerminalRuleCall' | 'Type' | 'TypeAttribute' | 'UnorderedGroup' | 'UntilToken' | 'Wildcard';

export type LangiumGrammarAstReference = 'AtomType:refType' | 'CrossReference:type' | 'Grammar:usedGrammars' | 'Grammar:hiddenTokens' | 'Interface:superTypes' | 'NamedArgument:parameter' | 'ParameterReference:parameter' | 'ParserRule:hiddenTokens' | 'RuleCall:rule' | 'TerminalRuleCall:rule';

export class LangiumGrammarAstReflection implements AstReflection {

    getAllTypes(): string[] {
        return ['AbstractElement', 'AbstractRule', 'AbstractType', 'Action', 'Alternatives', 'Assignment', 'AtomType', 'CharacterRange', 'Condition', 'Conjunction', 'CrossReference', 'Disjunction', 'Grammar', 'GrammarImport', 'Group', 'Interface', 'Keyword', 'LiteralCondition', 'NamedArgument', 'NegatedToken', 'Negation', 'Parameter', 'ParameterReference', 'ParserRule', 'RegexToken', 'ReturnType', 'RuleCall', 'TerminalAlternatives', 'TerminalGroup', 'TerminalRule', 'TerminalRuleCall', 'Type', 'TypeAttribute', 'UnorderedGroup', 'UntilToken', 'Wildcard'];
    }

    isInstance(node: unknown, type: string): boolean {
        return isAstNode(node) && this.isSubtype(node.$type, type);
    }

    isSubtype(subtype: string, supertype: string): boolean {
        if (subtype === supertype) {
            return true;
        }
        switch (subtype) {
            case Action:
            case Alternatives:
            case Assignment:
            case CharacterRange:
            case CrossReference:
            case Group:
            case Keyword:
            case NegatedToken:
            case RegexToken:
            case RuleCall:
            case TerminalAlternatives:
            case TerminalGroup:
            case TerminalRuleCall:
            case UnorderedGroup:
            case UntilToken:
            case Wildcard: {
                return this.isSubtype(AbstractElement, supertype);
            }
            case Conjunction:
            case Disjunction:
            case LiteralCondition:
            case Negation:
            case ParameterReference: {
                return this.isSubtype(Condition, supertype);
            }
            case Interface:
            case Type: {
                return this.isSubtype(AbstractType, supertype);
            }
            case ParserRule: {
                return this.isSubtype(AbstractType, supertype) || this.isSubtype(AbstractRule, supertype);
            }
            case TerminalRule: {
                return this.isSubtype(AbstractRule, supertype);
            }
            default: {
                return false;
            }
        }
    }

    getReferenceType(referenceId: LangiumGrammarAstReference): string {
        switch (referenceId) {
            case 'AtomType:refType': {
                return AbstractType;
            }
            case 'CrossReference:type': {
                return AbstractType;
            }
            case 'Grammar:usedGrammars': {
                return Grammar;
            }
            case 'Grammar:hiddenTokens': {
                return AbstractRule;
            }
            case 'Interface:superTypes': {
                return AbstractType;
            }
            case 'NamedArgument:parameter': {
                return Parameter;
            }
            case 'ParameterReference:parameter': {
                return Parameter;
            }
            case 'ParserRule:hiddenTokens': {
                return AbstractRule;
            }
            case 'RuleCall:rule': {
                return AbstractRule;
            }
            case 'TerminalRuleCall:rule': {
                return TerminalRule;
            }
            default: {
                throw new Error(`${referenceId} is not a valid reference id.`);
            }
        }
    }
}

export const reflection = new LangiumGrammarAstReflection();
