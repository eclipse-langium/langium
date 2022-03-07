/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { getTypeName, isDataTypeRule } from '../grammar-util';
import { AtomType, Interface, isAction, isParserRule, Type } from '../generated/ast';
import { AstTypes, Field, FieldType, InterfaceType, TypeType } from './types-util';
import { MultiMap } from '../../utils/collections';

export function collectDeclaredTypes(interfaces: Interface[], types: Type[], inferredTypes: AstTypes): AstTypes {
    const declaredTypes: AstTypes = {types: [], interfaces: []};
    // add interfaces
    for (const interfaceType of interfaces) {
        const superTypes = interfaceType.superTypes.map(e => getTypeName(e.ref));
        const fields: Field[] = interfaceType.attributes.map(e => <Field>{
            name: e.name,
            optional: e.isOptional === true,
            typeAlternatives: e.typeAlternatives.map(atomTypeToFieldType)
        });
        declaredTypes.interfaces.push(new InterfaceType(interfaceType.name, superTypes, fields));
    }

    // add types
    const childToSuper = new MultiMap<string, string>();
    for (const type of types) {
        const alternatives = type.typeAlternatives.map(atomTypeToFieldType);
        const reflection = type.typeAlternatives.some(e => {
            const refType = e.refType?.ref;
            return refType && (isParserRule(refType) && !isDataTypeRule(refType) || isAction(refType));
        });
        declaredTypes.types.push(new TypeType(type.name, alternatives, { reflection }));

        for (const maybeRef of type.typeAlternatives) {
            if (maybeRef.refType) {
                childToSuper.add(getTypeName(maybeRef.refType.ref), type.name);
            }
        }
    }
    for (const child of childToSuper.keys()) {
        const childType = inferredTypes.types.find(e => e.name === child) ??
            inferredTypes.interfaces.find(e => e.name === child) ??
            declaredTypes.types.find(e => e.name === child) ??
            declaredTypes.interfaces.find(e => e.name === child);
        if (childType) {
            childToSuper.get(child).map(superType => childType.superTypes.push(superType));
        }
    }

    return declaredTypes;
}

function atomTypeToFieldType(type: AtomType): FieldType {
    return {
        types: [type.refType ? getTypeName(type.refType.ref) : (type.primitiveType ?? `'${type.keywordType?.value}'`)],
        reference: type.isRef === true,
        array: type.isArray === true
    };
}
