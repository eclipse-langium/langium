/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AbstractRule, Grammar } from '../generated/ast';
import { getRuleType } from '../grammar-util';
import { MultiMap } from '../../utils/collections';
import { collectDeclaredTypes } from './declared-types';
import { collectInferredTypes } from './inferred-types';
import { AstTypes, collectAllAstResources, compareFieldType, compareLists, InterfaceType, TypeType } from './types-util';

export type TypeInconsistency = {
    node: AbstractRule,
    typeName: string
}

export function validateTypes(grammar: Grammar): TypeInconsistency[] {
    const types = collectAstForValidation(grammar);
    if (!types) return [];
    const typeToRule = astTypeNames(grammar.rules);
    const result = [];

    const declaredTypeNames = new Map<string, TypeType>();
    types.declared.types.map(e => declaredTypeNames.set(e.name, e));
    for (const inferredType of types.inferred.types) {
        const declaredType = declaredTypeNames.get(inferredType.name);
        if (declaredType && !compareTypes(inferredType, declaredType)) {
            for (const node of typeToRule.get(inferredType.name)) {
                result.push({
                    node,
                    typeName: inferredType.name
                });
            }
        }
    }

    const declaredInterfaceNames = new Map<string, InterfaceType>();
    types.declared.interfaces.map(e => declaredInterfaceNames.set(e.name, e));
    for (const inferredType of types.inferred.interfaces) {
        const declaredType = declaredInterfaceNames.get(inferredType.name);
        if (declaredType && !compareInterfaces(inferredType, declaredType)) {
            for (const node of typeToRule.get(inferredType.name)) {
                result.push({
                    node,
                    typeName: inferredType.name
                });
            }
        }
    }

    return result;
}

type InferredDeclaredTypes = {
    inferred: AstTypes,
    declared: AstTypes
}

function collectAstForValidation(grammar: Grammar): InferredDeclaredTypes {
    const astResources = collectAllAstResources([grammar]);
    const inferred = collectInferredTypes(Array.from(astResources.parserRules), Array.from(astResources.datatypeRules));
    return {
        inferred,
        declared: collectDeclaredTypes(Array.from(astResources.interfaces), Array.from(astResources.types), inferred)
    };
}

function astTypeNames(rules: AbstractRule[]): MultiMap<string, AbstractRule> {
    const typeNameToRule = new MultiMap<string, AbstractRule>();
    rules.map(rule => typeNameToRule.add(getRuleType(rule), rule));
    return typeNameToRule;
}

function compareTypes(a: TypeType, b: TypeType): boolean {
    return a.name === b.name &&
        a.reflection === b.reflection &&
        compareLists(a.superTypes, b.superTypes) &&
        compareLists(a.alternatives, b.alternatives, compareFieldType);
}

function compareInterfaces(a: InterfaceType, b: InterfaceType): boolean {
    return a.name === b.name &&
    compareLists(a.superTypes, b.superTypes) &&
    compareLists(a.fields, b.fields, (x, y) =>
        x.name === y.name &&
        x.optional === y.optional &&
        compareLists(x.typeAlternatives, y.typeAlternatives, compareFieldType)
    );
}
