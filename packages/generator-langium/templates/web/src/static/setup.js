import { MonacoEditorLanguageClientWrapper } from 'monaco-editor-wrapper';
import { addMonacoStyles } from 'monaco-editor-wrapper/styles';  
import { buildWorkerDefinition } from "monaco-editor-workers";
import monarchSyntax from "../syntaxes/<%= language-id %>.monarch.js";

buildWorkerDefinition('../../node_modules/monaco-editor-workers/dist/workers/', new URL('', window.location.href).href, false);
addMonacoStyles('monaco-editor-styles');

export const configureServices = () => {
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
    const workerURL = new URL('../worker/<%= language-id %>-server-worker.js', import.meta.url);
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

export const configureUserConfig = () => {
    return {
        json: `{
    "workbench.colorTheme": "Default Dark Modern",
    "editor.semanticHighlighting.enabled": true
}`
    }
};

export const setupConfigClassic = (htmlElement) => {
    return {
        htmlElement: htmlElement,
        wrapperConfig: {
            serviceConfig: configureServices(),
            editorAppConfig: {
                $type: 'classic',
                languageId: '<%= language-id %>',
                code: `// <%= RawLanguageName %> is running in the web!`,
                useDiffEditor: false,
                languageExtensionConfig: { id: 'langium' },
                languageDef: monarchSyntax,
                userConfiguration: configureUserConfig()
            }
        },
        languageClientConfig: configureWorker()
    };
};

export const executeClassic = async (htmlElement) => {
    const userConfig = setupConfigClassic(htmlElement);
    const wrapper = new MonacoEditorLanguageClientWrapper();
    await wrapper.start(userConfig);
};
