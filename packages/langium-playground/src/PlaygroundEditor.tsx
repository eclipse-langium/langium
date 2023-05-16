import { MonacoEditorReactComp } from "@typefox/monaco-editor-react/.";
import { UserConfig } from "monaco-editor-wrapper";
import { FC, useState } from "react";

export function IdCounter() {
    let counter = 0;
    return () => {
        counter++;
        return `editor-${counter}`;
    };
}

const idCounter = IdCounter();

export interface Language {
    id: string;
    workerUrl: URL;
    configurationJsonContent: string;
    grammarJsonContent: string;
}

export interface PlaygroundEditorProps {
    language: Language;
    text: string;
    onTextChanged: (text: string) => void;
}

export const PlaygroundEditor: FC<PlaygroundEditorProps> = ({ language: {id: languageId, workerUrl, configurationJsonContent, grammarJsonContent}, text, onTextChanged }) => {
    const [id] = useState(() => idCounter());
    return <MonacoEditorReactComp
        onTextChanged={onTextChanged}
        userConfig={{
            id,
            htmlElement: undefined!,
            editorConfig: {
                code: text,
                theme: 'vs-dark',
                useDiffEditor: false,
                languageId,
                automaticLayout: true,
            },
            languageClientConfig: {
                enabled: true,
                useWebSocket: false,
                workerConfigOptions: {
                    url: workerUrl,
                    type: 'module',
                    name: `ls-${languageId}-${id}`,
                }
            },
            wrapperConfig: {
                useVscodeConfig: true,
                serviceConfig: {
                    enableThemeService: true,
                    enableTextmateService: true,
                    enableModelEditorService: true,
                    modelEditorServiceConfig: {
                        useDefaultFunction: true
                    },
                    enableConfigurationService: true,
                    configurationServiceConfig: {
                        defaultWorkspaceUri: '/tmp/'
                    },
                    enableKeybindingsService: true,
                    enableLanguagesService: true,
                    debugLogging: true
                },
                monacoVscodeApiConfig: {
                    extension: {
                        name: languageId,
                        publisher: 'typefox',
                        version: '1.0.0',
                        engines: {
                            vscode: '*'
                        },
                        contributes: {
                            languages: [{
                                id: languageId,
                                extensions: [
                                    '.statemachine'
                                ],
                                aliases: [
                                    languageId
                                ],
                                configuration: './configuration.json'
                            }],
                            grammars: [{
                                language: languageId,
                                scopeName: `source.${languageId}`,
                                path: './grammar.json'
                            }]
                        }
                    },
                    extensionFilesOrContents: new Map<string, string | URL>([
                        ['/configuration.json', configurationJsonContent],
                        ['/grammar.json', grammarJsonContent]
                    ]),
                    userConfiguration: {
                        json: `{
        "workbench.colorTheme": "Default Dark+ Experimental",
        "editor.fontSize": 14,
        "editor.lightbulb.enabled": true,
        "editor.lineHeight": 20,
        "editor.guides.bracketPairsHorizontal": "active",
        "editor.lightbulb.enabled": true
      }`
                    }
                }
            },
        }}
    />
}










async function createStatemachineConfig (code: string, htmlElement: HTMLElement): Promise<UserConfig> {

    // setup extension files/contents
    const extensionFilesOrContents = new Map<string, string | URL>();
    const configUrl = new URL('/showcase/statemachine-configuration.json', window.location.href);
    const grammarUrl = new URL('/showcase/statemachine-grammar.json', window.location.href);
  
    extensionFilesOrContents.set('/statemachine-configuration.json', configUrl);
    extensionFilesOrContents.set('/statemachine-grammar.json', await (await fetch(grammarUrl)).text());
  
    // Language Server preparation
    const workerUrl = new URL('/showcase/libs/worker/statemachineServerWorker.js', window.location.href);
  
    // generate langium config
    return {
        htmlElement,
        wrapperConfig: {
            useVscodeConfig: true,
            serviceConfig: {
                enableThemeService: true,
                enableTextmateService: true,
                enableModelEditorService: true,
                modelEditorServiceConfig: {
                    useDefaultFunction: true
                },
                enableConfigurationService: true,
                configurationServiceConfig: {
                    defaultWorkspaceUri: '/tmp/'
                },
                enableKeybindingsService: true,
                enableLanguagesService: true,
                debugLogging: true
            },
            monacoVscodeApiConfig: {
                extension: {
                    name: 'statemachine',
                    publisher: 'typefox',
                    version: '1.0.0',
                    engines: {
                        vscode: '*'
                    },
                    contributes: {
                        languages: [{
                            id: 'statemachine',
                            extensions: [
                                '.statemachine'
                            ],
                            aliases: [
                                'statemachine',
                                'Statemachine'
                            ],
                            configuration: './statemachine-configuration.json'
                        }],
                        grammars: [{
                            language: 'statemachine',
                            scopeName: 'source.statemachine',
                            path: './statemachine-grammar.json'
                        }],
                        keybindings: [{
                            key: 'ctrl+p',
                            command: 'editor.action.quickCommand',
                            when: 'editorTextFocus'
                        }, {
                            key: 'ctrl+shift+c',
                            command: 'editor.action.commentLine',
                            when: 'editorTextFocus'
                        }]
                    }
                },
                extensionFilesOrContents,
                userConfiguration: {
                    json: `{
    "workbench.colorTheme": "Default Dark+ Experimental",
    "editor.fontSize": 14,
    "editor.lightbulb.enabled": true,
    "editor.lineHeight": 20,
    "editor.guides.bracketPairsHorizontal": "active",
    "editor.lightbulb.enabled": true
  }`
                }
            }
        },
        editorConfig: {
            languageId: 'statemachine',
            code,
            useDiffEditor: false,
            automaticLayout: true,
            theme: 'vs-dark',
        },
        languageClientConfig: {
            enabled: true,
            useWebSocket: false,
            workerConfigOptions: {
                url: workerUrl,
                type: 'module',
                name: 'LS',
            }
        }
    };
  }