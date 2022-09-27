/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AtomType, Interface, Type } from '../generated/ast';
import { getTypeName } from '../internal-grammar-util';
import { AstTypes, Property, PropertyType, InterfaceType, UnionType } from './types-util';
import { MultiMap } from '../../utils/collections';

export function collectDeclaredTypes(interfaces: Interface[], types: Type[], inferredTypes: AstTypes): AstTypes {

    function addSuperTypes(child: string, types: AstTypes) {
        const childType = types.unions.find(e => e.name === child) ??
            types.interfaces.find(e => e.name === child);
        if (childType) {
            childToSuper.get(child).forEach(e => childType.superTypes.add(e));
        }
    }

    const declaredTypes: AstTypes = { unions: [], interfaces: [] };
    // add interfaces
    for (const interfaceType of interfaces) {
        const superTypes = interfaceType.superTypes.filter(e => e.ref).map(e => getTypeName(e.ref!));
        const properties: Property[] = interfaceType.attributes.map(e => <Property>{
            name: e.name,
            optional: e.isOptional === true,
            typeAlternatives: e.typeAlternatives.map(atomTypeToPropertyType)
        });
        declaredTypes.interfaces.push(new InterfaceType(interfaceType.name, superTypes, properties));
    }

    // add types
    const childToSuper = new MultiMap<string, string>();
    for (const type of types) {
        const alternatives = type.typeAlternatives.map(atomTypeToPropertyType);
        const reflection = type.typeAlternatives.length > 1 && type.typeAlternatives.some(e => e.refType?.ref !== undefined);
        declaredTypes.unions.push(new UnionType(type.name, alternatives, { reflection }));

        if (reflection) {
            for (const maybeRef of type.typeAlternatives) {
                if (maybeRef.refType?.ref) {
                    childToSuper.add(getTypeName(maybeRef.refType.ref), type.name);
                }
            }
        }
    }

    for (const child of childToSuper.keys()) {
        addSuperTypes(child, inferredTypes);
        addSuperTypes(child, declaredTypes);
    }

    return declaredTypes;
}

function atomTypeToPropertyType(type: AtomType): PropertyType {
    let types: string[] = [];
    if (type.refType) {
        types = [type.refType.ref ? getTypeName(type.refType.ref) : type.refType.$refText];
    } else {
        types = [type.primitiveType ?? `'${type.keywordType?.value}'`];
    }
    return { types, reference: type.isRef === true, array: type.isArray === true };
}
