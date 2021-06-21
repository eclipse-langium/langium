import { startLanguageServer } from 'langium';
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';
import { createArithmeticsServices } from './arithmetics-module';

const connection = createConnection(ProposedFeatures.all);
const services = createArithmeticsServices({ connection });
startLanguageServer(services);
