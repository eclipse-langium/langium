import { LangiumServices } from '../services';
import { AstNode, AstReflection } from '../generator/ast-node';
import { streamAllContents } from '../generator/ast-util';
import { ScopeProvider } from './scope';
import { isNamed } from './naming';

export interface Linker {
    link(node: AstNode, reference: string, referenceId: string): AstNode | undefined;
}

export class DefaultLinker implements Linker {
    protected readonly scopeProvider: ScopeProvider;
    protected readonly reflection: AstReflection;

    constructor(services: LangiumServices) {
        this.scopeProvider = services.references.ScopeProvider;
        this.reflection = services.AstReflection;
    }

    link(node: AstNode, reference: string, referenceId: string): AstNode | undefined {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore next-line
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const scope = this.scopeProvider.getScope(node, referenceId);
        const description = scope.getElement(reference);
        let crossRefItem: AstNode | undefined;
        if (description) {
            const top = topMostContainer(node);
            const typeFiltered = streamAllContents(top).filter(e => this.reflection.isInstance(e.node, description.type));
            const nameFiltered = typeFiltered.filter(e => isNamed(e.node) && e.node.name === description.name).map(e => e.node);
            crossRefItem = nameFiltered.head();
        }
        return crossRefItem;
    }
}

function topMostContainer(node: AstNode): AstNode {
    let container = node;
    while (container.$container) {
        container = container.$container;
    }
    return container;
}
