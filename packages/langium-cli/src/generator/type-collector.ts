/**********************************************************************************
 * Copyright (c) 2021 TypeFox
 *
 * This program and the accompanying materials are made available under the terms
 * of the MIT License, which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import * as langium from 'langium';
import { getRuleType, getTypeName } from 'langium';
import { CompositeGeneratorNode, IndentNode, NL } from 'langium';
import { process } from 'langium';
import { Cardinality, isDataTypeRule, isOptional } from 'langium';

type TypeAlternative = {
    name: string,
    super: string[],
    fields: Field[]
    ruleCalls: string[],
    hasAction: boolean
}

type Field = {
    name: string,
    array: boolean,
    optional: boolean,
    types: string[],
    reference: boolean,
}

type TypeCollection = {
    types: string[],
    reference: boolean
}

export class Interface {
    name: string;
    superTypes: string[];
    containerTypes: string[] = [];
    fields: Field[];

    constructor(name: string, superTypes: string[], fields: Field[]) {
        this.name = name;
        this.superTypes = Array.from(new Set<string>(superTypes));
        this.fields = fields;
    }

    toString(): string {
        const interfaceNode = new CompositeGeneratorNode();
        const superTypes = this.superTypes.length > 0 ? this.superTypes : [ 'AstNode' ];
        interfaceNode.children.push('export interface ', this.name, ' extends ', superTypes.join(', '), ' {', NL);
        const fieldsNode = new IndentNode();
        if (this.superTypes.length === 0 && this.containerTypes.length > 0) {
            fieldsNode.children.push('readonly $container: ', this.containerTypes.join(' | '), ';', NL);
        }
        for (const field of this.fields) {
            const option = field.optional && field.reference && !field.array ? '?' : '';
            let type = field.types.join(' | ');
            type = field.reference ? 'Reference<' + type + '>' : type;
            type = field.array ? 'Array<' + type + '>' : type;
            fieldsNode.children.push(field.name, option, ': ', type, NL);
        }
        interfaceNode.children.push(fieldsNode, '}', NL, NL);
        interfaceNode.children.push(`export const ${this.name} = '${this.name}';`, NL, NL);
        interfaceNode.children.push('export function is', this.name, '(item: unknown): item is ', this.name, ' {', NL);
        const methodBody = new IndentNode();
        methodBody.children.push(`return reflection.isInstance(item, ${this.name});`, NL);
        interfaceNode.children.push(methodBody, '}', NL);

        return process(interfaceNode);
    }
}

export function collectAst(grammar: langium.Grammar): Interface[] {
    const collector = new TypeCollector();

    const parserRules = grammar.rules.filter(e => langium.isParserRule(e) && !e.fragment && !isDataTypeRule(e)).map(e => e as langium.ParserRule);

    for (const rule of parserRules) {
        collector.addAlternative(getTypeName(rule));
        collectElement(collector, rule.alternatives);
    }

    return collector.calculateAst();
}

function collectElement(collector: TypeCollector, element: langium.AbstractElement): void {
    collector.enterGroup(element.cardinality);
    if (langium.isAlternatives(element) || langium.isUnorderedGroup(element) || langium.isGroup(element)) {
        for (const item of element.elements) {
            collectElement(collector, item);
        }
    } else if (langium.isAction(element)) {
        collector.addAction(element);
    } else if (langium.isAssignment(element)) {
        collector.addAssignment(element);
    } else if (langium.isRuleCall(element)) {
        collector.addRuleCall(element);
    }
    collector.leaveGroup();
}

export class TypeCollector {

    private alternatives: TypeAlternative[] = [];
    private cardinalities: Cardinality[] = [];
    private lastRuleCall?: langium.RuleCall;

    private get currentAlternative(): TypeAlternative {
        return this.alternatives[this.alternatives.length - 1];
    }

    clear(): void {
        this.cardinalities = [];
        this.alternatives = [];
    }

    addAlternative(name: string): void {
        this.alternatives.push({ name, super: [], fields: [], ruleCalls: [], hasAction: false });
    }

    addAction(action: langium.Action): void {
        if (action.type !== this.currentAlternative.name) {
            this.currentAlternative.super.push(this.currentAlternative.name);
        }
        this.currentAlternative.hasAction = true;
        this.currentAlternative.name = action.type;
        if (action.feature && action.operator) {
            if (this.lastRuleCall) {
                this.currentAlternative.fields.push({
                    name: this.clean(action.feature),
                    array: action.operator === '+=',
                    optional: false,
                    reference: false,
                    types: [getTypeName(this.lastRuleCall.rule?.ref)]
                });
            } else {
                throw new Error('Actions with features can only be called after an unassigned rule call');
            }
        }
    }

    addAssignment(assignment: langium.Assignment): void {
        const typeItems: TypeCollection = { types: [], reference: false };
        this.findTypes(assignment.terminal, typeItems);
        this.currentAlternative.fields.push({
            name: this.clean(assignment.feature),
            array: assignment.operator === '+=',
            optional: isOptional(assignment.cardinality) || this.isOptional(),
            types: assignment.operator === '?=' ? ['boolean'] : typeItems.types,
            reference: typeItems.reference
        });
    }

    addRuleCall(ruleCall: langium.RuleCall): void {
        const rule = ruleCall.rule.ref;
        if (langium.isParserRule(rule) && rule.fragment) {
            const collector = new TypeCollector();
            collector.addAlternative(rule.name);
            collectElement(collector, rule.alternatives);
            const types = collector.calculateAst();
            const type = types.find(e => e.name === rule.name);
            if (type) {
                this.currentAlternative.fields.push(...type.fields);
            }
        } else if (langium.isParserRule(rule)) {
            this.currentAlternative.ruleCalls.push(getRuleType(rule));
            this.lastRuleCall = ruleCall;
        }
    }

    enterGroup(cardinality: Cardinality): void {
        this.cardinalities.push(cardinality);
    }

    leaveGroup(): void {
        this.cardinalities.pop();
    }

    protected isOptional(): boolean {
        return this.cardinalities.some(e => e === '*' || e === '?');
    }

    protected findTypes(terminal: langium.AbstractElement, types: TypeCollection): void {
        if (langium.isAlternatives(terminal) || langium.isUnorderedGroup(terminal) || langium.isGroup(terminal)) {
            this.findInCollection(terminal, types);
        } else if (langium.isKeyword(terminal)) {
            types.types.push(terminal.value);
        } else if (langium.isRuleCall(terminal)) {
            types.types.push(getRuleType(terminal.rule.ref));
        } else if (langium.isCrossReference(terminal)) {
            types.types.push(getRuleType(terminal.type.ref));
            types.reference = true;
        }
    }

    protected findInCollection(collection: langium.Alternatives | langium.Group | langium.UnorderedGroup, types: TypeCollection): void {
        for (const element of collection.elements) {
            this.findTypes(element, types);
        }
    }

    // TODO: Optimize/simplify this method
    protected flattenTypes(alternatives: TypeAlternative[]): TypeAlternative[] {
        const names = new Set<string>(alternatives.map(e => e.name));
        const types: TypeAlternative[] = [];

        for (const name of Array.from(names)) {
            const fields: Field[] = [];
            const ruleCalls = new Set<string>();
            const type = { name, fields, ruleCalls: <string[]>[], super: <string[]>[], hasAction: false };
            const namedAlternatives = alternatives.filter(e => e.name === name);
            for (const alt of namedAlternatives) {
                type.super.push(...alt.super);
                type.hasAction = type.hasAction || alt.hasAction;
                const altFields = alt.fields;
                for (const altField of altFields) {
                    const existingField = fields.find(e => e.name === altField.name);
                    if (existingField) {
                        existingField.optional = existingField.optional && altField.optional;
                        const typeSet = new Set(existingField.types);
                        for (const type of altField.types) {
                            typeSet.add(type);
                        }
                        existingField.types = Array.from(typeSet.values());
                    } else {
                        fields.push({ ...altField });
                    }
                }
                if (altFields.length === 0) {
                    for (const ruleCall of alt.ruleCalls) {
                        ruleCalls.add(ruleCall);
                    }
                }
            }
            type.ruleCalls = Array.from(ruleCalls);
            types.push(type);
        }

        return types;
    }

    calculateAst(): Interface[] {
        const interfaces: Interface[] = [];
        const ruleCallAlternatives: TypeAlternative[] = [];
        const flattened = this.flattenTypes(this.alternatives);

        for (const flat of flattened) {
            if (flat.fields.length > 0 || flat.hasAction) {
                const type = new Interface(flat.name, flat.super, flat.fields);
                interfaces.push(type);
            }
            if (flat.ruleCalls.length > 0) {
                ruleCallAlternatives.push(flat);
            }
            // all other cases assume we have a data type rule
            // we do not generate an AST type for data type rules
        }

        for (const ruleCallType of ruleCallAlternatives) {
            let exists = false;
            for (const ruleCall of ruleCallType.ruleCalls) {
                const calledInterface = interfaces.find(e => e.name === ruleCall);
                if (calledInterface && calledInterface.name === ruleCallType.name) {
                    exists = true;
                } else if (calledInterface) {
                    calledInterface.superTypes.push(ruleCallType.name);
                }
            }
            if (!exists) {
                interfaces.push(new Interface(ruleCallType.name, ruleCallType.super, []));
            }
        }
        for (const type of interfaces) {
            type.superTypes = Array.from(new Set(type.superTypes));
        }
        this.liftFields(interfaces);
        this.buildContainerTypes(interfaces);

        return sortTypes(interfaces);
    }

    private buildContainerTypes(interfaces: Interface[]): void {
        for (const type of interfaces) {
            for (const field of type.fields.filter(e => !e.reference)) {
                for (const fieldTypeName of field.types) {
                    const fieldType = interfaces.find(e => e.name === fieldTypeName);
                    if (fieldType) {
                        const topSuperTypes = this.getTopSuperTypes(fieldType, interfaces);
                        topSuperTypes.forEach(e => e.containerTypes.push(type.name));
                    }
                }
            }
        }
    }

    private getTopSuperTypes(type: Interface, types: Interface[]): Interface[] {
        if (type.superTypes.length > 0) {
            const superTypes = types.filter(e => type.superTypes.includes(e.name));
            return superTypes.flatMap(e => this.getTopSuperTypes(e, types));
        } else {
            return [type];
        }
    }

    private liftFields(interfaces: Interface[]): void {
        for (const interfaceType of interfaces) {
            const subInterfaces = interfaces.filter(e => e.superTypes.includes(interfaceType.name));
            const first = subInterfaces[0];
            if (first) {
                const removal: Field[] = [];
                for (const field of first.fields) {
                    if (subInterfaces.every(e => e.fields.some(f => f.name === field.name))) {
                        if (!interfaceType.fields.some(e => e.name === field.name)) {
                            interfaceType.fields.push(field);
                        }
                        removal.push(field);
                    }
                }
                for (const remove of removal) {
                    for (const subInterface of subInterfaces) {
                        const index = subInterface.fields.findIndex(e => e.name === remove.name);
                        subInterface.fields.splice(index, 1);
                    }
                }
            }
        }
    }

    private clean(value: string): string {
        if (value.startsWith('^')) {
            return value.substring(1);
        } else {
            return value;
        }
    }
}

type TypeNode = {
    value: Interface;
    nodes: TypeNode[];
}

/**
 * Performs topological sorting on the generated interfaces.
 * @param interfaces The interfaces to sort topologically.
 * @returns A topologically sorted set of interfaces.
 */
function sortTypes(interfaces: Interface[]): Interface[] {
    const nodes: TypeNode[] = interfaces
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(e => <TypeNode>{ value: e, nodes: [] });
    for (const node of nodes) {
        node.nodes = nodes.filter(e => node.value.superTypes.includes(e.value.name));
    }
    const l: TypeNode[] = [];
    const s = nodes.filter(e => e.nodes.length === 0);
    while (s.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const n = s.shift()!;
        l.push(n);
        for (const m of nodes.filter(e => e.nodes.includes(n))) {
            s.push(m);
        }
    }
    return l.map(e => e.value);
}
