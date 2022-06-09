/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { getReferenceId } from '../references/linker';
import { NamedAstNode } from '../references/naming';
import { AstReflection, TypeMandatoryProperty, TypeMetaData } from '../syntax-tree';
import { getContainerOfType, isAstNode, streamAllContents } from '../utils/ast-util';
import { MultiMap } from '../utils/collections';
import { LangiumDocuments } from '../workspace/documents';
import { Grammar, isAssignment, isCrossReference, isParserRule, ParserRule } from './generated/ast';
import { createLangiumGrammarServices } from './langium-grammar-module';
import { collectAst } from './type-system/type-collector';
import { AstTypes, collectAllProperties, Property } from './type-system/types-util';

let emptyDocuments: LangiumDocuments;

export function interpretAstReflection(grammar: Grammar, documents?: LangiumDocuments): AstReflection {
    if (!emptyDocuments && !documents) {
        emptyDocuments = createLangiumGrammarServices().shared.workspace.LangiumDocuments;
    }
    const collectedTypes = collectAst(documents ?? emptyDocuments, [grammar]);
    const allTypes = collectedTypes.interfaces.map(e => e.name).concat(collectedTypes.unions.map(e => e.name)).sort();
    const references = buildCrossReferenceTypes(grammar.rules.filter(isParserRule));
    const metaData = buildTypeMetaData(collectedTypes);
    const superTypeMap = buildSupertypeMap(collectedTypes);

    return {
        getAllTypes() {
            return allTypes;
        },
        getReferenceType(referenceId: string): string {
            const referenceType = references.get(referenceId);
            if (referenceType) {
                return referenceType.referenceType;
            }
            throw new Error('Could not find reference type for ' + referenceId);
        },
        getTypeMetaData(type: string): TypeMetaData {
            return metaData.get(type) ?? {
                name: type,
                mandatory: []
            };
        },
        isInstance(node: unknown, type: string): boolean {
            return isAstNode(node) && this.isSubtype(node.$type, type);
        },
        isSubtype(subtype: string, originalSuperType: string): boolean {
            if (subtype === originalSuperType) {
                return true;
            }
            const superTypes = superTypeMap.get(subtype);
            for (const superType of superTypes) {
                if (this.isSubtype(superType, originalSuperType)) {
                    return true;
                }
            }
            return false;
        }
    };
}

export type CrossReferenceType = {
    type: string,
    feature: string,
    referenceType: string
    toString(): string
}

export function buildCrossReferenceTypes(rules: ParserRule[]): Map<string, CrossReferenceType> {

    const crossReferences = new Map<string, CrossReferenceType>();
    for (const rule of rules) {
        for (const crossRef of streamAllContents(rule).filter(isCrossReference)) {
            const assignment = getContainerOfType(crossRef, isAssignment)!;
            const targetType = crossRef.type.ref! as NamedAstNode;
            const ruleName = rule.name;
            const propertyName = assignment.feature;
            crossReferences.set(getReferenceId(ruleName, propertyName), {
                type: ruleName,
                feature: propertyName,
                referenceType: targetType.name,
                toString: () => getReferenceId(ruleName, propertyName)
            });
        }
    }
    return crossReferences;
}

function buildTypeMetaData(astTypes: AstTypes): Map<string, TypeMetaData> {
    const map = new Map<string, TypeMetaData>();
    const allProperties = collectAllProperties(astTypes.interfaces);
    for (const interfaceType of astTypes.interfaces) {
        const props = allProperties.get(interfaceType.name)!;
        const arrayProps = props.filter(e => e.typeAlternatives.some(e => e.array));
        const booleanProps = props.filter(e => e.typeAlternatives.every(e => !e.array && e.types.includes('boolean')));
        if (arrayProps.length > 0 || booleanProps.length > 0) {
            map.set(interfaceType.name, {
                name: interfaceType.name,
                mandatory: buildMandatoryMetaData(arrayProps, booleanProps)
            });
        }
    }
    return map;
}

function buildMandatoryMetaData(arrayProps: Property[], booleanProps: Property[]): TypeMandatoryProperty[] {
    const array: TypeMandatoryProperty[] = [];
    const all = arrayProps.concat(booleanProps).sort((a, b) => a.name.localeCompare(b.name));
    for (const property of all) {
        const type = arrayProps.includes(property) ? 'array' : 'boolean';
        array.push({
            name: property.name,
            type
        });
    }
    return array;
}

function buildSupertypeMap(astTypes: AstTypes): MultiMap<string, string> {
    const map = new MultiMap<string, string>();
    for (const interfaceType of astTypes.interfaces) {
        map.addAll(interfaceType.name, interfaceType.superTypes);
    }
    for (const unionType of astTypes.unions) {
        map.addAll(unionType.name, unionType.superTypes);
    }
    return map;
}