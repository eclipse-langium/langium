import { startLanguageServer } from 'langium';
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';
import { createLanguageNameServices } from './language-id-module';

const connection = createConnection(ProposedFeatures.all);
const services = createLanguageNameServices({ connection });
startLanguageServer(services);
