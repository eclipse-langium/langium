import { Uri } from 'vscode';
import getConfigurationServiceOverride from '@codingame/monaco-vscode-configuration-service-override';
import getEditorServiceOverride from '@codingame/monaco-vscode-editor-service-override';
import getKeybindingsServiceOverride from '@codingame/monaco-vscode-keybindings-service-override';
import { useOpenEditorStub } from 'monaco-languageclient';
import { MonacoEditorLanguageClientWrapper } from 'monaco-editor-wrapper';
import { addMonacoStyles } from 'monaco-editor-wrapper/styles';

export const defineUserServices = () => {
    return {
        userServices: {
            ...getConfigurationServiceOverride(Uri.file('/workspace')),
            ...getEditorServiceOverride(useOpenEditorStub),
            ...getKeybindingsServiceOverride()
        },
        debugLogging: true
    }
};
export {
    getConfigurationServiceOverride,
    getEditorServiceOverride,
    getKeybindingsServiceOverride,
    addMonacoStyles,
    MonacoEditorLanguageClientWrapper
}
