/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AtomType, Interface, Type } from '../generated/ast';
import { getTypeName } from '../internal-grammar-util';
import { AstTypes, Property, PropertyType, InterfaceType, UnionType } from './types-util';

export function collectDeclaredTypes(interfaces: Interface[], unions: Type[]): AstTypes {
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
    for (const union of unions) {
        const alternatives = union.typeAlternatives.map(atomTypeToPropertyType);
        const reflection = union.typeAlternatives.length > 1 && union.typeAlternatives.some(e => e.refType?.ref !== undefined);
        declaredTypes.unions.push(new UnionType(union.name, alternatives, { reflection }));
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
