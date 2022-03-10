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
import { AstTypes, collectAllAstResources, distictAndSorted, Field, FieldType, fieldTypeArrayToString, InterfaceType, TypeType } from './types-util';
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

    function applyErrorToAssignment(nodes: readonly ParserRule[]): (fieldName: string, errorMessage: string) => void {
        const assignmentNodes = nodes.flatMap(node => extractAssignments(node.alternatives));
        return (fieldName: string, errorMessage: string) => {
            const node = assignmentNodes.find(assignment => assignment.feature === fieldName);
            if (node) {
                accept('error',
                    `A field '${fieldName}' ` + errorMessage,
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
            checkFieldsConsistency(typeInfo.inferred.fields, typeInfo.declared.fields, errorToRuleNodes, errorToAssignment);
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
    return type && 'fields' in type;
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

const arrRefError = (found: FieldType, expected: FieldType) =>
    found.array && !expected.array && found.reference && !expected.reference ? 'can\'t be an array and a reference' :
        !found.array && expected.array && !found.reference && expected.reference ? 'has to be an array and a reference' :
            found.array && !expected.array ? 'can\'t be an array' :
                !found.array && expected.array ? 'has to be an array' :
                    found.reference && !expected.reference ? 'can\'t be a reference' :
                        !found.reference && expected.reference ? 'has to be a reference' : '';

function checkAlternativesConsistencyHelper(found: FieldType[], expected: FieldType[]): ErrorInfo[] {
    const stringToFieldTypeList = (fieldTypeList: FieldType[]) =>
        fieldTypeList.reduce((acc, e) => acc.set(distictAndSorted(e.types).join(' | '), e), new Map<string, FieldType>());

    const stringToFound = stringToFieldTypeList(found);
    const stringToExpected = stringToFieldTypeList(expected);
    const errorsInfo: ErrorInfo[] = [];

    // detects extra type alternatives & check matched ones on consistency by 'array' and 'reference' properties
    for (const [typeString, foundFieldType] of stream(stringToFound)) {
        const expectedFieldType = stringToExpected.get(typeString);
        if (!expectedFieldType) {
            errorsInfo.push({ typeString, errorMessage: 'is not expected' });
        } else if (expectedFieldType.array !== foundFieldType.array || expectedFieldType.reference !== foundFieldType.reference) {
            errorsInfo.push({ typeString, errorMessage: arrRefError(foundFieldType, expectedFieldType) });
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

function checkAlternativesConsistency(inferred: FieldType[], declared: FieldType[], errorToRuleNodes: (error: string) => void): void {
    const errorsInfo = checkAlternativesConsistencyHelper(inferred, declared);
    for (const errorInfo of errorsInfo) {
        errorToRuleNodes(`A type '${errorInfo.typeString}' ${errorInfo.errorMessage}`);
    }
}

function checkFieldsConsistency(inferred: Field[], declared: Field[],
    errorToRuleNodes: (error: string) => void, errorToAssignment: (fieldName: string, error: string) => void): void {

    const baseError = (fieldName: string, foundType: string, expectedType: string) =>
        `has type '${foundType}', but '${expectedType}' is expected.`;

    const optError = (found: Field, expected: Field) =>
        found.optional && !expected.optional ? 'can\'t be optional' :
            !found.optional && expected.optional ? 'has to be optional' : '';

    // detects extra fields & check matched ones on consistency by 'opional' property
    for (const foundField of inferred) {
        const expectedField = declared.find(e => foundField.name === e.name);
        if (expectedField) {
            const foundStringType = fieldTypeArrayToString(foundField.typeAlternatives);
            const expectedStringType = fieldTypeArrayToString(expectedField.typeAlternatives);
            if (foundStringType !== expectedStringType) {
                let resultError = baseError(foundField.name, foundStringType, expectedStringType);
                for (const errorInfo of checkAlternativesConsistencyHelper(foundField.typeAlternatives, expectedField.typeAlternatives)) {
                    resultError = resultError + ` '${errorInfo.typeString}' ${errorInfo.errorMessage};`;
                }
                resultError = resultError.replace(/;$/, '.');
                errorToAssignment(foundField.name, resultError);
            }

            if (expectedField.optional !== foundField.optional) {
                errorToAssignment(foundField.name, `${optError(foundField, expectedField)}.`);
            }
        } else {
            errorToAssignment(foundField.name, 'is not expected.');
        }
    }

    // detects lack of fields
    for (const foundField of declared) {
        const expectedField = inferred.find(e => foundField.name === e.name);
        if (!expectedField) {
            errorToRuleNodes(`A field '${foundField.name}' is expected`);
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
