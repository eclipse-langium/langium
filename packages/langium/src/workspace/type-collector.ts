/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import _ from 'lodash';
import { URI } from 'vscode-uri';
import { Cardinality, getRuleType, getTypeName, isDataTypeRule, isOptional, resolveImport } from '../grammar/grammar-util';
import { AbstractElement, Action, Alternatives, Assignment, AtomType, Grammar, Group, Interface, isAction, isAlternatives, isAssignment, isCrossReference, isGroup, isKeyword, isParserRule, isRuleCall, isUnorderedGroup, ParserRule, RuleCall, Type, UnorderedGroup } from '../grammar/generated/ast';
import { CompositeGeneratorNode, IndentNode, NL } from '../generator/generator-node';
import { processGeneratorNode } from '../generator/node-processor';
import { LangiumDocuments } from './documents';
import { stream } from '../utils/stream';
import { MultiMap } from '../utils/collections';
import { getDocument } from '../utils/ast-util';

type TypeAlternative = {
    name: string,
    super: string[],
    fields: Field[]
    ruleCalls: string[],
    hasAction: boolean
}

type Field = {
    name: string,
    optional: boolean,
    typeAlternatives: FieldType[]
}

type FieldType = {
    types: string[],
    reference: boolean,
    array: boolean
}

type TypeCollection = {
    types: string[],
    reference: boolean
}

type AstResources = {
    parserRules: Set<ParserRule>,
    datatypeRules: Set<ParserRule>,
    interfaces: Set<Interface>,
    types: Set<Type>
}

export type AstTypes = {
    interfaces: InterfaceType[];
    types: TypeType[];
}

export type InferredDeclaredTypes = {
    inferred: AstTypes,
    declared: AstTypes
}

export class TypeType {
    name: string;
    alternatives: FieldType[];
    reflection: boolean;
    superTypes: string[] = [];

    constructor(name: string, alternatives: FieldType[], options?: { reflection: boolean }) {
        this.name = name;
        this.alternatives = alternatives;
        this.reflection = options?.reflection ?? false;
    }

    toString(): string {
        const typeNode = new CompositeGeneratorNode();
        typeNode.contents.push(`export type ${this.name} = ${fieldTypeArrayToString(this.alternatives)};`, NL);

        if (this.reflection) pushReflectionInfo(this.name, typeNode);
        return processGeneratorNode(typeNode);
    }

    compare(type: TypeType): boolean {
        return this.name === type.name &&
            this.reflection === type.reflection &&
            compareLists(this.superTypes, type.superTypes) &&
            compareLists(this.alternatives, type.alternatives, compareFieldType);
    }
}

function compareFieldType(a: FieldType, b: FieldType): boolean {
    return a.array === b.array &&
        a.reference === b.reference &&
        compareLists(a.types, b.types);
}

function compareLists<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean = (x: T, y: T) => x === y): boolean {
    if (a.length !== b.length) return false;
    const distictAndSortedA = distictAndSorted(a);
    return distictAndSorted(b).every((e, i) => eq(e, distictAndSortedA[i]));
}

function fieldTypeArrayToString(alternatives: FieldType[]): string {
    return distictAndSorted(alternatives.map(typeFieldToString)).join(' | ');
}

export class InterfaceType {
    name: string;
    superTypes: string[];
    printingSuperTypes: string[];
    subTypes: string[] = [];
    containerTypes: string[] = [];
    fields: Field[];

    constructor(name: string, superTypes: string[], fields: Field[]) {
        this.name = name;
        this.superTypes = superTypes;
        this.printingSuperTypes = _.cloneDeep(superTypes);
        this.fields = fields;
    }

    toString(): string {
        const interfaceNode = new CompositeGeneratorNode();
        const superTypes = this.printingSuperTypes.length > 0 ? distictAndSorted(this.printingSuperTypes) : ['AstNode'];
        interfaceNode.contents.push(`export interface ${this.name} extends ${superTypes.join(', ')} {`, NL);

        const fieldsNode = new IndentNode();
        if (this.containerTypes.length > 0) {
            fieldsNode.contents.push(`readonly $container: ${distictAndSorted(this.containerTypes).join(' | ')};`, NL);
        }

        for (const field of distictAndSorted(this.fields, (a, b) => a.name.localeCompare(b.name))) {
            const optional = field.optional && field.typeAlternatives.some(e => e.reference) && !field.typeAlternatives.some(e => e.array) ? '?' : '';
            const type = fieldTypeArrayToString(field.typeAlternatives);
            fieldsNode.contents.push(`${field.name}${optional}: ${type}`, NL);
        }
        interfaceNode.contents.push(fieldsNode, '}', NL);

        pushReflectionInfo(this.name, interfaceNode);
        return processGeneratorNode(interfaceNode);
    }

    compare(type: InterfaceType): boolean {
        return this.name === type.name &&
        compareLists(this.superTypes, type.superTypes) &&
        compareLists(this.fields, type.fields, (x, y) =>
            x.name === y.name &&
            x.optional === y.optional &&
            compareLists(x.typeAlternatives, y.typeAlternatives, compareFieldType)
        );
    }
}

function distictAndSorted<T>(list: T[], compareFn?: (a: T, b: T) => number): T[] {
    return Array.from(new Set(list)).sort(compareFn);
}

function typeFieldToString(fieldType: FieldType): string {
    let res = distictAndSorted(fieldType.types).join(' | ');
    res = fieldType.reference ? `Reference<${res}>` : res;
    res = fieldType.array ? `Array<${res}>` : res;
    return res;
}

function pushReflectionInfo(name: string, node: CompositeGeneratorNode) {
    node.contents.push(NL, `export const ${name} = '${name}';`, NL, NL);
    node.contents.push(`export function is${name}(item: unknown): item is ${name} {`, NL);
    const methodBody = new IndentNode();
    methodBody.contents.push(`return reflection.isInstance(item, ${name});`, NL);
    node.contents.push(methodBody, '}', NL);
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

/**
 * Collects all types for the generated AST. The types collector entry point.
 * @param documents Documents to resolve imports that were used in the given grammars.
 * @param grammars Grammars for which it's necessary to build an AST.
 */
export function collectAst(documents: LangiumDocuments, grammars: Grammar[]): AstTypes {
    const astResources = collectAllAstResources(grammars, documents);
    const inferred = collectInferredTypes(astResources);
    const declared = collectDeclaredTypes(astResources, inferred);

    const interfaces = inferred.interfaces.concat(declared.interfaces);
    const types = inferred.types.concat(declared.types);

    sortInterfaces(interfaces);
    types.sort((a, b) => a.name.localeCompare(b.name));

    return {
        interfaces: stream(interfaces).distinct(e => e.name).toArray(),
        types: stream(types).distinct(e => e.name).toArray(),
    };
}

/**
 * Collects declared and inferred types for the generated AST separately. The types collector entry point.
 * @param grammars Grammars that necessary to validate.
 */
export function collectAstForValidation(grammar: Grammar): InferredDeclaredTypes {
    const astResources = collectAllAstResources([grammar]);
    const inferred = collectInferredTypes(astResources);
    return {
        inferred,
        declared: collectDeclaredTypes(astResources, inferred)
    };
}

function collectInferredTypes(astResources: AstResources): AstTypes {
    // extract interfaces and types from parser rules
    const state = new TypeCollectorState();
    const allTypes: TypeAlternative[] = [];
    for (const rule of Array.from(astResources.parserRules)) {
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
    for (const rule of Array.from(astResources.datatypeRules)) {
        const types = isAlternatives(rule.alternatives) && rule.alternatives.elements.every(e => isKeyword(e)) ?
            stream(rule.alternatives.elements).filter(isKeyword).map(e => `'${e.value}'`).toArray() :
            [rule.type?.name ?? 'string'];
        inferredTypes.types.push(new TypeType(rule.name, [<FieldType>{ types, reference: false, array: false }]));
    }

    return inferredTypes;
}

function collectDeclaredTypes(astResources: AstResources, inferredTypes: AstTypes): AstTypes {
    const declaredTypes: AstTypes = {types: [], interfaces: []};
    // add interfaces
    for (const interfaceType of Array.from(astResources.interfaces)) {
        const superTypes = interfaceType.superTypes.map(e => getTypeName(e.ref));
        const fields: Field[] = interfaceType.attributes.map(e => <Field>{
            name: e.name,
            optional: e.isOptional === true,
            typeAlternatives: e.typeAlternatives.map(atomTypeToFieldType)
        });
        declaredTypes.interfaces.push(new InterfaceType(interfaceType.name, superTypes, fields));
    }

    // add types
    const childToSuper = new MultiMap<string, string>();
    for (const type of Array.from(astResources.types)) {
        const alternatives = type.typeAlternatives.map(atomTypeToFieldType);
        const reflection = type.typeAlternatives.some(e => {
            const refType = e.refType?.ref;
            return refType && (isParserRule(refType) && !isDataTypeRule(refType) || isAction(refType));
        });
        declaredTypes.types.push(new TypeType(type.name, alternatives, { reflection }));

        for (const maybeRef of type.typeAlternatives) {
            if (maybeRef.refType) {
                childToSuper.add(getTypeName(maybeRef.refType.ref), type.name);
            }
        }
    }
    for (const child of childToSuper.keys()) {
        const childType = inferredTypes.types.find(e => e.name === child) ??
            inferredTypes.interfaces.find(e => e.name === child) ??
            declaredTypes.types.find(e => e.name === child) ??
            declaredTypes.interfaces.find(e => e.name === child);
        if (childType) {
            childToSuper.get(child).map(superType => childType.superTypes.push(superType));
        }
    }

    return declaredTypes;
}

function collectAllAstResources(grammars: Grammar[], documents?: LangiumDocuments, visited: Set<URI> = new Set(),
    astResources: AstResources = { parserRules: new Set(), datatypeRules: new Set(), interfaces: new Set(), types: new Set() }): AstResources {

    for (const grammar of grammars) {
        const doc = getDocument(grammar);
        if (visited.has(doc.uri)) {
            continue;
        }
        visited.add(doc.uri);
        for (const rule of grammar.rules) {
            if (isParserRule(rule) && !rule.fragment) {
                if (isDataTypeRule(rule)) {
                    astResources.datatypeRules.add(rule);
                } else {
                    astResources.parserRules.add(rule);
                }
            }
        }
        grammar.interfaces.forEach(e => astResources.interfaces.add(e));
        grammar.types.forEach(e => astResources.types.add(e));

        if (documents) {
            const importedGrammars = grammar.imports.map(e => resolveImport(documents, e)!);
            collectAllAstResources(importedGrammars, documents, visited, astResources);
        }
    }
    return astResources;
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

function atomTypeToFieldType(type: AtomType): FieldType {
    return {
        types: [type.refType ? getTypeName(type.refType.ref) : (type.primitiveType ?? `'${type.keywordType?.value}'`)],
        reference: type.isRef === true,
        array: type.isArray === true
    };
}

/**
 * Performs topological sorting on the generated interfaces.
 * @param interfaces The interfaces to sort topologically.
 * @returns A topologically sorted set of interfaces.
 */
function sortInterfaces(interfaces: InterfaceType[]): InterfaceType[] {
    type TypeNode = {
        value: InterfaceType;
        nodes: TypeNode[];
    }

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
            nodes
                .filter(e => e.nodes.includes(n))
                .forEach(m => s.push(m));
        }
    }
    return l.map(e => e.value);
}
