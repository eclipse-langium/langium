import { createLangiumGrammarServices, startLanguageServer } from 'langium';
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';

const connection = createConnection(ProposedFeatures.all);
const services = createLangiumGrammarServices({ connection });
startLanguageServer(services);
