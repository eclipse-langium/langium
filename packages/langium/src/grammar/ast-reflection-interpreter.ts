/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstReflection, isAstNode, ReferenceInfo, TypeMandatoryProperty, TypeMetaData } from '../syntax-tree';
import { MultiMap } from '../utils/collections';
import { LangiumDocuments } from '../workspace/documents';
import { Grammar, isGrammar } from './generated/ast';
import { collectAst } from './type-system/ast-collector';
import { AstTypes, Property } from './type-system/type-collector/types';
import { collectAllProperties } from './type-system/types-util';

export function interpretAstReflection(astTypes: AstTypes): AstReflection;
export function interpretAstReflection(grammar: Grammar, documents?: LangiumDocuments): AstReflection;
export function interpretAstReflection(grammarOrTypes: Grammar | AstTypes, documents?: LangiumDocuments): AstReflection {
    let collectedTypes: AstTypes;
    if (isGrammar(grammarOrTypes)) {
        collectedTypes = collectAst(grammarOrTypes, documents);
    } else {
        collectedTypes = grammarOrTypes;
    }
    const allTypes = collectedTypes.interfaces.map(e => e.name).concat(collectedTypes.unions.map(e => e.name));
    const references = buildReferenceTypes(collectedTypes);
    const metaData = buildTypeMetaData(collectedTypes);
    const superTypeMap = buildSupertypeMap(collectedTypes);

    return {
        getAllTypes() {
            return allTypes;
        },
        getReferenceType(refInfo: ReferenceInfo): string {
            const referenceId = `${refInfo.container.$type}:${refInfo.property}`;
            const referenceType = references.get(referenceId);
            if (referenceType) {
                return referenceType;
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

function buildReferenceTypes(astTypes: AstTypes): Map<string, string> {
    const references = new MultiMap<string, [string, string]>();
    for (const interfaceType of astTypes.interfaces) {
        for (const property of interfaceType.properties) {
            for (const propertyAlternative of property.typeAlternatives) {
                if (propertyAlternative.reference) {
                    references.add(interfaceType.name, [property.name, propertyAlternative.types[0]]);
                }
            }
        }
        for (const superType of interfaceType.printingSuperTypes) {
            const superTypeReferences = references.get(superType);
            references.addAll(interfaceType.name, superTypeReferences);
        }
    }
    const map = new Map<string, string>();
    for (const [type, [property, target]] of references) {
        map.set(`${type}:${property}`, target);
    }
    return map;
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
        map.addAll(interfaceType.name, interfaceType.realSuperTypes);
    }
    for (const unionType of astTypes.unions) {
        map.addAll(unionType.name, unionType.realSuperTypes);
    }
    return map;
}
