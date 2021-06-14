import { Location, Range } from 'vscode-languageserver';
import { findLeafNodeAtOffset } from '../../grammar/grammar-util';
import { LangiumServices } from '../../services';
import { AstNode } from '../../syntax-tree';
import { NameProvider } from '../naming';

export interface GoToDeclaration {
    findDeclaration(uri: string, root: AstNode, offset: number): Location[]
}

export class DefaultGoToDeclarationProvider implements GoToDeclaration {

    protected readonly nameProvider: NameProvider;

    constructor(services: LangiumServices) {
        this.nameProvider = services.references.NameProvider;
    }

    findDeclaration(uri: string, rootNode: AstNode, offset: number): Location[] {
        const cst = rootNode.$cstNode;
        const document = rootNode.$document;
        const locations: Location[] = [];
        if (cst) {
            const node = findLeafNodeAtOffset(cst, offset);
            if (node && document) {
                const precomputedScopes = rootNode.$document?.precomputedScopes;
                if (precomputedScopes) {
                    precomputedScopes.forEach(element => {
                        element.forEach(astDesc => {
                            if (astDesc) {
                                if (astDesc.name === node.text) {

                                    const ascNode = astDesc?.node;
                                    if (ascNode && ascNode.$cstNode) {
                                        const posA = ascNode.$cstNode.offset;
                                        const posB = ascNode.$cstNode.offset + ascNode.$cstNode.length;
                                        locations.push(Location.create(uri, Range.create(document.positionAt(posA), document.positionAt(posB))));
                                    }
                                }
                            }
                        });
                    });

                }
            }
        }
        return locations;
    }

}
