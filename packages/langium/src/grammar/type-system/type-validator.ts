/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Grammar, Interface, ParserRule, Type } from '../generated/ast';
import { getRuleType } from '../grammar-util';
import { MultiMap } from '../../utils/collections';
import { collectDeclaredTypes } from './declared-types';
import { collectInferredTypes } from './inferred-types';
import { AstTypes, collectAllAstResources, distictAndSorted, Property, PropertyType, propertyTypeArrayToString, InterfaceType, TypeType } from './types-util';
import { stream } from '../../utils/stream';
import { ValidationAcceptor } from '../../validation/validation-registry';
import { extractAssignments } from '../../utils/ast-util';

export function validateTypes(grammar: Grammar, accept: ValidationAcceptor): void {
    function applyErrorToRuleNodes(nodes: readonly ParserRule[], typeName: string): (errorMessage: string) => void {
        return (errorMessage: string) => {
            nodes.forEach(node => accept('error',
                errorMessage + ` in inferred type '${typeName}'.`,
                { node: node?.type ? node.type : node, property: 'name' }
            ));
        };
    }

    function applyErrorToAssignment(nodes: readonly ParserRule[]): (propertyName: string, errorMessage: string) => void {
        const assignmentNodes = nodes.flatMap(node => extractAssignments(node.alternatives));
        return (propertyName: string, errorMessage: string) => {
            const node = assignmentNodes.find(assignment => assignment.feature === propertyName);
            if (node) {
                accept('error',
                    `A property '${propertyName}' ` + errorMessage,
                    { node, property: 'feature' }
                );
            }
        };
    }

    const validationResources = collectValidationResources(grammar);
    for (const [typeName, typeInfo] of validationResources.entries()) {
        if (!isInferredAndDeclared(typeInfo)) continue;
        const errorToRuleNodes = applyErrorToRuleNodes(typeInfo.nodes, typeName);
        const errorToAssignment = applyErrorToAssignment(typeInfo.nodes);

        if (isType(typeInfo.inferred) && isType(typeInfo.declared)) {
            checkAlternativesConsistency(typeInfo.inferred.alternatives, typeInfo.declared.alternatives, errorToRuleNodes);
        } else if (isInterface(typeInfo.inferred) && isInterface(typeInfo.declared)) {
            checkPropertiesConsistency(typeInfo.inferred.properties, typeInfo.declared.properties, errorToRuleNodes, errorToAssignment);
            checkSuperTypesConsistency(typeInfo.inferred.superTypes, typeInfo.declared.superTypes, errorToRuleNodes);
        } else {
            const specificError = `Inferred and declared versions of type ${typeName} have to be types or interfaces both.`;
            typeInfo.nodes.forEach(node => accept('error', specificError,
                { node: node?.type ? node.type : node, property: 'name' }
            ));
            accept('error', specificError,
                { node: typeInfo.node, property: 'name' }
            );
        }
    }
}

type TypeOrInterface = TypeType | InterfaceType;

function isType(type: TypeOrInterface): type is TypeType {
    return type && 'alternatives' in type;
}

function isInterface(type: TypeOrInterface): type is InterfaceType {
    return type && 'properties' in type;
}

type InferredInfo = {
    inferred: TypeOrInterface;
    nodes: readonly ParserRule[];
}

type DeclaredInfo = {
    declared: TypeOrInterface;
    node: Type | Interface;
}

function isInferredAndDeclared(type: InferredInfo | DeclaredInfo | InferredInfo & DeclaredInfo): type is InferredInfo & DeclaredInfo {
    return type && 'inferred' in type && 'declared' in type;
}

type ValidationResources = Map<string, InferredInfo | DeclaredInfo | InferredInfo & DeclaredInfo>;

export function collectValidationResources(grammar: Grammar): ValidationResources {
    const astResources = collectAllAstResources([grammar]);

    const inferred = collectInferredTypes(Array.from(astResources.parserRules), Array.from(astResources.datatypeRules));
    const typeNameToRules = stream(astResources.parserRules)
        .concat(astResources.datatypeRules)
        .reduce((acc, rule) => acc.add(getRuleType(rule), rule),
            new MultiMap<string, ParserRule>()
        );
    const inferredInfo = mergeTypesAndInterfaces(inferred)
        .reduce((acc, type) => acc.set(type.name, { inferred: type, nodes: typeNameToRules.get(type.name) }),
            new Map<string, InferredInfo>()
        );

    const declared = collectDeclaredTypes(Array.from(astResources.interfaces), Array.from(astResources.types), inferred);
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

function mergeTypesAndInterfaces(astTypes: AstTypes): TypeOrInterface[] {
    return (astTypes.interfaces as TypeOrInterface[]).concat(astTypes.types);
}

type ErrorInfo = {
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
        propertyTypeList.reduce((acc, e) => acc.set(distictAndSorted(e.types).join(' | '), e), new Map<string, PropertyType>());

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

    // detects lack of type alternatives
    for (const [typeString, ] of stream(stringToExpected)) {
        if (!stringToFound.has(typeString)) {
            errorsInfo.push({ typeString, errorMessage: 'is expected' });
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

function checkPropertiesConsistency(inferred: Property[], declared: Property[],
    errorToRuleNodes: (error: string) => void, errorToAssignment: (propertyName: string, error: string) => void): void {

    const baseError = (propertyName: string, foundType: string, expectedType: string) =>
        `has type '${foundType}', but '${expectedType}' is expected.`;

    const optError = (found: Property, expected: Property) =>
        found.optional && !expected.optional ? 'can\'t be optional' :
            !found.optional && expected.optional ? 'has to be optional' : '';

    // detects extra properties & check matched ones on consistency by 'opional'
    for (const foundProperty of inferred) {
        const expectedProperty = declared.find(e => foundProperty.name === e.name);
        if (expectedProperty) {
            const foundStringType = propertyTypeArrayToString(foundProperty.typeAlternatives);
            const expectedStringType = propertyTypeArrayToString(expectedProperty.typeAlternatives);
            if (foundStringType !== expectedStringType) {
                let resultError = baseError(foundProperty.name, foundStringType, expectedStringType);
                for (const errorInfo of checkAlternativesConsistencyHelper(foundProperty.typeAlternatives, expectedProperty.typeAlternatives)) {
                    resultError = resultError + ` '${errorInfo.typeString}' ${errorInfo.errorMessage};`;
                }
                resultError = resultError.replace(/;$/, '.');
                errorToAssignment(foundProperty.name, resultError);
            }

            if (expectedProperty.optional !== foundProperty.optional) {
                errorToAssignment(foundProperty.name, `${optError(foundProperty, expectedProperty)}.`);
            }
        } else {
            errorToAssignment(foundProperty.name, 'is not expected.');
        }
    }

    // detects lack of properties
    for (const foundProperty of declared) {
        const expectedProperty = inferred.find(e => foundProperty.name === e.name);
        if (!expectedProperty) {
            errorToRuleNodes(`A property '${foundProperty.name}' is expected`);
        }
    }
}

function checkSuperTypesConsistency(inferred: string[], declared: string[], errorToRuleNodes: (error: string) => void): void {
    const specificError = (superType: string, isExtra: boolean) => `A super type '${superType}' is ${isExtra ? 'not ' : ''}expected`;

    inferred
        .filter(e => !declared.includes(e))
        .forEach(extraSuperType => errorToRuleNodes(specificError(extraSuperType, true)));

    declared
        .filter(e => !inferred.includes(e))
        .forEach(lackSuperType => errorToRuleNodes(specificError(lackSuperType, false)));
}
