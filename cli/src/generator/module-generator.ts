import * as langium from 'langium';
import { CompositeGeneratorNode, IndentNode, NL, process } from 'langium';
import { LangiumConfig } from '../package';

export function generateModule(grammar: langium.Grammar, config: LangiumConfig): string {
    const node = new CompositeGeneratorNode();

    if (config.langiumInternal) {
        node.children.push("import { Module } from '../../dependency-injection';", NL);
        node.children.push("import { LangiumGeneratedServices, LangiumServices } from '../../services';", NL);
    } else {
        node.children.push("import { LangiumGeneratedServices, LangiumServices, Module } from 'langium';", NL);
    }
    node.children.push(
        'import { ', grammar.name, "AstReflection } from './ast';", NL,
        'import { ', grammar.name, "GrammarAccess } from './grammar-access';", NL,
        "import { Parser } from './parser';", NL, NL
    );

    node.children.push('export const ', grammar.name, 'GeneratedModule: Module<LangiumServices, LangiumGeneratedServices> = {', NL);
    const moduleNode = new IndentNode();
    moduleNode.children.push('Parser: (injector) => new Parser(injector),', NL);
    moduleNode.children.push('GrammarAccess: () => new ', grammar.name, 'GrammarAccess(),', NL);
    moduleNode.children.push('AstReflection: () => new ', grammar.name, 'AstReflection()', NL);
    node.children.push(moduleNode, '};', NL);

    return process(node);
}
