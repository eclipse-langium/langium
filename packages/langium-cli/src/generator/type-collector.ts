/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import _ from 'lodash';
import * as langium from 'langium';
import { getRuleType, getTypeName, isDataTypeRule } from 'langium';
import { CompositeGeneratorNode, IndentNode, NL } from 'langium';
import { processNode } from 'langium';
import { Cardinality, isOptional } from 'langium';

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

type CollectorState = {
    tree: TypeTree;
    types: TypeAlternative[];
    cardinalities: Cardinality[];
    lastRuleCall?: langium.RuleCall;
}

export class Interface {
    name: string;
    superTypes: string[];
    subTypes: string[] = [];
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
        if (this.containerTypes.length > 0) {
            fieldsNode.children.push('readonly $container: ', Array.from(new Set<string>(this.containerTypes)).join(' | '), ';', NL);
        }
        for (const field of this.fields.sort((a, b) => a.name.localeCompare(b.name))) {
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

        return processNode(interfaceNode);
    }
}

class TypeTree {

    descendents: Map<TypeAlternative, TypeAlternative[]> = new Map();

    addRoot(root: TypeAlternative): void {
        this.descendents.set(root, []);
    }

    split(type: TypeAlternative, count: number): TypeAlternative[] {
        const descendents: TypeAlternative[] = [];

        for (let i = 0; i < count; i++) {
            const clone = _.cloneDeep(type);
            descendents.push(clone);
            this.descendents.set(clone, []);
        }
        this.descendents.set(type, descendents);
        return descendents;
    }

    getLeafNodesOf(type: TypeAlternative): TypeAlternative[] {
        const leaves: TypeAlternative[] = [];
        const direct = this.descendents.get(type) ?? [];
        for (const directDesc of direct) {
            if (!this.hasLeaves(directDesc)) {
                leaves.push(directDesc);
            } else {
                leaves.push(...this.getLeafNodesOf(directDesc));
            }
        }
        if (leaves.length === 0) {
            leaves.push(type);
        }
        return leaves;
    }

    getLeafNodes(): TypeAlternative[] {
        const leaves: TypeAlternative[] = [];
        for (const [type, children] of this.descendents.entries()) {
            if (children.length === 0) {
                leaves.push(type);
            }
        }
        return leaves;
    }

    hasLeaves(type: TypeAlternative): boolean {
        return (this.descendents.get(type) ?? []).length > 0;
    }
}

export function collectAst(grammar: langium.Grammar): Interface[] {
    const state = createState();

    const parserRules = grammar.rules.filter(e => langium.isParserRule(e) && !e.fragment && !isDataTypeRule(e)).map(e => e as langium.ParserRule);

    const allTypes: TypeAlternative[] = [];
    for (const rule of parserRules) {
        state.tree = new TypeTree();
        const type = simpleType(rule);
        state.tree.addRoot(type);
        collectElement(state, type, rule.alternatives);
        allTypes.push(...state.tree.getLeafNodes());
    }

    return calculateAst(allTypes);
}

function createState(type?: TypeAlternative): CollectorState {
    const state: CollectorState = { types: [], cardinalities: [], tree: new TypeTree() };
    if (type) {
        state.tree.addRoot(type);
    }
    return state;
}

function simpleType(rule: langium.ParserRule): TypeAlternative {
    return {
        name: getTypeName(rule),
        super: [],
        fields: [],
        ruleCalls: [],
        hasAction: false
    };
}

function enterGroup(state: CollectorState, cardinality: Cardinality): void {
    state.cardinalities.push(cardinality);
}

function leaveGroup(state: CollectorState): void {
    state.cardinalities.pop();
}

function isStateOptional(state: CollectorState): boolean {
    return state.cardinalities.some(e => isOptional(e));
}

function collectElement(state: CollectorState, type: TypeAlternative, element: langium.AbstractElement): void {
    enterGroup(state, element.cardinality);
    if (isOptional(element.cardinality)) {
        const [item] = state.tree.split(type, 2);
        type = item;
    }
    if (langium.isAlternatives(element)) {
        const splits = state.tree.split(type, element.elements.length);
        for (let i = 0; i < splits.length; i++) {
            const item = element.elements[i];
            const splitType = splits[i];
            collectElement(state, splitType, item);
        }
    } else if (langium.isGroup(element) || langium.isUnorderedGroup(element)) {
        for (const item of element.elements) {
            const leaves = state.tree.getLeafNodesOf(type);
            for (const leaf of leaves) {
                collectElement(state, leaf, item);
            }
        }
    } else if (langium.isAction(element)) {
        addAction(state, type, element);
    } else if (langium.isAssignment(element)) {
        addAssignment(state, type, element);
    } else if (langium.isRuleCall(element)) {
        addRuleCall(state, type, element);
    }
    leaveGroup(state);
}

function addAction(state: CollectorState, type: TypeAlternative, action: langium.Action): void {
    if (action.type !== type.name) {
        type.super.push(type.name);
    }
    type.hasAction = true;
    type.name = action.type;
    if (action.feature && action.operator) {
        if (state.lastRuleCall) {
            type.fields.push({
                name: action.feature,
                array: action.operator === '+=',
                optional: false,
                reference: false,
                types: [getTypeName(state.lastRuleCall.rule?.ref)]
            });
        } else {
            throw new Error('Actions with features can only be called after an unassigned rule call');
        }
    }
}

function addAssignment(state: CollectorState, type: TypeAlternative, assignment: langium.Assignment): void {
    const typeItems: TypeCollection = { types: [], reference: false };
    findTypes(assignment.terminal, typeItems);
    type.fields.push({
        name: assignment.feature,
        array: assignment.operator === '+=',
        optional: isOptional(assignment.cardinality) || isStateOptional(state),
        types: assignment.operator === '?=' ? ['boolean'] : typeItems.types,
        reference: typeItems.reference
    });
}

function findTypes(terminal: langium.AbstractElement, types: TypeCollection): void {
    if (langium.isAlternatives(terminal) || langium.isUnorderedGroup(terminal) || langium.isGroup(terminal)) {
        findInCollection(terminal, types);
    } else if (langium.isKeyword(terminal)) {
        types.types.push(`'${terminal.value}'`);
    } else if (langium.isRuleCall(terminal)) {
        types.types.push(getRuleType(terminal.rule.ref));
    } else if (langium.isCrossReference(terminal)) {
        types.types.push(getRuleType(terminal.type.ref));
        types.reference = true;
    }
}

function findInCollection(collection: langium.Alternatives | langium.Group | langium.UnorderedGroup, types: TypeCollection): void {
    for (const element of collection.elements) {
        findTypes(element, types);
    }
}

function addRuleCall(state: CollectorState, type: TypeAlternative, ruleCall: langium.RuleCall): void {
    const rule = ruleCall.rule.ref;
    // Add all fields of fragments to the current type
    if (langium.isParserRule(rule) && rule.fragment) {
        const fragmentType = simpleType(rule);
        const fragmentState = createState(fragmentType);
        collectElement(fragmentState, fragmentType, rule.alternatives);
        const types = calculateAst(fragmentState.tree.getLeafNodes());
        const foundType = types.find(e => e.name === rule.name);
        if (foundType) {
            type.fields.push(...foundType.fields);
        }
    } else if (langium.isParserRule(rule)) {
        type.ruleCalls.push(getRuleType(rule));
        state.lastRuleCall = ruleCall;
    }
}

function flattenTypes(alternatives: TypeAlternative[]): TypeAlternative[] {
    const names = new Set<string>(alternatives.map(e => e.name));
    const types: TypeAlternative[] = [];

    for (const name of names) {
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

function calculateAst(alternatives: TypeAlternative[]): Interface[] {
    const interfaces: Interface[] = [];
    const ruleCallAlternatives: TypeAlternative[] = [];
    const flattened = flattenTypes(alternatives);

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
        if (!exists && !interfaces.some(e => e.name === ruleCallType.name)) {
            interfaces.push(new Interface(ruleCallType.name, ruleCallType.super, []));
        }
    }
    for (const type of interfaces) {
        type.superTypes = Array.from(new Set(type.superTypes));
    }
    removeInvalidSuperTypes(interfaces);
    liftFields(interfaces);
    buildContainerTypes(interfaces);

    return sortTypes(interfaces);
}

function removeInvalidSuperTypes(interfaces: Interface[]): void {
    for (const type of interfaces) {
        const toRemove: string[] = [];
        for (const superType of type.superTypes) {
            if (!interfaces.some(e => e.name === superType)) {
                toRemove.push(superType);
            }
        }
        type.superTypes = type.superTypes.filter(e => !toRemove.includes(e));
    }
}

function buildContainerTypes(interfaces: Interface[]): void {
    // 1st stage: collect container types
    for (const type of interfaces) {
        for (const field of type.fields.filter(e => !e.reference)) {
            for (const fieldTypeName of field.types) {
                const fieldType = interfaces.find(e => e.name === fieldTypeName);
                if (fieldType) {
                    fieldType.containerTypes.push(type.name);
                }
            }
        }
    }
    const connectedComponents: Interface[][] = [];
    // 2nd stage: share container types and lift them in supertypes
    calculateSubTypes(interfaces);
    calculateConnectedComponents(connectedComponents, interfaces);
    shareAndLiftContainerTypes(connectedComponents);
}

function calculateSubTypes(interfaces: Interface[]): void {
    for (const type of interfaces) {
        for (const superTypeName of type.superTypes) {
            const superType = interfaces.find(e => e.name === superTypeName);
            if (superType) {
                superType.subTypes.push(type.name);
            }
        }
        type.subTypes = Array.from(new Set<string>(type.subTypes));
    }
}

function calculateConnectedComponents(connectedComponents: Interface[][], interfaces: Interface[]): void {
    const visited: Set<string> = new Set();

    function dfs(type: Interface): Interface[] {
        let component: Interface[] = [type];
        visited.add(type.name);
        for (const nextTypeName of type.subTypes.concat(type.superTypes)) {
            if (!visited.has(nextTypeName)) {
                const superType = interfaces.find(e => e.name === nextTypeName);
                if (superType) {
                    component = component.concat(dfs(superType));
                }
            }
        }
        return component;
    }

    for (const type of interfaces) {
        if (!visited.has(type.name)) {
            connectedComponents.push(dfs(type));
        }
    }
}

function shareAndLiftContainerTypes(connectedComponents: Interface[][]): void {
    for (const component of connectedComponents) {
        let containerTypes: string[] = [];
        component.forEach(type => containerTypes = containerTypes.concat(type.containerTypes));
        for (const type of component) {
            if (type.superTypes.length > 0) {
                type.containerTypes = [];
            } else {
                type.containerTypes = containerTypes;
            }
        }
    }
}

function liftFields(interfaces: Interface[]): void {
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
        if (!l.includes(n)) {
            l.push(n);
            for (const m of nodes.filter(e => e.nodes.includes(n))) {
                s.push(m);
            }
        }
    }
    return l.map(e => e.value);
}
