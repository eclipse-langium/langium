/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import _ from 'lodash';
import * as langium from 'langium';
import { CompositeGeneratorNode, getDocument, getRuleType, getTypeName, IndentNode, isDataTypeRule, isOptional, LangiumDocuments, NL, processGeneratorNode, resolveImport, stream } from 'langium';
import { URI } from 'vscode-uri';

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

export type AstTypes = {
    interfaces: Interface[];
    types: Type[];
    // todo remove sourceInterfaces
    sourceInterfaces: Interface[];
}

export type AstResources = {
    parserRules: Set<langium.ParserRule>,
    datatypeRules: Set<langium.ParserRule>,
    interfaces: Set<langium.Interface>,
    types: Set<langium.Type>
}

export class Type {
    name: string;
    alternatives: string[];
    reflection: boolean;

    constructor(name: string, alternatives: string[], options?: { reflection: boolean }) {
        this.name = name;
        this.alternatives = alternatives;
        this.reflection = options?.reflection ?? false;
    }

    toString(): string {
        const typeNode = new CompositeGeneratorNode();
        typeNode.contents.push(`export type ${this.name} = ${distictUniqueSorted(this.alternatives).join(' | ')};`, NL);

        if (this.reflection) pushReflectionInfo(this.name, typeNode);
        return processGeneratorNode(typeNode);
    }
}

export class Interface {
    name: string;
    superTypes: string[];
    subTypes: string[] = [];
    containerTypes: string[] = [];
    fields: Field[];

    constructor(name: string, superTypes: string[], fields: Field[]) {
        this.name = name;
        this.superTypes = superTypes;
        this.fields = fields;
    }

    toString(): string {
        const interfaceNode = new CompositeGeneratorNode();
        const superTypes = this.superTypes.length > 0 ? distictUniqueSorted(this.superTypes) : ['AstNode'];
        interfaceNode.contents.push(`export interface ${this.name} extends ${superTypes.join(', ')} {`, NL);

        const fieldsNode = new IndentNode();
        if (this.containerTypes.length > 0) {
            fieldsNode.contents.push(`readonly $container: ${distictUniqueSorted(this.containerTypes).join(' | ')};`, NL);
        }

        for (const field of distictUniqueSorted(this.fields, (a, b) => a.name.localeCompare(b.name))) {
            const optional = field.optional && field.reference && !field.array ? '?' : '';
            const type = typeInfoToString(field.types, field.reference, field.array);
            fieldsNode.contents.push(`${field.name}${optional}: ${type}`, NL);
        }
        interfaceNode.contents.push(fieldsNode, '}', NL);

        pushReflectionInfo(this.name, interfaceNode);
        return processGeneratorNode(interfaceNode);
    }
}

function distictUniqueSorted<T>(list: T[], compareFn?: (a: T, b: T) => number): T[] {
    return stream(list).distinct().toArray().sort(compareFn);
}

function typeInfoToString(types: string | string[], reference: boolean, array: boolean): string {
    let res = Array.isArray(types) ? distictUniqueSorted(types).join(' | ') : types;
    res = reference ? `Reference<${res}>` : res;
    res = array ? `Array<${res}>` : res;
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

class StateCollector {
    tree: TypeTree = new TypeTree();
    types: TypeAlternative[] = [];
    cardinalities: langium.Cardinality[] = [];
    parserRule?: langium.ParserRule;
    currentType?: TypeAlternative;

    constructor(type?: TypeAlternative) {
        if (type) {
            this.tree.addRoot(type);
        }
    }

    enterGroup(cardinality: langium.Cardinality): void {
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
 * The types collector entry point. Collects types for the generated AST.
 * @param documents Documents to resolve imports that were used in the given grammars.
 * @param grammars Grammars for which it's necessary to build an AST.
 */
export function collectAst(documents: LangiumDocuments, grammars: langium.Grammar[]): AstTypes {
    // collect rules, types, interfaces from grammars
    const astResources = collectAllAstResources(documents, grammars);

    // extract interfaces and types from parser rules
    const state = new StateCollector();
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
    sortInterfaces(interfaces);
    const astTypes = extractTypes(interfaces);

    // extract types from datatype rules
    for (const rule of Array.from(astResources.datatypeRules)) {
        if (langium.isAlternatives(rule.alternatives) && rule.alternatives.elements.every(e => langium.isKeyword(e))) {
            const alternatives = stream(rule.alternatives.elements).filter(langium.isKeyword).map(e => `'${e.value}'`).toArray();
            astTypes.types.push(new Type(rule.name, alternatives));
        } else {
            astTypes.types.push(new Type(rule.name, [rule.type?.name ?? 'string']));
        }
    }

    function getOneType(type: langium.AtomType): string {
        return type.refType?.ref?.name ?? type.primitiveType ?? `'${type.keywordType?.value}'`;
    }

    // add types
    for (const type of Array.from(astResources.types)) {
        const alternatives = type.typeAlternatives.map(e => typeInfoToString(getOneType(e), e.isRef, e.isArray));
        const reflection = type.typeAlternatives.some(e =>
            e.refType?.ref && langium.isParserRule(e.refType?.ref) && !isDataTypeRule(e.refType?.ref));
        astTypes.types.push(new Type(type.name, alternatives, { reflection }));
    }

    // add interfaces
    for (const interfaceType of Array.from(astResources.interfaces)) {
        const superTypes = interfaceType.superTypes.map(e => e.ref?.name).filter(e => typeof e === 'string') as string[];
        const fields: Field[] = interfaceType.attributes.map(e => <Field>{
            name: e.name,
            array: e.type.isArray,
            optional: e.isOptional,
            types: [getOneType(e.type)],
            reference: e.type.isRef
        });
        astTypes.interfaces.push(new Interface(interfaceType.name, superTypes, fields));
    }

    return astTypes;
}

function collectAllAstResources(documents: LangiumDocuments, grammars: langium.Grammar[], visited: Set<URI> = new Set(),
    astResources: AstResources = { parserRules: new Set(), datatypeRules: new Set(), interfaces: new Set(), types: new Set() }): AstResources {

    for (const grammar of grammars) {
        const doc = getDocument(grammar);
        if (visited.has(doc.uri)) {
            continue;
        }
        visited.add(doc.uri);
        for (const rule of grammar.rules) {
            if (langium.isParserRule(rule) && !rule.fragment) {
                isDataTypeRule(rule) ? astResources.datatypeRules.add(rule) : astResources.parserRules.add(rule);
            }
        }
        grammar.interfaces.forEach(e => astResources.interfaces.add(e));
        grammar.types.forEach(e => astResources.types.add(e));

        const importedGrammars = grammar.imports.map(e => resolveImport(documents, e)!);
        collectAllAstResources(documents, importedGrammars, visited, astResources);
    }
    return astResources;
}

function initType(rule: langium.ParserRule | string): TypeAlternative {
    return {
        name: langium.isParserRule(rule) ? getTypeName(rule) : rule,
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
function collectElement(state: StateCollector, type: TypeAlternative, element: langium.AbstractElement): void {
    state.currentType = type;
    state.enterGroup(element.cardinality);
    if (isOptional(element.cardinality)) {
        const [item] = state.tree.split(state.currentType, 2);
        state.currentType = item;
    }
    if (langium.isAlternatives(element)) {
        const splits = state.tree.split(state.currentType, element.elements.length);
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
        addAction(state, element);
    } else if (langium.isAssignment(element)) {
        addAssignment(state, element);
    } else if (langium.isRuleCall(element)) {
        addRuleCall(state, element);
    }
    state.leaveGroup();
}

function addAction(state: StateCollector, action: langium.Action): void {
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
                array: action.operator === '+=',
                optional: false,
                reference: false,
                types: [getTypeName(state.parserRule)]
            });
        }
    }
}

function addAssignment(state: StateCollector, assignment: langium.Assignment): void {
    const typeItems: TypeCollection = { types: [], reference: false };
    findTypes(assignment.terminal, typeItems);
    state.currentType?.fields.push({
        name: assignment.feature,
        array: assignment.operator === '+=',
        optional: isOptional(assignment.cardinality) || state.isOptional(),
        types: assignment.operator === '?=' ? ['boolean'] : Array.from(new Set(typeItems.types)),
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
        types.types.push(getTypeName(terminal.type.ref));
        types.reference = true;
    }
}

function findInCollection(collection: langium.Alternatives | langium.Group | langium.UnorderedGroup, types: TypeCollection): void {
    for (const element of collection.elements) {
        findTypes(element, types);
    }
}

function addRuleCall(state: StateCollector, ruleCall: langium.RuleCall): void {
    const rule = ruleCall.rule.ref;
    const type = state.currentType;
    if (type) {
        // Add all fields of fragments to the current type
        if (langium.isParserRule(rule) && rule.fragment) {
            const fragmentType = initType(rule);
            const fragmentState = new StateCollector(fragmentType);
            collectElement(fragmentState, fragmentType, rule.alternatives);
            const types = calculateAst(fragmentState.tree.getLeafNodes());
            const foundType = types.find(e => e.name === rule.name);
            if (foundType) {
                type.fields.push(...foundType.fields);
            }
        } else if (langium.isParserRule(rule)) {
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
function calculateAst(alternatives: TypeAlternative[]): Interface[] {
    const interfaces: Interface[] = [];
    const ruleCallAlternatives: TypeAlternative[] = [];
    const flattened = flattenTypes(alternatives);

    for (const flat of flattened) {
        const interfaceType = new Interface(flat.name, flat.super, flat.fields);
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
            interfaces.push(new Interface(ruleCallType.name, ruleCallType.super, []));
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
                    const typeSet = new Set(existingField.types);
                    altField.types.forEach(type => typeSet.add(type));
                    existingField.types = Array.from(typeSet);
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

/**
 * Builds container types for given interfaces.
 * @param interfaces The interfaces that have to get container types.
 */
function buildContainerTypes(interfaces: Interface[]): void {
    // 1st stage: collect container types & calculate sub-types
    for (const interfaceType of interfaces) {
        for (const field of interfaceType.fields.filter(e => !e.reference)) {
            for (const fieldTypeName of field.types) {
                interfaces.find(e => e.name === fieldTypeName)
                    ?.containerTypes.push(interfaceType.name);
            }
        }
        for (const superTypeName of interfaceType.superTypes) {
            interfaces.find(e => e.name === superTypeName)
                ?.subTypes.push(interfaceType.name);
        }
    }
    // 2nd stage: share container types
    const connectedComponents: Interface[][] = [];
    calculateConnectedComponents(connectedComponents, interfaces);
    shareContainerTypes(connectedComponents);
}

function calculateConnectedComponents(connectedComponents: Interface[][], interfaces: Interface[]): void {
    function dfs(typeInterface: Interface): Interface[] {
        const component: Interface[] = [typeInterface];
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

function shareContainerTypes(connectedComponents: Interface[][]): void {
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
function extractTypes(interfaces: Interface[]): AstTypes {
    const astTypes: AstTypes = { interfaces: [], types: [], sourceInterfaces: _.cloneDeep(interfaces) };
    const typeNames: string[] = [];
    for (const interfaceType of interfaces) {
        if (interfaceType.fields.length === 0 && interfaceType.subTypes.length > 0) {
            astTypes.types.push(new Type(interfaceType.name, interfaceType.subTypes, { reflection: true }));
            typeNames.push(interfaceType.name);
        } else {
            astTypes.interfaces.push(interfaceType);
        }
    }
    // remove interfaces that became types from super types of their "former" children
    for (const interfaceType of astTypes.interfaces) {
        interfaceType.superTypes = interfaceType.superTypes.filter(superType => !typeNames.includes(superType));
    }
    return astTypes;
}

/**
 * Performs topological sorting on the generated interfaces.
 * @param interfaces The interfaces to sort topologically.
 * @returns A topologically sorted set of interfaces.
 */
function sortInterfaces(interfaces: Interface[]): Interface[] {
    type TypeNode = {
        value: Interface;
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