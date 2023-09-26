import { buildWorkerDefinition } from "./monaco-editor-workers/index.js";
buildWorkerDefinition('./monaco-editor-workers/workers', new URL('', window.location.href).href, false);

export const configureBaseServices = () => {
    return {
        enableModelService: true,
        configureEditorOrViewsService: {
        },
        configureConfigurationService: {
            defaultWorkspaceUri: '/tmp/'
        },
        enableLanguagesService: true,
        enableKeybindingsService: true,
        debugLogging: true
    }
};

export const configureWorker = () => {
    const workerURL = new URL('./worker/<%= language-id %>-server-worker.js', import.meta.url);
    console.log(`Using the following  worker URL: ${workerURL.href}`);
    const lsWorker = new Worker(workerURL.href, {
        type: 'classic',
        name: '<%= LanguageName %> Language Server'
    });

    return {
        options: {
            $type: 'WorkerDirect',
            worker: lsWorker
        }
    }
};
