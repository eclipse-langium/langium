/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import _ from 'lodash';
import { Cardinality, getRuleType, getTypeName, isOptional } from '../grammar/grammar-util';
import { AbstractElement, Action, Alternatives, Assignment, Group, isAction, isAlternatives, isAssignment, isCrossReference, isGroup, isKeyword, isParserRule, isRuleCall, isUnorderedGroup, ParserRule, RuleCall, UnorderedGroup } from '../grammar/generated/ast';
import { stream } from '../utils/stream';
import { AstTypes, compareFieldType, Field, FieldType, InterfaceType, TypeType } from './types-util';

type TypeAlternative = {
    name: string,
    super: string[],
    fields: Field[]
    ruleCalls: string[],
    hasAction: boolean
}

type TypeCollection = {
    types: string[],
    reference: boolean
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
        return Array.from(this.descendents.keys());
    }

    hasLeaves(type: TypeAlternative): boolean {
        return (this.descendents.get(type) ?? []).length > 0;
    }
}

class TypeCollectorState {
    tree: TypeTree = new TypeTree();
    types: TypeAlternative[] = [];
    cardinalities: Cardinality[] = [];
    parserRule?: ParserRule;
    currentType?: TypeAlternative;

    constructor(type?: TypeAlternative) {
        if (type) {
            this.tree.addRoot(type);
        }
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
    const state = new TypeCollectorState();
    const allTypes: TypeAlternative[] = [];
    for (const rule of parserRules) {
        state.parserRule = rule;
        const type = initType(rule);
        state.tree = new TypeTree();
        state.tree.addRoot(type);
        state.currentType = type;
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
        inferredTypes.types.push(new TypeType(rule.name, [<FieldType>{ types, reference: false, array: false }]));
    }

    return inferredTypes;
}

function initType(rule: ParserRule | string): TypeAlternative {
    return {
        name: isParserRule(rule) ? getTypeName(rule) : rule,
        super: [],
        fields: [],
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
        const [item] = state.tree.split(state.currentType, 2);
        state.currentType = item;
    }
    if (isAlternatives(element)) {
        const splits = state.tree.split(state.currentType, element.elements.length);
        for (let i = 0; i < splits.length; i++) {
            const item = element.elements[i];
            const splitType = splits[i];
            collectElement(state, splitType, item);
        }
    } else if (isGroup(element) || isUnorderedGroup(element)) {
        for (const item of element.elements) {
            const leaves = state.tree.getLeafNodesOf(type);
            for (const leaf of leaves) {
                collectElement(state, leaf, item);
            }
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
    let newType: TypeAlternative;
    const type = state.currentType;
    if (type) {
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
            newType.fields.push({
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
    state.currentType?.fields.push({
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
        // Add all fields of fragments to the current type
        if (isParserRule(rule) && rule.fragment) {
            const fragmentType = initType(rule);
            const fragmentState = new TypeCollectorState(fragmentType);
            collectElement(fragmentState, fragmentType, rule.alternatives);
            const types = calculateAst(fragmentState.tree.getLeafNodes());
            const foundType = types.find(e => e.name === rule.name);
            if (foundType) {
                type.fields.push(...foundType.fields);
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
        const interfaceType = new InterfaceType(flat.name, flat.super, flat.fields);
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
                    altField.typeAlternatives.filter(isNotInTypeAlternatives(existingField.typeAlternatives)).forEach(type => existingField.typeAlternatives.push(type));
                } else {
                    fields.push({ ...altField });
                }
            }
            if (altFields.length === 0) {
                alt.ruleCalls.forEach(ruleCall => ruleCalls.add(ruleCall));
            }
        }
        type.ruleCalls = Array.from(ruleCalls);
        types.push(type);
    }

    return types;
}

function isNotInTypeAlternatives(typeAlternatives: FieldType[]): (type: FieldType) => boolean {
    return (type: FieldType) => {
        return !typeAlternatives.some(e => compareFieldType(e, type));
    };
}

/**
 * Builds container types for given interfaces.
 * @param interfaces The interfaces that have to get container types.
 */
function buildContainerTypes(interfaces: InterfaceType[]): void {
    // 1st stage: collect container types & calculate sub-types
    for (const interfaceType of interfaces) {
        for (const typeName of interfaceType.fields.flatMap(field => field.typeAlternatives.filter(e => !e.reference).flatMap(e => e.types))) {
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
 * The transformation criterion: no fields, but have subtypes.
 * @param interfaces The interfaces that have to be transformed on demand.
 * @returns Types and not transformed interfaces.
 */
function extractTypes(interfaces: InterfaceType[]): AstTypes {
    const astTypes: AstTypes = { interfaces: [], types: [] };
    const typeNames: string[] = [];
    for (const interfaceType of interfaces) {
        // the criterion for converting an interface into a type
        if (interfaceType.fields.length === 0 && interfaceType.subTypes.length > 0) {
            const alternatives = interfaceType.subTypes.map(e => <FieldType>{
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
        interfaceType.printingSuperTypes = _.cloneDeep(interfaceType.superTypes)
            .filter(superType => !typeNames.includes(superType));
    }
    return astTypes;
}
