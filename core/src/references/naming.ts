import { AstNode } from '../generator/ast-node';
import { BindingKey, Factory } from '../dependency-injection';

export interface NamedAstNode extends AstNode {
    name: string;
}

export function isNamed(node: AstNode): node is NamedAstNode {
    return (node as NamedAstNode).name !== undefined;
}

export type NameProvider = (node: AstNode) => string | undefined;

export const NameProvider: BindingKey<NameProvider> = { id: 'NameProvider' };

export const DefaultNameProvider: Factory<NameProvider> = () => {
    return function(node: AstNode): string | undefined {
        if (isNamed(node)) {
            return node.name;
        }
        return undefined;
    };
};
