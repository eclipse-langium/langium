/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { isNamed } from '../../../references/name-provider';
import { MultiMap } from '../../../utils/collections';
import { stream } from '../../../utils/stream';
import { ParserRule, isAlternatives, isKeyword, Action, isParserRule, isAction, AbstractElement, isGroup, isUnorderedGroup, isAssignment, isRuleCall, Assignment, isCrossReference, RuleCall } from '../../generated/ast';
import { getExplicitRuleType, getTypeNameWithoutError, isOptionalCardinality, getRuleType } from '../../internal-grammar-util';
import { comparePropertyType } from '../types-util';
import { Property, AstTypes, UnionType, PropertyType, InterfaceType } from './types';

interface TypePart {
    name?: string
    properties: Property[]
    ruleCalls: string[]
    parents: TypePart[]
    children: TypePart[]
    actionWithAssignment: boolean
}

type TypeAlternative = {
    name: string
    super: string[]
    properties: Property[]
    ruleCalls: string[]
}

type TypeCollection = {
    types: Set<string>,
    reference: boolean
}

interface TypeCollectionContext {
    fragments: Map<ParserRule, Property[]>
}

interface TypePath {
    alt: TypeAlternative
    next: TypePart[]
}

class TypeGraph {
    context: TypeCollectionContext;
    root: TypePart;

    constructor(context: TypeCollectionContext, root: TypePart) {
        this.context = context;
        this.root = root;
    }

    getTypes(): TypePath[] {
        const rootType: TypeAlternative = {
            name: this.root.name!,
            properties: this.root.properties,
            ruleCalls: this.root.ruleCalls,
            super: []
        };
        if (this.root.children.length === 0) {
            return [{ alt: rootType, next: [] }];
        } else {
            return this.applyNext(this.root, {
                alt: rootType,
                next: this.root.children
            });
        }
    }

    private applyNext(root: TypePart, nextPath: TypePath): TypePath[] {
        const splits = this.splitType(nextPath.alt, nextPath.next.length);
        const paths: TypePath[] = [];
        for (let i = 0; i < nextPath.next.length; i++) {
            const split = splits[i];
            const part = nextPath.next[i];
            if (part.actionWithAssignment) {
                // If the path enters an action with an assignment which changes the current name
                // We already add a new path, since the next part of the part refers to a new inferred type
                paths.push({
                    alt: this.copyTypeAlternative(split),
                    next: []
                });
            }
            if (part.name !== undefined && part.name !== split.name) {
                if (part.actionWithAssignment) {
                    // We reset all properties, super types and ruleCalls since we are now in a new inferred type
                    split.properties = [];
                    split.ruleCalls = [];
                    split.super = [root.name!];
                    split.name = part.name;
                } else {
                    split.super = [split.name, ...split.ruleCalls];
                    split.properties = [];
                    split.ruleCalls = [];
                    split.name = part.name;
                }
            }
            split.properties.push(...part.properties);
            split.ruleCalls.push(...part.ruleCalls);
            const path: TypePath = {
                alt: split,
                next: part.children
            };
            if (path.next.length === 0) {
                path.alt.super = path.alt.super.filter(e => e !== path.alt.name);
                paths.push(path);
            } else {
                paths.push(...this.applyNext(root, path));
            }
        }
        return flattenTypes(paths);
    }

    private splitType(type: TypeAlternative, count: number): TypeAlternative[] {
        const alternatives: TypeAlternative[] = [];
        for (let i = 0; i < count; i++) {
            alternatives.push(this.copyTypeAlternative(type));
        }
        return alternatives;
    }

    private copyTypeAlternative(value: TypeAlternative): TypeAlternative {
        function copyProperty(value: Property): Property {
            return {
                name: value.name,
                optional: value.optional,
                typeAlternatives: value.typeAlternatives,
                astNodes: value.astNodes,
            };
        }
        return {
            name: value.name,
            super: value.super,
            ruleCalls: value.ruleCalls,
            properties: value.properties.map(e => copyProperty(e))
        };
    }

    getSuperTypes(node: TypePart): string[] {
        const set = new Set<string>();
        this.collectSuperTypes(node, node, set);
        return Array.from(set);
    }

    private collectSuperTypes(original: TypePart, part: TypePart, set: Set<string>): void {
        if (part.ruleCalls.length > 0) {
            // Each unassigned rule call corresponds to a super type
            for (const ruleCall of part.ruleCalls) {
                set.add(ruleCall);
            }
            return;
        }
        for (const parent of part.parents) {
            if (original.name === undefined) {
                this.collectSuperTypes(parent, parent, set);
            } else if (parent.name !== undefined && parent.name !== original.name) {
                set.add(parent.name);
            } else {
                this.collectSuperTypes(original, parent, set);
            }
        }
        if (part.parents.length === 0 && part.name) {
            set.add(part.name);
        }
    }

    connect(parent: TypePart, children: TypePart): TypePart {
        children.parents.push(parent);
        parent.children.push(children);
        return children;
    }

    merge(...parts: TypePart[]): TypePart {
        if (parts.length === 1) {
            return parts[0];
        } else if (parts.length === 0) {
            throw new Error('No parts to merge');
        }
        const node = newTypePart();
        node.parents = parts;
        for (const parent of parts) {
            parent.children.push(node);
        }
        return node;
    }
}

export function collectInferredTypes(parserRules: ParserRule[], datatypeRules: ParserRule[]): AstTypes {
    // extract interfaces and types from parser rules
    const allTypes: TypePath[] = [];
    const context: TypeCollectionContext = {
        fragments: new Map()
    };
    for (const rule of parserRules) {
        allTypes.push(...getRuleTypes(context, rule));
    }
    const interfaces = calculateInterfaces(allTypes);
    const unions = buildSuperUnions(interfaces);
    const astTypes = extractUnions(interfaces, unions);

    // extract types from datatype rules
    for (const rule of datatypeRules) {
        const types = isAlternatives(rule.definition) && rule.definition.elements.every(e => isKeyword(e)) ?
            stream(rule.definition.elements).filter(isKeyword).map(e => `'${e.value}'`).toArray() :
            [getExplicitRuleType(rule) ?? 'string'];
        astTypes.unions.push(new UnionType(rule.name, toPropertyType(false, false, types)));
    }
    return astTypes;
}

function getRuleTypes(context: TypeCollectionContext, rule: ParserRule): TypePath[] {
    const type = newTypePart(rule);
    const graph = new TypeGraph(context, type);
    if (rule.definition) {
        collectElement(graph, graph.root, rule.definition);
    }
    return graph.getTypes();
}

function newTypePart(element?: ParserRule | Action | string): TypePart {
    return {
        name: isParserRule(element) || isAction(element) ? getTypeNameWithoutError(element) : element,
        properties: [],
        ruleCalls: [],
        children: [],
        parents: [],
        actionWithAssignment: false
    };
}

/**
 * Collects all possible type branches of a given element.
 * @param state State to walk over element's graph.
 * @param type Element that collects a current type branch for the given element.
 * @param element The given AST element, from which it's necessary to extract the type.
 */
function collectElement(graph: TypeGraph, current: TypePart, element: AbstractElement): TypePart {
    const optional = isOptionalCardinality(element.cardinality);
    if (isAlternatives(element)) {
        const children: TypePart[] = [];
        if (optional) {
            // Create a new empty node
            children.push(graph.connect(current, newTypePart()));
        }
        for (const alt of element.elements) {
            const altType = graph.connect(current, newTypePart());
            children.push(collectElement(graph, altType, alt));
        }
        return graph.merge(...children);
    } else if (isGroup(element) || isUnorderedGroup(element)) {
        let groupNode = graph.connect(current, newTypePart());
        for (const item of element.elements) {
            groupNode = collectElement(graph, groupNode, item);
        }
        if (optional) {
            const skipNode = graph.connect(current, newTypePart());
            return graph.merge(skipNode, groupNode);
        } else {
            return groupNode;
        }
    } else if (isAction(element)) {
        return addAction(graph, current, element);
    } else if (isAssignment(element)) {
        addAssignment(current, element);
    } else if (isRuleCall(element)) {
        addRuleCall(graph, current, element);
    }
    return current;
}

function addAction(graph: TypeGraph, parent: TypePart, action: Action): TypePart {
    const typeNode = graph.connect(parent, newTypePart(action));

    if (action.type) {
        const type = action.type?.ref;
        if (type && isNamed(type))
            // cs: if the (named) type could be resolved properly also set the name on 'typeNode'
            //  for the sake of completeness and better comprehensibility during debugging,
            //  it's not supposed to have a effect on the flow of control!
            typeNode.name = type.name;
    }

    if (action.feature && action.operator) {
        typeNode.actionWithAssignment = true;
        typeNode.properties.push({
            name: action.feature,
            optional: false,
            typeAlternatives: toPropertyType(
                action.operator === '+=',
                false,
                graph.root.ruleCalls.length !== 0 ? graph.root.ruleCalls : graph.getSuperTypes(typeNode)),
            astNodes: new Set([action])
        });
    }
    return typeNode;
}

function addAssignment(current: TypePart, assignment: Assignment): void {
    const typeItems: TypeCollection = { types: new Set(), reference: false };
    findTypes(assignment.terminal, typeItems);

    const typeAlternatives: PropertyType[] = toPropertyType(
        assignment.operator === '+=',
        typeItems.reference,
        assignment.operator === '?=' ? ['boolean'] : Array.from(typeItems.types)
    );

    current.properties.push({
        name: assignment.feature,
        optional: isOptionalCardinality(assignment.cardinality),
        typeAlternatives,
        astNodes: new Set([assignment])
    });
}

function findTypes(terminal: AbstractElement, types: TypeCollection): void {
    if (isAlternatives(terminal) || isUnorderedGroup(terminal) || isGroup(terminal)) {
        for (const element of terminal.elements) {
            findTypes(element, types);
        }
    } else if (isKeyword(terminal)) {
        types.types.add(`'${terminal.value}'`);
    } else if (isRuleCall(terminal) && terminal.rule.ref) {
        types.types.add(getRuleType(terminal.rule.ref));
    } else if (isCrossReference(terminal) && terminal.type.ref) {
        types.types.add(getTypeNameWithoutError(terminal.type.ref));
        types.reference = true;
    }
}

function addRuleCall(graph: TypeGraph, current: TypePart, ruleCall: RuleCall): void {
    const rule = ruleCall.rule.ref;
    // Add all properties of fragments to the current type
    if (isParserRule(rule) && rule.fragment) {
        const properties = getFragmentProperties(rule, graph.context);
        if (isOptionalCardinality(ruleCall.cardinality)) {
            current.properties.push(...properties.map(e => ({
                ...e,
                optional: true
            })));
        } else {
            current.properties.push(...properties);
        }
    } else if (isParserRule(rule)) {
        current.ruleCalls.push(getRuleType(rule));
    }
}

function getFragmentProperties(fragment: ParserRule, context: TypeCollectionContext): Property[] {
    const existing = context.fragments.get(fragment);
    if (existing) {
        return existing;
    }
    const properties: Property[] = [];
    context.fragments.set(fragment, properties);
    const fragmentName = getTypeNameWithoutError(fragment);
    const typeAlternatives = getRuleTypes(context, fragment).filter(e => e.alt.name === fragmentName);
    properties.push(...typeAlternatives.flatMap(e => e.alt.properties));
    return properties;
}

/**
 * Calculate interfaces from all possible type branches.
 * [some of these interfaces will become types in the generated AST]
 * @param alternatives The type branches that will be squashed in interfaces.
 * @returns Interfaces.
 */
function calculateInterfaces(alternatives: TypePath[]): InterfaceType[] {
    const interfaces = new Map<string, InterfaceType>();
    const ruleCallAlternatives: TypeAlternative[] = [];
    const flattened = flattenTypes(alternatives).map(e => e.alt);

    for (const flat of flattened) {
        const interfaceType = new InterfaceType(flat.name, flat.super, flat.properties);
        interfaces.set(interfaceType.name, interfaceType);
        if (flat.ruleCalls.length > 0) {
            ruleCallAlternatives.push(flat);
            flat.ruleCalls.forEach(e => {
                if (e !== interfaceType.name) { // An interface cannot subtype itself
                    interfaceType.subTypes.add(e);
                }
            });
        }
        // all other cases assume we have a data type rule
        // we do not generate an AST type for data type rules
    }

    for (const ruleCallType of ruleCallAlternatives) {
        for (const ruleCall of ruleCallType.ruleCalls) {
            const calledInterface = interfaces.get(ruleCall);
            if (calledInterface) {
                if (calledInterface.name !== ruleCallType.name) {
                    calledInterface.realSuperTypes.add(ruleCallType.name);
                }
            }
        }
    }
    return Array.from(interfaces.values());
}

function flattenTypes(alternatives: TypePath[]): TypePath[] {
    const nameToAlternatives = alternatives.reduce((acc, e) => acc.add(e.alt.name, e), new MultiMap<string, TypePath>());
    const types: TypePath[] = [];

    for (const [name, namedAlternatives] of nameToAlternatives.entriesGroupedByKey()) {
        const properties: Property[] = [];
        const ruleCalls = new Set<string>();
        const type: TypePath = { alt: { name, properties, ruleCalls: [], super: [] }, next: [] };
        for (const path of namedAlternatives) {
            const alt = path.alt;
            type.alt.super.push(...alt.super);
            type.next.push(...path.next);
            const altProperties = alt.properties;
            for (const altProperty of altProperties) {
                const existingProperty = properties.find(e => e.name === altProperty.name);
                if (existingProperty) {
                    altProperty.typeAlternatives
                        .filter(isNotInTypeAlternatives(existingProperty.typeAlternatives))
                        .forEach(type => existingProperty.typeAlternatives.push(type));
                    altProperty.astNodes.forEach(e => existingProperty.astNodes.add(e));
                } else {
                    properties.push({ ...altProperty });
                }
            }
            alt.ruleCalls.forEach(ruleCall => ruleCalls.add(ruleCall));
        }
        for (const path of namedAlternatives) {
            const alt = path.alt;
            // A type with rule calls is not a real member of the type
            // Any missing properties are therefore not associated with the current type
            if (alt.ruleCalls.length === 0) {
                for (const property of properties) {
                    if (!alt.properties.find(e => e.name === property.name)) {
                        property.optional = true;
                    }
                }
            }
        }
        type.alt.ruleCalls = Array.from(ruleCalls);
        types.push(type);
    }

    return types;
}

function isNotInTypeAlternatives(typeAlternatives: PropertyType[]): (type: PropertyType) => boolean {
    return (type: PropertyType) => {
        return !typeAlternatives.some(e => comparePropertyType(e, type));
    };
}

function buildSuperUnions(interfaces: InterfaceType[]): UnionType[] {
    const unions: UnionType[] = [];
    const allSupertypes = new MultiMap<string, string>();
    for (const interfaceType of interfaces) {
        for (const superType of interfaceType.realSuperTypes) {
            allSupertypes.add(superType, interfaceType.name);
        }
    }
    for (const [superType, types] of allSupertypes.entriesGroupedByKey()) {
        if (!interfaces.some(e => e.name === superType)) {
            unions.push(new UnionType(
                superType,
                toPropertyType(false, false, types),
                { reflection: true }
            ));
        }
    }

    return unions;
}

/**
 * Filters interfaces, transforming some of them in unions.
 * The transformation criterion: no properties, but have subtypes.
 * @param interfaces The interfaces that have to be transformed on demand.
 * @returns Types and not transformed interfaces.
 */
function extractUnions(interfaces: InterfaceType[], unions: UnionType[]): AstTypes {
    for (const interfaceType of interfaces) {
        for (const superTypeName of interfaceType.realSuperTypes) {
            interfaces.find(e => e.name === superTypeName)
                ?.subTypes.add(interfaceType.name);
        }
    }

    const astTypes: AstTypes = { interfaces: [], unions };
    const typeNames = new Set<string>(unions.map(e => e.name));
    for (const interfaceType of interfaces) {
        // the criterion for converting an interface into a type
        if (interfaceType.properties.length === 0 && interfaceType.subTypes.size > 0) {
            const alternatives: PropertyType[] = toPropertyType(false, false, Array.from(interfaceType.subTypes));
            const existingUnion = unions.find(e => e.name === interfaceType.name);
            if (existingUnion) {
                existingUnion.alternatives.push(...alternatives);
            } else {
                const type = new UnionType(interfaceType.name, alternatives, { reflection: true });
                type.realSuperTypes = interfaceType.realSuperTypes;
                astTypes.unions.push(type);
                typeNames.add(interfaceType.name);
            }
        } else {
            astTypes.interfaces.push(interfaceType);
        }
    }
    // After converting some interfaces into union types, these interfaces are no longer valid super types
    for (const interfaceType of astTypes.interfaces) {
        interfaceType.printingSuperTypes = [...interfaceType.realSuperTypes].filter(superType => !typeNames.has(superType));
    }
    return astTypes;
}

function toPropertyType(array: boolean, reference: boolean, types: string[]): PropertyType[] {
    if (array || reference) {
        return [{ array, reference, types }];
    }
    return types.map(type => { return {
        array, reference, types: [type]
    }; });
}
