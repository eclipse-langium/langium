import { AstNode } from '../syntax-tree';

export interface NamedAstNode extends AstNode {
    name: string;
}

export function isNamed(node: AstNode): node is NamedAstNode {
    return (node as NamedAstNode).name !== undefined;
}

export interface NameProvider {
    getName(node: AstNode): string | undefined;
}

export class DefaultNameProvider implements NameProvider {
    getName(node: AstNode): string | undefined {
        if (isNamed(node)) {
            return node.name;
        }
        return undefined;
    }
}
