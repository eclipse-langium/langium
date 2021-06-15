import { Location, Position } from 'vscode-languageserver';
import { LangiumDocument } from '../documents/document';
import { NameProvider } from '../references/naming';
import { LangiumServices } from '../services';
import { CstNode } from '../syntax-tree';
import { AstNodeContent, streamAllContents, streamReferences, findLeafNodeAtOffset, AstNodeReference } from '../utils/ast-util';

export interface ReferenceFinder {
    findReferences(document: LangiumDocument, position: Position, includeDeclaration: boolean): Location[];
}

export class DefaultReferenceFinder implements ReferenceFinder {
    protected readonly nameProvider: NameProvider;

    constructor(services: LangiumServices) {
        this.nameProvider = services.references.NameProvider;
    }

    findReferences(document: LangiumDocument, position: Position, includeDeclaration: boolean): Location[] {
        const rootNode = document.parseResult?.value?.$cstNode;
        if (!rootNode) {
            return [];
        }
        const locations: Location[] = [];
        const targetCNode = findLeafNodeAtOffset(rootNode, document.offsetAt(position));
        // TODO use findDeclaration for crossref nodes
        const targetAstNode = targetCNode?.element;
        if (targetAstNode) {
            const process = (node: AstNodeContent) => {
                if (includeDeclaration && node.node.$cstNode) {
                    // TODO Use value converter
                    const targetName = this.nameProvider.getName(targetAstNode);
                    // TODO check if we can just do: node.node === targetAstNode
                    if (targetName && node.node.$type === targetAstNode.$type
                        && targetName === this.nameProvider.getName(node.node)) {
                        const candidateCstNode = this.findNameNode(node.node.$cstNode, targetName);
                        locations.push({
                            uri: document.uri,
                            range: {
                                start: document.positionAt(candidateCstNode.offset),
                                end: document.positionAt(candidateCstNode.offset + candidateCstNode.length)
                            }
                        });
                    }
                }
                streamReferences(node.node).forEach((refNode: AstNodeReference) => {
                    const refCNode = refNode.container.$cstNode;
                    if (refCNode && refNode.reference.ref === targetAstNode) {
                        locations.push({
                            uri: document.uri,
                            range: {
                                start: document.positionAt(refCNode.offset),
                                end: document.positionAt(refCNode.offset + refCNode.length)
                            }
                        });
                    }
                });
            };
            streamAllContents(rootNode.element).forEach(process);
        }
        return locations;
    }

    protected findNameNode(node: CstNode, name: string): CstNode {
        // TODO do something smart:
        // 1. use a service like getNameFeature
        // 2. search for CstNode with text === name we are looking for
        // 3. look for feature named 'name' or the first attribute that is using lexer rule ID
        return node;
    }

}
