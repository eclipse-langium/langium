/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AbstractType, Grammar } from '../generated/ast';
import { getRuleType } from '../grammar-util';
import { MultiMap } from '../../utils/collections';
import { collectDeclaredTypes } from './declared-types';
import { collectInferredTypes } from './inferred-types';
import { AstTypes, collectAllAstResources, Field, FieldType, InterfaceType, typeFieldToString, TypeType } from './types-util';
import { stream } from '../../utils/stream';

export type TypeInconsistency = {
    nodes: readonly AbstractType[];
    inconsistencyReasons: string[];
}

export function validateTypes(grammar: Grammar): TypeInconsistency[] {
    const result: TypeInconsistency[] = [];
    const validationResources = collectValidationResources(grammar);
    for (const [inferredTypeName, inferredType] of validationResources.nameToInferredType.entries()) {
        const declaredType = validationResources.nameToDeclaredType.get(inferredTypeName);
        if (!declaredType) continue;

        const inconsistencyReasons: string[] = [];
        if (isType(declaredType.type) && isType(inferredType.type)) {
            inconsistencyReasons.push(...checkAlternativesConsistency(inferredType.type.alternatives, declaredType.type.alternatives));
        } else if (isInterface(declaredType.type) && isInterface(inferredType.type)) {
            inconsistencyReasons.push(...checkFieldConsistency(inferredType.type.fields, declaredType.type.fields));
            inconsistencyReasons.push(...checkStringElementConsistency(inferredType.type.printingSuperTypes, declaredType.type.printingSuperTypes, 'super type'));
        } else {
            inconsistencyReasons.push(`Inferred and declared versions of type ${inferredTypeName} have to be both types or interfaces.`);
        }

        if (inconsistencyReasons.length > 0) {
            result.push({
                nodes: inferredType.nodes,
                inconsistencyReasons,
            });
        }
    }
    return result;
}

type Type = InterfaceType | TypeType;

function isType(type: Type): type is TypeType {
    return type && 'alternatives' in type;
}

function isInterface(type: Type): type is InterfaceType {
    return type && 'fields' in type;
}

type TypeToNodes = {
    type: Type;
    nodes: readonly AbstractType[];
}

type ValidationResources = {
    nameToInferredType: Map<string, TypeToNodes>;
    nameToDeclaredType: Map<string, TypeToNodes>;
}

export function collectValidationResources(grammar: Grammar): ValidationResources {
    const astResources = collectAllAstResources([grammar]);
    const inferred = collectInferredTypes(Array.from(astResources.parserRules), Array.from(astResources.datatypeRules));
    const declared = collectDeclaredTypes(Array.from(astResources.interfaces), Array.from(astResources.types), inferred);

    const typeNameToType = stream(astResources.interfaces)
        .concat(astResources.types)
        .reduce((acc, type) => acc.add(type.name, type),
            new MultiMap<string, AbstractType>()
        );
    const nameToDeclaredType = mergeTypesAndInterfaces(declared)
        .reduce((acc, type) => acc.set(type.name, { type, nodes: typeNameToType.get(type.name) }),
            new Map<string, TypeToNodes>()
        );

    const typeNameToRule = stream(astResources.parserRules)
        .concat(astResources.datatypeRules)
        .reduce((acc, rule) => acc.add(getRuleType(rule), rule),
            new MultiMap<string, AbstractType>()
        );
    const nameToInferredType = mergeTypesAndInterfaces(inferred)
        .reduce((acc, type) => acc.set(type.name, { type, nodes: typeNameToRule.get(type.name) }),
            new Map<string, TypeToNodes>()
        );

    return { nameToDeclaredType, nameToInferredType };
}

function mergeTypesAndInterfaces(astTypes: AstTypes): Type[] {
    return (astTypes.interfaces as Type[]).concat(astTypes.types);
}

function checkStringElementConsistency(inferredType: string[], declaredType: string[], errorElementName: string): string[] {
    const extra = inferredType.filter(e => !declaredType.includes(e));
    const lack = declaredType.filter(e => !inferredType.includes(e));
    return getExtraAndLackError(extra, lack, errorElementName);
}

function checkAlternativesConsistency(inferredType: FieldType[], declaredType: FieldType[], errorElementName = 'type alternative'): string[] {
    return checkStringElementConsistency(inferredType.map(typeFieldToString), declaredType.map(typeFieldToString), errorElementName);
}

type ComparingFields = {
    inferredField: Field;
    declaredField: Field;
}

function checkFieldConsistency(inferredType: Field[], declaredType: Field[]): string[] {
    const inconsistencyReasons: string[] = [];
    const commonByName: ComparingFields[] = [];
    const extra: string[] = [];
    for (const inferredField of inferredType) {
        const declaredField = declaredType.find(e => e.name === inferredField.name);
        if (declaredField) {
            commonByName.push({ inferredField, declaredField });
        } else {
            extra.push(inferredField.name);
        }
    }

    const lack: string[] = declaredType
        .filter(declaredField => !inferredType.some(inferredField => inferredField.name === declaredField.name))
        .map(e => e.name);
    inconsistencyReasons.push(...getExtraAndLackError(extra, lack, 'field'));

    for (const comparingFields of commonByName) {
        const inferred = comparingFields.inferredField;
        const declared = comparingFields.declaredField;
        inconsistencyReasons.push(...checkAlternativesConsistency(inferred.typeAlternatives, declared.typeAlternatives, `type alternative of '${inferred.name}' field`));
        if (inferred.optional && !declared.optional) {
            inconsistencyReasons.push(`Inferred field '${inferred.name}' is optional, but declared one is mandatory.`);
        } else if (!inferred.optional && declared.optional) {
            inconsistencyReasons.push(`Declared field '${inferred.name}' is optional, but inferred one is mandatory.`);
        }
    }

    return inconsistencyReasons;
}

function getExtraAndLackError(extra: string[], lack: string[], errorElementName: string): string[] {
    const inconsistencyReasons: string[] = [];
    extra.forEach(e => inconsistencyReasons.push(`There is no '${e}' ${errorElementName ?? ''} in declared type.`));
    lack.forEach(e => inconsistencyReasons.push(`Lack of '${e}' ${errorElementName ?? ''} in inferred type.`));
    return inconsistencyReasons;
}
