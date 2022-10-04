/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Grammar, Interface, ParserRule, Type } from '../generated/ast';
import { MultiMap } from '../../utils/collections';
import { collectDeclaredTypes } from './declared-types';
import { collectInferredTypes } from './inferred-types';
import { AstTypes, collectAllAstResources, distinctAndSorted, Property, PropertyType, propertyTypeArrayToString, InterfaceType, UnionType, AstResources } from './types-util';
import { stream } from '../../utils/stream';
import { ValidationAcceptor } from '../../validation/validation-registry';
import { extractAssignments, getRuleType } from '../internal-grammar-util';

export function validateTypesConsistency(grammar: Grammar, accept: ValidationAcceptor): void {
    function applyErrorToRuleNodes(nodes: readonly ParserRule[], typeName: string): (errorMessage: string) => void {
        return (errorMessage: string) => {
            nodes.forEach(node => accept('error',
                errorMessage + ` in a rule that returns type '${typeName}'.`,
                { node: node?.inferredType ? node.inferredType : node, property: 'name' }
            ));
        };
    }

    // Report missing assignments for required properties in offending nodes
    function applyMissingAssignmentErrorToRuleNodes(nodes: readonly ParserRule[], typeName: string): (propertyName: string, errorMessage: string) => void {
        return (propertyName: string, errorMessage: string) => {
            nodes.forEach(node => {
                const assignments = extractAssignments(node.definition);
                if (assignments.find(a => a.feature === propertyName) === undefined) {
                    accept(
                        'error',
                        errorMessage + ` in rule '${node.name}', but is required in type '${typeName}'.`,
                        {node, property: 'parameters'});
                }
            });
        };
    }

    const validationResources = collectValidationResources(grammar);
    const propertyMap = new MultiMap<string, Property>();
    for (const [typeName, typeInfo] of validationResources.entries()) {
        if ('declared' in typeInfo && isInterface(typeInfo.declared)) {
            propertyMap.addAll(typeName, collectAllSuperProperties(typeInfo.declared, 'declared', validationResources).values());
        }
    }
    for (const [typeName, typeInfo] of validationResources.entries()) {

        if ('declared' in typeInfo) {
            checkConsistentlyDeclaredType(typeInfo, propertyMap, accept);
        }

        if (!isInferredAndDeclared(typeInfo)) continue;
        const errorToRuleNodes = applyErrorToRuleNodes(typeInfo.nodes, typeName);
        const errorToInvalidRuleNodes = applyMissingAssignmentErrorToRuleNodes(typeInfo.nodes, typeName);
        const errorToAssignment = applyErrorToAssignment(typeInfo.nodes, accept);

        if (isType(typeInfo.inferred) && isType(typeInfo.declared)) {
            checkAlternativesConsistency(typeInfo.inferred.union, typeInfo.declared.union, errorToRuleNodes);
        } else if (isInterface(typeInfo.inferred) && isInterface(typeInfo.declared)) {
            const inferredProps = collectAllSuperProperties(typeInfo.inferred, 'inferred', validationResources);
            const declaredProps = collectAllSuperProperties(typeInfo.declared, 'declared', validationResources);
            checkPropertiesConsistency(inferredProps, declaredProps, errorToRuleNodes, errorToAssignment, errorToInvalidRuleNodes);
        } else {
            const specificError = `Inferred and declared versions of type ${typeName} both have to be interfaces or unions.`;
            typeInfo.nodes.forEach(node => accept('error', specificError,
                { node: node?.inferredType ? node.inferredType : node, property: 'name' }
            ));
            accept('error', specificError,
                { node: typeInfo.node, property: 'name' }
            );
        }
    }
}

function checkConsistentlyDeclaredType(declaredInfo: DeclaredInfo, properties: MultiMap<string, Property>, accept: ValidationAcceptor): void {
    const declaredType = declaredInfo.declared;
    if (!isInterface(declaredType)) {
        return;
    }
    const allSuperTypes = declaredType.interfaceSuperTypes;
    for (let i = 0; i < allSuperTypes.length; i++) {
        for (let j = i + 1; j < allSuperTypes.length; j++) {
            const outerType = allSuperTypes[i];
            const innerType = allSuperTypes[j];
            const outerProps = properties.get(outerType);
            const innerProps = properties.get(innerType);
            const nonIdentical = getNonIdenticalProps(outerProps, innerProps);
            if (nonIdentical.length > 0) {
                accept('error', `Cannot simultaneously inherit from '${outerType}' and '${innerType}'. Their ${nonIdentical.map(e => "'" + e + "'").join(', ')} properties are not identical.`, {
                    node: declaredInfo.node,
                    property: 'name'
                });
            }
        }
    }
    const allSuperProps = new Set<string>();
    for (const superType of allSuperTypes) {
        const props = properties.get(superType);
        for (const prop of props) {
            allSuperProps.add(prop.name);
        }
    }
    for (const ownProp of declaredType.properties) {
        if (allSuperProps.has(ownProp.name)) {
            const interfaceNode = declaredInfo.node as Interface;
            const propNode = interfaceNode.attributes.find(e => e.name === ownProp.name);
            if (propNode) {
                accept('error', `Cannot redeclare property '${ownProp.name}'. It is already inherited from another interface.`, {
                    node: propNode,
                    property: 'name'
                });
            }
        }
    }
}

function getNonIdenticalProps(a: readonly Property[], b: readonly Property[]): string[] {
    const nonIdentical: string[] = [];
    for (const outerProp of a) {
        const innerProp = b.find(e => e.name === outerProp.name);
        if (innerProp && !arePropTypesIdentical(outerProp, innerProp)) {
            nonIdentical.push(outerProp.name);
        }
    }
    return nonIdentical;
}

function arePropTypesIdentical(a: Property, b: Property): boolean {
    if (a.optional !== b.optional) {
        return false;
    }
    if (a.typeAlternatives.length !== b.typeAlternatives.length) {
        return false;
    }
    for (const firstTypes of a.typeAlternatives) {
        let found = false;
        for (const otherTypes of b.typeAlternatives) {
            if (otherTypes.array === firstTypes.array
                && otherTypes.reference === firstTypes.reference
                && otherTypes.types.length === firstTypes.types.length
                && otherTypes.types.every(e => firstTypes.types.includes(e))) {
                found = true;
            }
        }
        if (!found) {
            return false;
        }
    }
    return true;
}

function collectAllSuperProperties(
    type: InterfaceType,
    mode: 'inferred' | 'declared',
    resources: ValidationResources,
    map: MultiMap<string, Property> = new MultiMap(),
    visitedTypes: Set<string> = new Set()
): MultiMap<string, Property> {
    if (visitedTypes.has(type.name)) {
        return map;
    }
    visitedTypes.add(type.name);
    const typeProps = type.properties;
    for (const property of typeProps) {
        map.add(property.name, property);
    }
    for (const superType of type.interfaceSuperTypes) {
        const typeInfo = resources.get(superType) as InferredInfo & DeclaredInfo;
        const type = typeInfo?.[mode];
        if (isInterface(type)) {
            collectAllSuperProperties(type, mode, resources, map, visitedTypes);
        }
    }

    return map;
}

export function applyErrorToAssignment(nodes: readonly ParserRule[], accept: ValidationAcceptor): (propertyName: string, errorMessage: string) => void {
    const assignmentNodes = nodes.flatMap(node => extractAssignments(node.definition));
    return (propertyName: string, errorMessage: string) => {
        const node = assignmentNodes.find(assignment => assignment.feature === propertyName);
        if (node) {
            accept('error',
                errorMessage,
                { node, property: 'feature' }
            );
        }
    };
}

type TypeOption = UnionType | InterfaceType;

function isType(type: TypeOption): type is UnionType {
    return type && 'union' in type;
}

function isInterface(type: TypeOption): type is InterfaceType {
    return type && 'properties' in type;
}

interface InferredInfo {
    inferred: TypeOption;
    nodes: readonly ParserRule[];
}

interface DeclaredInfo {
    declared: TypeOption;
    node: Type | Interface;
}

function isInferredAndDeclared(type: InferredInfo | DeclaredInfo | InferredInfo & DeclaredInfo): type is InferredInfo & DeclaredInfo {
    return type && 'inferred' in type && 'declared' in type;
}

type ValidationResources = Map<string, InferredInfo | DeclaredInfo | InferredInfo & DeclaredInfo>;

export function collectValidationResources(grammar: Grammar): ValidationResources {
    const astResources = collectAllAstResources([grammar]);
    const inferred = collectInferredTypes(Array.from(astResources.parserRules), Array.from(astResources.datatypeRules));
    const declared = collectDeclaredTypes(Array.from(astResources.interfaces), Array.from(astResources.types), inferred);

    const typeNameToRules = getTypeNameToRules(astResources);
    const inferredInfo = mergeTypesAndInterfaces(inferred)
        .reduce((acc, type) => acc.set(type.name, { inferred: type, nodes: typeNameToRules.get(type.name) }),
            new Map<string, InferredInfo>()
        );

    const allTypesInfo = mergeTypesAndInterfaces(declared)
        .reduce((acc, type) => {
            const node = stream(astResources.types).find(e => e.name === type.name) ??
                stream(astResources.interfaces).find(e => e.name === type.name);
            if (node) {
                const inferred = inferredInfo.get(type.name);
                acc.set(type.name, inferred ? {...inferred, declared: type, node } : { declared: type, node });
            }
            return acc;
        }, new Map<string, InferredInfo | DeclaredInfo | InferredInfo & DeclaredInfo>());

    return allTypesInfo;
}

function getTypeNameToRules(astResources: AstResources): MultiMap<string, ParserRule> {
    return stream(astResources.parserRules)
        .concat(astResources.datatypeRules)
        .reduce((acc, rule) => acc.add(getRuleType(rule), rule),
            new MultiMap<string, ParserRule>()
        );
}

function mergeTypesAndInterfaces(astTypes: AstTypes): TypeOption[] {
    return (astTypes.interfaces as TypeOption[]).concat(astTypes.unions);
}

interface ErrorInfo {
    errorMessage: string;
    typeString: string;
}

const arrRefError = (found: PropertyType, expected: PropertyType) =>
    found.array && !expected.array && found.reference && !expected.reference ? 'can\'t be an array and a reference' :
        !found.array && expected.array && !found.reference && expected.reference ? 'has to be an array and a reference' :
            found.array && !expected.array ? 'can\'t be an array' :
                !found.array && expected.array ? 'has to be an array' :
                    found.reference && !expected.reference ? 'can\'t be a reference' :
                        !found.reference && expected.reference ? 'has to be a reference' : '';

function checkAlternativesConsistencyHelper(found: PropertyType[], expected: PropertyType[]): ErrorInfo[] {
    const stringToPropertyTypeList = (propertyTypeList: PropertyType[]) =>
        propertyTypeList.reduce((acc, e) => acc.set(distinctAndSorted(e.types).join(' | '), e), new Map<string, PropertyType>());

    const stringToFound = stringToPropertyTypeList(found);
    const stringToExpected = stringToPropertyTypeList(expected);
    const errorsInfo: ErrorInfo[] = [];

    // detects extra type alternatives & check matched ones on consistency by 'array' and 'reference'
    for (const [typeString, foundPropertyType] of stream(stringToFound)) {
        const expectedPropertyType = stringToExpected.get(typeString);
        if (!expectedPropertyType) {
            errorsInfo.push({ typeString, errorMessage: 'is not expected' });
        } else if (expectedPropertyType.array !== foundPropertyType.array || expectedPropertyType.reference !== foundPropertyType.reference) {
            errorsInfo.push({ typeString, errorMessage: arrRefError(foundPropertyType, expectedPropertyType) });
        }
    }

    return errorsInfo;
}

function checkAlternativesConsistency(inferred: PropertyType[], declared: PropertyType[], errorToRuleNodes: (error: string) => void): void {
    const errorsInfo = checkAlternativesConsistencyHelper(inferred, declared);
    for (const errorInfo of errorsInfo) {
        errorToRuleNodes(`A type '${errorInfo.typeString}' ${errorInfo.errorMessage}`);
    }
}

function checkPropertiesConsistency(
    inferred: MultiMap<string, Property>,
    declared: MultiMap<string, Property>,
    errorToRuleNodes: (error: string) => void,
    errorToAssignment: (propertyName: string, error: string) => void,
    errorToInvalidRuleNodes: (propertyName: string, error: string) => void
): void {

    const baseError = (propertyName: string, foundType: string, expectedType: string) =>
        `The assigned type '${foundType}' is not compatible with the declared property '${propertyName}' of type '${expectedType}'.`;

    const checkOptional = (found: Property, expected: Property) =>
        !(found.typeAlternatives.length === 1 && found.typeAlternatives[0].array ||
            expected.typeAlternatives.length === 1 && expected.typeAlternatives[0].array);

    // detects extra properties & check matched ones on consistency by 'optional'
    for (const propName of inferred.keys()) {
        const foundProperties = inferred.get(propName);
        const foundProperty = foundProperties[0];
        const expectedProperties = declared.get(propName);
        const expectedProperty = expectedProperties[0];
        if (expectedProperty) {
            const foundStringType = propertyTypeArrayToString(foundProperty.typeAlternatives);
            const expectedStringType = propertyTypeArrayToString(expectedProperty.typeAlternatives);
            if (foundStringType !== expectedStringType) {
                const typeAlternativesErrors = checkAlternativesConsistencyHelper(foundProperty.typeAlternatives, expectedProperty.typeAlternatives);
                if (typeAlternativesErrors.length > 0) {
                    let resultError = baseError(foundProperty.name, foundStringType, expectedStringType);
                    for (const errorInfo of typeAlternativesErrors) {
                        resultError = resultError + ` '${errorInfo.typeString}' ${errorInfo.errorMessage};`;
                    }
                    resultError = resultError.replace(/;$/, '.');
                    errorToAssignment(foundProperty.name, resultError);
                }
            }

            if (checkOptional(foundProperty, expectedProperty) && !expectedProperty.optional && foundProperty.optional) {
                errorToInvalidRuleNodes(foundProperty.name, `Property '${foundProperty.name}' is missing`);
            }
        } else {
            errorToAssignment(foundProperty.name, `A property '${foundProperty.name}' is not expected.`);
        }
    }

    // detects lack of properties
    for (const [property, expectedProperties] of declared.entriesGroupedByKey()) {
        const foundProperty = inferred.get(property);
        if (foundProperty.length === 0 && !expectedProperties.some(e => e.optional)) {
            errorToRuleNodes(`A property '${property}' is expected`);
        }
    }
}

export type InterfaceInfo = {
    type: InterfaceType;
    node: Interface | readonly ParserRule[];
}

// use only after type consistancy validation
export function collectAllInterfaces(grammar: Grammar): Map<string, InterfaceInfo> {
    const astResources = collectAllAstResources([grammar]);
    const inferred = collectInferredTypes(Array.from(astResources.parserRules), Array.from(astResources.datatypeRules));
    const declared = collectDeclaredTypes(Array.from(astResources.interfaces), Array.from(astResources.types), inferred);

    const typeNameToRules = getTypeNameToRules(astResources);
    const inferredInterfaces = inferred.interfaces
        .reduce((acc, type) => acc.set(type.name, { type, node: typeNameToRules.get(type.name) }),
            new Map<string, InterfaceInfo>()
        );

    return declared.interfaces
        .reduce((acc, type) => {
            if (!acc.has(type.name)) {
                const node = stream(astResources.interfaces).find(e => e.name === type.name);
                if (node) acc.set(type.name, { type, node });
            }
            return acc;
        }, inferredInterfaces);
}
