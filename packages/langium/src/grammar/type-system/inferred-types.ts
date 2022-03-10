/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Cardinality, getRuleType, getTypeName, isOptional } from '../grammar-util';
import { AbstractElement, Action, Alternatives, Assignment, Group, isAction, isAlternatives, isAssignment, isCrossReference, isGroup, isKeyword, isParserRule, isRuleCall, isUnorderedGroup, ParserRule, RuleCall, UnorderedGroup } from '../generated/ast';
import { stream } from '../../utils/stream';
import { AstTypes, distictAndSorted, Property, PropertyType, InterfaceType, TypeType } from './types-util';

type TypeAlternative = {
    name: string,
    super: string[],
    properties: Property[]
    ruleCalls: string[],
    hasAction: boolean
}

type TypeCollection = {
    types: string[],
    reference: boolean
}

class TypeTree {
    descendents: Map<TypeAlternative, TypeAlternative[]> = new Map();

    constructor(root: TypeAlternative) {
        this.descendents.set(root, []);
    }

    split(type: TypeAlternative, count: number): TypeAlternative[] {
        const descendents: TypeAlternative[] = new Array(count).fill(JSON.parse(JSON.stringify(type)));
        descendents.forEach(e => this.descendents.set(e, []));
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
        return Array.from(this.descendents.keys());
    }

    hasLeaves(type: TypeAlternative): boolean {
        return (this.descendents.get(type) ?? []).length > 0;
    }
}

class TypeCollectorState {
    tree: TypeTree;
    cardinalities: Cardinality[] = [];
    parserRule?: ParserRule;
    currentType?: TypeAlternative;

    constructor(type: TypeAlternative) {
        this.tree = new TypeTree(type);
    }

    enterGroup(cardinality: Cardinality): void {
        this.cardinalities.push(cardinality);
    }

    leaveGroup(): void {
        this.cardinalities.pop();
    }

    isOptional(): boolean {
        return this.cardinalities.some(e => isOptional(e));
    }
}

export function collectInferredTypes(parserRules: ParserRule[], datatypeRules: ParserRule[]): AstTypes {
    // extract interfaces and types from parser rules
    const allTypes: TypeAlternative[] = [];
    for (const rule of parserRules) {
        const type = initType(rule);
        const state = new TypeCollectorState(type);
        state.parserRule = rule;
        collectElement(state, type, rule.alternatives);
        allTypes.push(...state.tree.getLeafNodes());
    }
    const interfaces = calculateAst(allTypes);
    buildContainerTypes(interfaces);
    const inferredTypes = extractTypes(interfaces);

    // extract types from datatype rules
    for (const rule of datatypeRules) {
        const types = isAlternatives(rule.alternatives) && rule.alternatives.elements.every(e => isKeyword(e)) ?
            stream(rule.alternatives.elements).filter(isKeyword).map(e => `'${e.value}'`).toArray() :
            [rule.type?.name ?? 'string'];
        inferredTypes.types.push(new TypeType(rule.name, [<PropertyType>{ types, reference: false, array: false }]));
    }

    return inferredTypes;
}

// todo simplify
function initType(rule: ParserRule | string): TypeAlternative {
    return {
        name: isParserRule(rule) ? getTypeName(rule) : rule,
        super: [],
        properties: [],
        ruleCalls: [],
        hasAction: false
    };
}

/**
 * Collects all possible type branches of a given element.
 * @param state State to walk over element's graph.
 * @param type Element that collects a current type branch for the given element.
 * @param element The given AST element, from which it's necessary to extract the type.
 */
function collectElement(state: TypeCollectorState, type: TypeAlternative, element: AbstractElement): void {
    state.currentType = type;
    state.enterGroup(element.cardinality);
    if (isOptional(element.cardinality)) {
        state.tree.split(state.currentType, 2);
    }
    if (isAlternatives(element)) {
        state.tree
            .split(state.currentType, element.elements.length)
            .forEach((split, i) => collectElement(state, split, element.elements[i]));
    } else if (isGroup(element) || isUnorderedGroup(element)) {
        for (const item of element.elements) {
            state.tree
                .getLeafNodesOf(type)
                .forEach(leaf => collectElement(state, leaf, item));
        }
    } else if (isAction(element)) {
        addAction(state, element);
    } else if (isAssignment(element)) {
        addAssignment(state, element);
    } else if (isRuleCall(element)) {
        addRuleCall(state, element);
    }
    state.leaveGroup();
}

function addAction(state: TypeCollectorState, action: Action): void {
    const type = state.currentType;
    if (type) {
        let newType: TypeAlternative;
        if (action.type !== type.name) {
            newType = initType(action.type);
            newType.super.push(getTypeName(state.parserRule));
            newType.hasAction = true;
            state.tree.descendents.get(type)!.push(newType);
            state.tree.descendents.set(newType, []);
            state.currentType = newType;
        } else {
            newType = type;
        }

        if (action.feature && action.operator) {
            newType.properties.push({
                name: action.feature,
                optional: false,
                typeAlternatives: [{
                    array: action.operator === '+=',
                    reference: false,
                    types: [getTypeName(state.parserRule)]
                }]
            });
        }
    }
}

function addAssignment(state: TypeCollectorState, assignment: Assignment): void {
    const typeItems: TypeCollection = { types: [], reference: false };
    findTypes(assignment.terminal, typeItems);
    state.currentType?.properties.push({
        name: assignment.feature,
        optional: isOptional(assignment.cardinality) || state.isOptional(),
        typeAlternatives: [{
            array: assignment.operator === '+=',
            types: assignment.operator === '?=' ? ['boolean'] : Array.from(new Set(typeItems.types)),
            reference: typeItems.reference
        }]
    });
}

function findTypes(terminal: AbstractElement, types: TypeCollection): void {
    if (isAlternatives(terminal) || isUnorderedGroup(terminal) || isGroup(terminal)) {
        findInCollection(terminal, types);
    } else if (isKeyword(terminal)) {
        types.types.push(`'${terminal.value}'`);
    } else if (isRuleCall(terminal)) {
        types.types.push(getRuleType(terminal.rule.ref));
    } else if (isCrossReference(terminal)) {
        types.types.push(getTypeName(terminal.type.ref));
        types.reference = true;
    }
}

function findInCollection(collection: Alternatives | Group | UnorderedGroup, types: TypeCollection): void {
    for (const element of collection.elements) {
        findTypes(element, types);
    }
}

function addRuleCall(state: TypeCollectorState, ruleCall: RuleCall): void {
    const rule = ruleCall.rule.ref;
    const type = state.currentType;
    if (type) {
        // Add all properties of fragments to the current type
        if (isParserRule(rule) && rule.fragment) {
            const fragmentType = initType(rule);
            const fragmentState = new TypeCollectorState(fragmentType);
            collectElement(fragmentState, fragmentType, rule.alternatives);
            const types = calculateAst(fragmentState.tree.getLeafNodes());
            const foundType = types.find(e => e.name === rule.name);
            if (foundType) {
                type.properties.push(...foundType.properties);
            }
        } else if (isParserRule(rule)) {
            type.ruleCalls.push(getRuleType(rule));
        }
    }
}

/**
 * Calculate interfaces from all possible type branches.
 * [some of these interfaces will become types in the generated AST]
 * @param alternatives The type branches that will be squashed in interfaces.
 * @returns Interfaces.
 */
function calculateAst(alternatives: TypeAlternative[]): InterfaceType[] {
    const interfaces: InterfaceType[] = [];
    const ruleCallAlternatives: TypeAlternative[] = [];
    const flattened = flattenTypes(alternatives);

    for (const flat of flattened) {
        const interfaceType = new InterfaceType(flat.name, flat.super, flat.properties);
        interfaces.push(interfaceType);
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
            if (calledInterface) {
                if (calledInterface.name === ruleCallType.name) {
                    exists = true;
                } else {
                    calledInterface.superTypes.push(ruleCallType.name);
                }
            }
        }
        if (!exists && !interfaces.some(e => e.name === ruleCallType.name)) {
            interfaces.push(new InterfaceType(ruleCallType.name, ruleCallType.super, []));
        }
    }
    for (const interfaceType of interfaces) {
        interfaceType.superTypes = Array.from(new Set(interfaceType.superTypes));
    }
    return interfaces;
}

function flattenTypes(alternatives: TypeAlternative[]): TypeAlternative[] {
    const names = new Set<string>(alternatives.map(e => e.name));
    const types: TypeAlternative[] = [];

    for (const name of names) {
        const properties: Property[] = [];
        const ruleCalls = new Set<string>();
        const type = { name, properties, ruleCalls: <string[]>[], super: <string[]>[], hasAction: false };
        const namedAlternatives = alternatives.filter(e => e.name === name);
        for (const alt of namedAlternatives) {
            type.super.push(...alt.super);
            type.hasAction = type.hasAction || alt.hasAction;
            const altProperties = alt.properties;
            for (const altProperty of altProperties) {
                const existingProperty = properties.find(e => e.name === altProperty.name);
                if (existingProperty) {
                    existingProperty.optional = existingProperty.optional && altProperty.optional;
                    altProperty.typeAlternatives.filter(isNotInTypeAlternatives(existingProperty.typeAlternatives)).forEach(type => existingProperty.typeAlternatives.push(type));
                } else {
                    properties.push({ ...altProperty });
                }
            }
            if (altProperties.length === 0) {
                alt.ruleCalls.forEach(ruleCall => ruleCalls.add(ruleCall));
            }
        }
        type.ruleCalls = Array.from(ruleCalls);
        types.push(type);
    }

    return types;
}

function isNotInTypeAlternatives(typeAlternatives: PropertyType[]): (type: PropertyType) => boolean {
    return (type: PropertyType) => {
        return !typeAlternatives.some(e => comparePropertyType(e, type));
    };
}

function comparePropertyType(a: PropertyType, b: PropertyType): boolean {
    return a.array === b.array &&
        a.reference === b.reference &&
        compareLists(a.types, b.types);
}

function compareLists<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean = (x: T, y: T) => x === y): boolean {
    if (a.length !== b.length) return false;
    const distictAndSortedA = distictAndSorted(a);
    return distictAndSorted(b).every((e, i) => eq(e, distictAndSortedA[i]));
}

/**
 * Builds container types for given interfaces.
 * @param interfaces The interfaces that have to get container types.
 */
function buildContainerTypes(interfaces: InterfaceType[]): void {
    // 1st stage: collect container types & calculate sub-types
    for (const interfaceType of interfaces) {
        for (const typeName of interfaceType.properties.flatMap(property => property.typeAlternatives.filter(e => !e.reference).flatMap(e => e.types))) {
            interfaces.find(e => e.name === typeName)
                ?.containerTypes.push(interfaceType.name);
        }
        for (const superTypeName of interfaceType.superTypes) {
            interfaces.find(e => e.name === superTypeName)
                ?.subTypes.push(interfaceType.name);
        }
    }
    // 2nd stage: share container types
    const connectedComponents: InterfaceType[][] = [];
    calculateConnectedComponents(connectedComponents, interfaces);
    shareContainerTypes(connectedComponents);
}

function calculateConnectedComponents(connectedComponents: InterfaceType[][], interfaces: InterfaceType[]): void {
    function dfs(typeInterface: InterfaceType): InterfaceType[] {
        const component: InterfaceType[] = [typeInterface];
        visited.add(typeInterface.name);
        for (const nextTypeInterfaceName of typeInterface.subTypes.concat(typeInterface.superTypes)) {
            if (!visited.has(nextTypeInterfaceName)) {
                const nextTypeInterface = interfaces.find(e => e.name === nextTypeInterfaceName);
                if (nextTypeInterface) {
                    component.push(...dfs(nextTypeInterface));
                }
            }
        }
        return component;
    }

    const visited: Set<string> = new Set();
    for (const typeInterface of interfaces) {
        if (!visited.has(typeInterface.name)) {
            connectedComponents.push(dfs(typeInterface));
        }
    }
}

function shareContainerTypes(connectedComponents: InterfaceType[][]): void {
    for (const component of connectedComponents) {
        const containerTypes: string[] = [];
        component.forEach(type => containerTypes.push(...type.containerTypes));
        component.forEach(type => type.containerTypes = containerTypes);
    }
}

/**
 * Filters interfaces, transforming some of them in types.
 * The transformation criterion: no properties, but have subtypes.
 * @param interfaces The interfaces that have to be transformed on demand.
 * @returns Types and not transformed interfaces.
 */
function extractTypes(interfaces: InterfaceType[]): AstTypes {
    const astTypes: AstTypes = { interfaces: [], types: [] };
    const typeNames: string[] = [];
    for (const interfaceType of interfaces) {
        // the criterion for converting an interface into a type
        if (interfaceType.properties.length === 0 && interfaceType.subTypes.length > 0) {
            const alternatives = interfaceType.subTypes.map(e => <PropertyType>{
                types: [e],
                reference: false,
                array: false
            });
            const type = new TypeType(interfaceType.name, alternatives, { reflection: true });
            type.superTypes = interfaceType.superTypes;
            astTypes.types.push(type);
            typeNames.push(interfaceType.name);
        } else {
            astTypes.interfaces.push(interfaceType);
        }
    }
    // define printingSuperTypes containing intefaces that
    // became types from super types of their "former" children
    for (const interfaceType of astTypes.interfaces) {
        interfaceType.printingSuperTypes = (JSON.parse(JSON.stringify(interfaceType.superTypes)) as string[])
            .filter(superType => !typeNames.includes(superType));
    }
    return astTypes;
}
