import { Grammar } from 'langium';
import { CompositeGeneratorNode, NL } from 'langium';
import { process } from 'langium';
import { collectAst } from './type-collector';

export function generateAst(grammar: Grammar, path?: string): string {
    const types = collectAst(grammar);
    const langiumPath = "'" + (path ?? 'langium') + "'";
    const fileNode = new CompositeGeneratorNode();
    fileNode.children.push(
        '/* eslint-disable @typescript-eslint/array-type */', NL,
        '/* eslint-disable @typescript-eslint/no-namespace */', NL,
        '/* eslint-disable @typescript-eslint/no-explicit-any */', NL,
        '/* eslint-disable @typescript-eslint/no-empty-interface */', NL,
        '/* eslint-disable @typescript-eslint/explicit-module-boundary-types */', NL,
        'import { AstNode, Type, Reference } from ', langiumPath, ';', NL, NL
    );

    for (const type of types) {
        fileNode.children.push(type.toString(), NL);
    }

    return process(fileNode);
}
