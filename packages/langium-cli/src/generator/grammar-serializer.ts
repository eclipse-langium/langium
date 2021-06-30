import { CompositeGeneratorNode, Grammar, LangiumServices, NL, process } from 'langium';
import { LangiumConfig } from '../package';
import { generatedHeader } from './util';

export function serializeGrammar(services: LangiumServices, grammar: Grammar, config: LangiumConfig): string {
    const json = services.serializer.JsonSerializer.serialize(grammar, 2);
    const node = new CompositeGeneratorNode();
    node.children.push(generatedHeader);

    if (config.langiumInternal) {
        node.children.push("import { loadGrammar } from '../grammar-util';", NL);
        node.children.push("import { Grammar } from './ast';", NL, NL);
    } else {
        node.children.push("import { loadGrammar, Grammar } from 'langium';", NL, NL);
    }

    node.children.push('const grammar = (): Grammar => loadGrammar(`', json.replace(/\\/g, '\\\\'), '`);', NL, NL, 'export default grammar;');
    return process(node);
}