import { startLanguageServer } from 'langium';
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';
import { create<%= LanguageName %>Services } from './<%= language-id %>-module';

const connection = createConnection(ProposedFeatures.all);
const services = create<%= LanguageName %>Services({ connection });
startLanguageServer(services);
