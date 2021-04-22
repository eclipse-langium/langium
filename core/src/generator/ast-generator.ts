import { Grammar } from '../gen/ast';
import { CompositeGeneratorNode, NewLineNode } from './node/node';
import { process } from './node/node-processor';
import { collectAst } from './type-collector';

export function generateAst(grammar: Grammar, path?: string): string {
    const types = collectAst(grammar);
    const langiumPath = "'" + (path ?? 'langium') + "'"
    const fileNode = new CompositeGeneratorNode();
    fileNode.children.push(
        '/* eslint-disable @typescript-eslint/no-namespace */',
        new NewLineNode(),
        '/* eslint-disable @typescript-eslint/no-explicit-any */',
        new NewLineNode(),
        '/* eslint-disable @typescript-eslint/no-empty-interface */',
        new NewLineNode(),
        '/* eslint-disable @typescript-eslint/explicit-module-boundary-types */',
        new NewLineNode(),
        'import { AstNode, Kind } from ', langiumPath, ';',
        new NewLineNode(),
        new NewLineNode()
    );

    for (const type of types) {
        fileNode.children.push(type.toString(), new NewLineNode());
    }

    return process(fileNode);
}
