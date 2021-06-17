import { startLanguageServer } from 'langium';
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';
import { createDomainModelServices } from './domain-model-module';

const connection = createConnection(ProposedFeatures.all);
const services = createDomainModelServices({ connection });
startLanguageServer(services);
