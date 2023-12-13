/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { AstNode } from 'langium';
import type { SModelElement } from 'sprotty-protocol';
import type { Diagnostic, Range } from 'vscode-languageserver';
import type { GeneratorContext } from './diagram-generator.js';
import type { LangiumSprottyServices } from './sprotty-services.js';
import { AstUtils } from 'langium';

/**
 * Used to add diagnostic markers to the generated diagram.
 */
export interface DiagnosticMarkerProvider {

    addDiagnosticMarker(element: SModelElement, source: AstNode, ctx: GeneratorContext): void;

}

export interface SDiagnosticMarker extends SModelElement {
    issues: LangiumSprottyIssue[]
}

export interface LangiumSprottyIssue {
    message: string
    severity: 'error' | 'warning' | 'info';
}

export class DefaultDiagnosticMarkerProvider implements DiagnosticMarkerProvider {

    constructor(_services: LangiumSprottyServices) { }

    addDiagnosticMarker(element: SModelElement, source: AstNode, ctx: GeneratorContext): void {
        const diagnostics = this.getDiagnostics(source);
        if (diagnostics.length === 0) {
            return;
        }
        diagnostics.sort((a, b) => (a.severity ?? 0) - (b.severity ?? 0));
        const issues = diagnostics.map(diagnostic => ({
            message: diagnostic.message,
            severity: convertSeverity(diagnostic)
        }) satisfies LangiumSprottyIssue);
        const marker: SDiagnosticMarker = {
            type: 'marker',
            id: ctx.idCache.uniqueId(ctx.idCache.getId(source) + '.marker'),
            issues
        };
        if (element.children) {
            element.children.push(marker);
        } else {
            element.children = [marker];
        }
    }

    protected getDiagnostics(source: AstNode): Diagnostic[] {
        const document = AstUtils.getDocument(source);
        if (!document.diagnostics || !source.$cstNode) {
            return [];
        }
        const sourceRange = source.$cstNode.range;
        return document.diagnostics.filter(d => includesRange(sourceRange, d.range));
    }

}

function includesRange(outer: Range, inner: Range): boolean {
    return (outer.start.line < inner.start.line
            || outer.start.line === inner.start.line && outer.start.character <= inner.start.character)
        && (outer.end.line > inner.end.line
            || outer.end.line === inner.end.line && outer.end.character >= inner.end.character);
}

function convertSeverity(diagnostic: Diagnostic): 'error' | 'warning' | 'info' {
    switch (diagnostic.severity) {
        case 1: return 'error';
        case 2: return 'warning';
        case 3: return 'info';
        default: return 'error';
    }
}
