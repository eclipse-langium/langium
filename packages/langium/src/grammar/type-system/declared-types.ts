/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { getTypeName } from '../grammar-util';
import { AtomType, Interface, Type } from '../generated/ast';
import { AstTypes, Property, PropertyType, InterfaceType, TypeType } from './types-util';
import { MultiMap } from '../../utils/collections';

export function collectDeclaredTypes(interfaces: Interface[], types: Type[], inferredTypes: AstTypes): AstTypes {

    function addSuperTypes(child: string, types: AstTypes) {
        const childType = types.types.find(e => e.name === child) ??
            types.interfaces.find(e => e.name === child);
        if (childType) {
            childType.superTypes.push(...childToSuper.get(child));
        }
    }

    const declaredTypes: AstTypes = { types: [], interfaces: [] };
    // add interfaces
    for (const interfaceType of interfaces) {
        const superTypes = interfaceType.superTypes.map(e => getTypeName(e.ref));
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
        declaredTypes.types.push(new TypeType(type.name, alternatives, { reflection }));

        if (reflection) {
            for (const maybeRef of type.typeAlternatives) {
                if (maybeRef.refType) {
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
    return {
        types: [type.refType ? getTypeName(type.refType.ref) : (type.primitiveType ?? `'${type.keywordType?.value}'`)],
        reference: type.isRef === true,
        array: type.isArray === true
    };
}
