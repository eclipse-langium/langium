import { startLanguageServer } from 'langium';
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';
import { create<%= LanguageName %>Services } from './<%= language-id %>-module';

// Create a connection to the client
const connection = createConnection(ProposedFeatures.all);

// Inject the language services
const services = create<%= LanguageName %>Services({ connection });

// Start the language server with the language-specific services
startLanguageServer(services);
