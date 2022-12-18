/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { MultiMap } from '../../utils/collections';
import { DiagnosticInfo, ValidationAcceptor, ValidationChecks } from '../../validation/validation-registry';
import * as ast from '../generated/ast';
import { extractAssignments } from '../internal-grammar-util';
import { LangiumGrammarServices } from '../langium-grammar-module';
import { InterfaceType, isInterfaceType, isUnionType, Property, PropertyType, propertyTypesToString } from '../type-system/type-collector/types';
import { distinctAndSorted } from '../type-system/types-util';
import { DeclaredInfo, InferredInfo, isDeclared, isInferred, isInferredAndDeclared, LangiumGrammarDocument, TypeToValidationInfo } from '../workspace/documents';

export function registerTypeValidationChecks(services: LangiumGrammarServices): void {
    const registry = services.validation.ValidationRegistry;
    const typesValidator = services.validation.LangiumGrammarTypesValidator;
    const checks: ValidationChecks<ast.LangiumGrammarAstType> = {
        Action: [
            typesValidator.checkActionIsNotUnionType,
        ],
        Grammar: [
            typesValidator.checkDeclaredTypesConsistency,
            typesValidator.checkDeclaredAndInferredTypesConsistency,
        ],
    };
    registry.register(checks, typesValidator);
}

export class LangiumGrammarTypesValidator {

    checkDeclaredTypesConsistency(grammar: ast.Grammar, accept: ValidationAcceptor): void {
        const validationResources = (grammar.$document as LangiumGrammarDocument)?.validationResources;
        if (validationResources) {
            for (const typeInfo of validationResources.typeToValidationInfo.values()) {
                if (isDeclared(typeInfo) && isInterfaceType(typeInfo.declared) && ast.isInterface(typeInfo.declaredNode)) {
                    const declInterface = typeInfo as { declared: InterfaceType, declaredNode: ast.Interface };
                    validateInterfaceSuperTypes(declInterface, validationResources.typeToValidationInfo, accept);
                    validateSuperTypesConsistency(declInterface, validationResources.typeToSuperProperties, accept);
                }
            }
        }
    }

    checkDeclaredAndInferredTypesConsistency(grammar: ast.Grammar, accept: ValidationAcceptor): void {
        const validationResources = (grammar.$document as LangiumGrammarDocument)?.validationResources;
        if (validationResources) {
            for (const typeInfo of validationResources.typeToValidationInfo.values()) {
                if(isInferred(typeInfo) && typeInfo.inferred instanceof InterfaceType) {
                    validateInferredInterface(typeInfo.inferred as InterfaceType, accept);
                }
                if (isInferredAndDeclared(typeInfo)) {
                    validateDeclaredAndInferredConsistency(typeInfo, validationResources.typeToAliases, accept);
                }
            }
        }
    }

    checkActionIsNotUnionType(action: ast.Action, accept: ValidationAcceptor): void {
        if (ast.isType(action.type)) {
            accept('error', 'Actions cannot create union types.', { node: action, property: 'type' });
        }
    }
}

///////////////////////////////////////////////////////////////////////////////

function validateInferredInterface(inferredInterface: InterfaceType, accept: ValidationAcceptor): void {
    inferredInterface.properties.filter(prop => prop.typeAlternatives.length > 1).forEach(prop => {
        const typeKind = (type: PropertyType) => type.reference ? 'ref' : 'other';
        const firstKind = typeKind(prop.typeAlternatives[0]);
        if (prop.typeAlternatives.slice(1).some(type => typeKind(type) !== firstKind)) {
            const targetNode = prop.astNodes.values().next().value;
            if(targetNode) {
                accept(
                    'error',
                    `Mixing a cross-reference with other types is not supported. Consider splitting property "${prop.name}" into two or more different properties.`,
                    { node: targetNode }
                );
            }
        }
    });
}

function validateInterfaceSuperTypes(
    { declared, declaredNode }: { declared: InterfaceType, declaredNode: ast.Interface },
    validationInfo: TypeToValidationInfo,
    accept: ValidationAcceptor): void {

    declared.printingSuperTypes.forEach((superTypeName, i) => {
        const superType = validationInfo.get(superTypeName);
        if (superType) {
            if (isInferred(superType) && isUnionType(superType.inferred) || isDeclared(superType) && isUnionType(superType.declared)) {
                accept('error', 'Interfaces cannot extend union types.', { node: declaredNode, property: 'superTypes', index: i });
            }
            if (isInferred(superType) && !isDeclared(superType)) {
                accept('error', 'Extending an inferred type is discouraged.', { node: declaredNode, property: 'superTypes', index: i });
            }
        }
    });
}

function validateSuperTypesConsistency(
    { declared, declaredNode }: { declared: InterfaceType, declaredNode: ast.Interface},
    properties: Map<string, Property[]>,
    accept: ValidationAcceptor): void {

    const nameToProp = declared.properties.reduce((acc, e) => acc.add(e.name, e), new MultiMap<string, Property>());
    for (const [name, props] of nameToProp.entriesGroupedByKey()) {
        if (props.length > 1) {
            for (const prop of props) {
                accept('error', `Cannot have two properties with the same name '${name}'.`, {
                    node: Array.from(prop.astNodes)[0],
                    property: 'name'
                });
            }
        }
    }

    const allSuperTypes = declared.printingSuperTypes;
    for (let i = 0; i < allSuperTypes.length; i++) {
        for (let j = i + 1; j < allSuperTypes.length; j++) {
            const outerType = allSuperTypes[i];
            const innerType = allSuperTypes[j];
            const outerProps = properties.get(outerType) ?? [];
            const innerProps = properties.get(innerType) ?? [];
            const nonIdentical = getNonIdenticalProps(outerProps, innerProps);
            if (nonIdentical.length > 0) {
                accept('error', `Cannot simultaneously inherit from '${outerType}' and '${innerType}'. Their ${nonIdentical.map(e => "'" + e + "'").join(', ')} properties are not identical.`, {
                    node: declaredNode,
                    property: 'name'
                });
            }
        }
    }
    const allSuperProps = new Set<string>();
    for (const superType of allSuperTypes) {
        const props = properties.get(superType) ?? [];
        for (const prop of props) {
            allSuperProps.add(prop.name);
        }
    }
    for (const ownProp of declared.properties) {
        if (allSuperProps.has(ownProp.name)) {
            const interfaceNode = declaredNode as ast.Interface;
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
    if (a.optional !== b.optional || a.typeAlternatives.length !== b.typeAlternatives.length) {
        return false;
    }
    for (const firstTypes of a.typeAlternatives) {
        const found = b.typeAlternatives.some(otherTypes => {
            return otherTypes.array === firstTypes.array
                && otherTypes.reference === firstTypes.reference
                && otherTypes.types.length === firstTypes.types.length
                && otherTypes.types.every(e => firstTypes.types.includes(e));
        });
        if (!found) return false;
    }
    return true;
}

function validateDeclaredAndInferredConsistency(typeInfo: InferredInfo & DeclaredInfo, typeToAliases: Map<string, Set<string>>, accept: ValidationAcceptor) {
    const { inferred, declared, declaredNode, inferredNodes } = typeInfo;
    const typeName = declared.name;

    const applyErrorToRulesAndActions = (msgPostfix?: string) => (errorMsg: string) =>
        inferredNodes.forEach(node => accept('error',
            `${errorMsg[-1] === '.' ? errorMsg.slice(0, -1) : errorMsg}${msgPostfix ? ` ${msgPostfix}` : ''}.`,
            (node?.inferredType) ?
                <DiagnosticInfo<ast.InferredType, string>>{ node: node?.inferredType, property: 'name' } :
                <DiagnosticInfo<ast.ParserRule | ast.Action | ast.InferredType, string>>{ node, property: ast.isAction(node) ? 'type' : 'name' }
        ));

    const applyErrorToProperties = (nodes: Set<ast.Assignment | ast.Action | ast.TypeAttribute>, errorMessage: string) =>
        nodes.forEach(node =>
            accept('error', errorMessage, { node, property: ast.isAssignment(node) || ast.isAction(node) ? 'feature' : 'name' })
        );

    // currently we don't track which assignments belong to which actions and can't apply this error
    const applyMissingPropErrorToRules = (missingProp: string) => {
        inferredNodes.forEach(node => {
            if (ast.isParserRule(node)) {
                const assignments = extractAssignments(node.definition);
                if (assignments.find(e => e.feature === missingProp) === undefined) {
                    accept('error',
                        `Property '${missingProp}' is missing in a rule '${node.name}', but is required in type '${typeName}'.`,
                        {node, property: 'parameters'}
                    );
                }
            }
        });
    };

    if (isUnionType(inferred) && isUnionType(declared)) {
        validateAlternativesConsistency(inferred.alternatives, declared.alternatives,
            typeToAliases,
            applyErrorToRulesAndActions(`in a rule that returns type '${typeName}'`),
        );
    } else if (isInterfaceType(inferred) && isInterfaceType(declared)) {
        validatePropertiesConsistency(inferred.superProperties, declared.superProperties,
            typeToAliases,
            applyErrorToRulesAndActions(`in a rule that returns type '${typeName}'`),
            applyErrorToProperties,
            applyMissingPropErrorToRules
        );
    } else {
        const errorMessage = `Inferred and declared versions of type '${typeName}' both have to be interfaces or unions.`;
        applyErrorToRulesAndActions()(errorMessage);
        accept('error', errorMessage, { node: declaredNode, property: 'name' });
    }
}

type ErrorInfo = {
    errorMessage: string;
    typeAsString: string;
}

function validateAlternativesConsistency(inferred: PropertyType[], declared: PropertyType[],
    typeToAliases: Map<string, Set<string>>,
    applyErrorToInferredTypes: (errorMessage: string) => void) {

    const errorsInfo = checkAlternativesConsistencyHelper(inferred, declared, typeToAliases);
    for (const errorInfo of errorsInfo) {
        applyErrorToInferredTypes(`A type '${errorInfo.typeAsString}' ${errorInfo.errorMessage}`);
    }
}

function getAllAliases(expected: PropertyType, typeToAliases: Map<string, Set<string>>): string[] {
    const allAliases = expected.types.map(typeName => Array.from(typeToAliases.get(typeName) ?? new Set([typeName])));
    let branches: string[][] = [];
    for (const aliasGroup of allAliases) {
        if (branches.length === 0) {
            branches.push([]);
        }
        if (aliasGroup.length === 1) {
            branches.forEach(branch => branch.push(aliasGroup[0]));
        } else {
            const backup_branches = JSON.parse(JSON.stringify(branches));
            branches = [];
            for (const alias of aliasGroup) {
                const alias_branches: string[][] = JSON.parse(JSON.stringify(backup_branches));
                alias_branches.forEach(alias_branch => alias_branch.push(alias));
                branches.push(...alias_branches);
            }
        }
    }
    return branches.map(branch => distinctAndSorted(branch).join(' | '));
}

function typeAsStringKeywordsReplacement(found: PropertyType): string {
    const propTypeWithStr = found.types.filter(e => !e.startsWith('\''));
    propTypeWithStr.push('string');
    return distinctAndSorted(propTypeWithStr).join(' | ');
}

function checkAlternativesConsistencyHelper(found: PropertyType[], expected: PropertyType[], typeToAliases: Map<string, Set<string>>): ErrorInfo[] {
    const arrayReferenceError = (found: PropertyType, expected: PropertyType) =>
        found.array && !expected.array && found.reference && !expected.reference ? 'can\'t be an array and a reference' :
            !found.array && expected.array && !found.reference && expected.reference ? 'has to be an array and a reference' :
                found.array && !expected.array ? 'can\'t be an array' :
                    !found.array && expected.array ? 'has to be an array' :
                        found.reference && !expected.reference ? 'can\'t be a reference' :
                            !found.reference && expected.reference ? 'has to be a reference' : '';

    const stringToFound = found.reduce((acc, propType) => acc.set(distinctAndSorted(propType.types).join(' | '), propType),
        new Map<string, PropertyType>());

    const stringToExpected = expected.reduce((acc, propType) => {
        getAllAliases(propType, typeToAliases).forEach(alias => acc.set(alias, propType));
        return acc;
    }, new Map<string, PropertyType>());
    const errorsInfo: ErrorInfo[] = [];

    // detects extra type alternatives & check matched ones on consistency by 'array' and 'reference'
    for (const [typeAsString, foundPropertyType] of stringToFound) {
        const expectedPropertyType = stringToExpected.get(typeAsString) ?? stringToExpected.get(typeAsStringKeywordsReplacement(foundPropertyType));
        if (!expectedPropertyType) {
            errorsInfo.push({ typeAsString, errorMessage: 'is not expected' });
        } else if (expectedPropertyType.array !== foundPropertyType.array || expectedPropertyType.reference !== foundPropertyType.reference) {
            errorsInfo.push({ typeAsString, errorMessage: arrayReferenceError(foundPropertyType, expectedPropertyType) });
        }
    }
    return errorsInfo;
}

function validatePropertiesConsistency(inferred: MultiMap<string, Property>, declared: MultiMap<string, Property>,
    typeToAliases: Map<string, Set<string>>,
    applyErrorToType: (errorMessage: string) => void,
    applyErrorToProperties: (nodes: Set<ast.Assignment | ast.Action | ast.TypeAttribute>, errorMessage: string) => void,
    applyMissingPropErrorToRules: (missingProp: string) => void
) {
    const areBothNotArrays = (found: Property, expected: Property) =>
        !(found.typeAlternatives.length === 1 && found.typeAlternatives[0].array) &&
            !(expected.typeAlternatives.length === 1 && expected.typeAlternatives[0].array);

    // detects extra properties & validates matched ones on consistency by the 'optional' property
    for (const [name, foundProps] of inferred.entriesGroupedByKey()) {
        const foundProp = foundProps[0];
        const expectedProp = declared.get(name)[0];
        if (expectedProp) {
            const foundTypeAsStr = propertyTypesToString(foundProp.typeAlternatives);
            const expectedTypeAsStr = propertyTypesToString(expectedProp.typeAlternatives);
            if (foundTypeAsStr !== expectedTypeAsStr) {
                const typeAlternativesErrors = checkAlternativesConsistencyHelper(foundProp.typeAlternatives, expectedProp.typeAlternatives, typeToAliases);
                if (typeAlternativesErrors.length > 0) {
                    const errorMsgPrefix = `The assigned type '${foundTypeAsStr}' is not compatible with the declared property '${name}' of type '${expectedTypeAsStr}'`;
                    const propErrors = typeAlternativesErrors
                        .map(errorInfo => ` '${errorInfo.typeAsString}' ${errorInfo.errorMessage}`)
                        .join('; ');
                    applyErrorToProperties(foundProp.astNodes, `${errorMsgPrefix}: ${propErrors}.`);
                }
            }

            if (!expectedProp.optional && foundProp.optional && areBothNotArrays(foundProp, expectedProp)) {
                applyMissingPropErrorToRules(name);
            }
        } else {
            applyErrorToProperties(foundProp.astNodes, `A property '${name}' is not expected.`);
        }
    }

    // detects lack of properties
    for (const [name, expectedProperties] of declared.entriesGroupedByKey()) {
        const foundProperty = inferred.get(name);
        if (foundProperty.length === 0 && !expectedProperties.some(e => e.optional)) {
            applyErrorToType(`A property '${name}' is expected.`);
        }
    }
}
