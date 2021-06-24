import { startLanguageServer } from 'langium';
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';
import { createStatemachineServices } from './statemachine-module';

// Create a connection to the client
const connection = createConnection(ProposedFeatures.all);

// Inject the language services
const services = createStatemachineServices({ connection });

// Start the language server with the language-specific services
startLanguageServer(services);
