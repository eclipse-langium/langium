/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { DefaultNameProvider } from 'langium';
import { isPackageDeclaration, PackageDeclaration } from './generated/ast';

export function toQualifiedName(pack: PackageDeclaration, childName: string): string {
    return (isPackageDeclaration(pack.$container) ? toQualifiedName(pack.$container, pack.name) : pack.name) + '.' + childName;
}

export class DomainModelNameProvider extends DefaultNameProvider {

    /**
     * @param qualifier if the qualifier is a `string`, simple string concatenation is done: `qualifier.name`.
     *      if the qualifier is a `PackageDeclaration` fully qualified name is created: `package1.package2.name`.
     * @param name simple name
     * @returns qualified name separated by `.`
     */
    getQualifiedName(qualifier: PackageDeclaration | string, name: string): string {
        let prefix = qualifier;
        if (isPackageDeclaration(prefix)) {
            prefix = (isPackageDeclaration(prefix.$container)
                ? this.getQualifiedName(prefix.$container, prefix.name) : prefix.name);
        }
        return (prefix ? prefix + '.' : '') + name;
    }

}
