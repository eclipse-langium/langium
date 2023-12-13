/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { AstNode, AstNodeLocator, LangiumDocuments } from 'langium';
import type { SModelElement, SModelRoot } from 'sprotty-protocol';
import type { Range } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import type { LangiumSprottyServices } from './sprotty-services.js';
import { AstUtils, GrammarUtils, stream, } from 'langium';

export interface TracedModelElement extends SModelElement {
    trace?: string
}

/**
 * Compute traces from Langium AST nodes to Sprotty model elements.
 * The traces are used to synchronize selection between text and diagram, among other features.
 */
export interface TraceProvider {

    /**
     * Trace a Sprotty model element to a whole AST node or a specific property.
     */
    trace(target: TracedModelElement, source: AstNode, property?: string, index?: number): void;

    /**
     * Find the source AST node for a given Sprotty model element.
     */
    getSource(target: TracedModelElement): AstNode | undefined;

    /**
     * Find the target model element for a given source AST node.
     */
    getTarget(source: AstNode, root: SModelRoot): TracedModelElement | undefined;

}

export class DefaultTraceProvider implements TraceProvider {

    protected readonly langiumDocuments: LangiumDocuments;
    protected readonly astNodeLocator: AstNodeLocator;

    constructor(services: LangiumSprottyServices) {
        this.langiumDocuments = services.shared.workspace.LangiumDocuments;
        this.astNodeLocator = services.workspace.AstNodeLocator;
    }

    trace(target: TracedModelElement, source: AstNode, property?: string | undefined, index?: number | undefined): void {
        let range: Range | undefined;
        if (property) {
            range = GrammarUtils.findNodeForProperty(source.$cstNode, property, index)?.range;
        } else {
            range = source.$cstNode?.range;
        }
        if (!range) {
            return;
        }

        const traceUri = AstUtils.getDocument(source).uri.with({
            fragment: this.astNodeLocator.getAstNodePath(source),
            query: `${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`
        });
        target.trace = traceUri.toString();
    }

    getSource(target: TracedModelElement): AstNode | undefined {
        if (!target.trace) {
            return undefined;
        }
        try {
            const traceUri = URI.parse(target.trace);
            const document = this.langiumDocuments.getDocument(traceUri.with({ fragment: null, query: null }));
            if (!document) {
                return undefined;
            }
            return this.astNodeLocator.getAstNode(document.parseResult.value, traceUri.fragment);
        } catch (err) {
            console.warn(`Could not retrieve source of trace: ${target.trace}`, err);
            return undefined;
        }
    }

    getTarget(source: AstNode, root: SModelRoot): TracedModelElement | undefined {
        const documentUri = AstUtils.getDocument(source).uri;
        const containerChain = [];
        let currentContainer: AstNode | undefined = source;
        while (currentContainer) {
            containerChain.push(currentContainer);
            currentContainer = currentContainer.$container;
        }
        const uri2Container = stream(containerChain)
            .toMap(node => documentUri.with({ fragment: this.astNodeLocator.getAstNodePath(node) }).toString());

        // Find all target elements that are traced to one of the containers
        const results: Array<[AstNode, TracedModelElement]> = [];
        this.findTargetElements(root, uri2Container, results);
        if (results.length === 0) {
            return undefined;
        }

        // Determine the candidate that is closest to the given source node
        let closestIndex = containerChain.length;
        let closestElement: TracedModelElement | undefined;
        for (const [candidate, element] of results) {
            const index = containerChain.indexOf(candidate);
            if (index < closestIndex) {
                closestIndex = index;
                closestElement = element;
            }
        }
        return closestElement;
    }

    private findTargetElements(element: TracedModelElement, uri2Container: Map<string, AstNode>, results: Array<[AstNode, TracedModelElement]>): void {
        if (element.trace) {
            const elementUri = URI.parse(element.trace).with({ query: null });
            const candidate = uri2Container.get(elementUri.toString());
            if (candidate) {
                results.push([candidate, element]);
            }
        }
        if (element.children) {
            for (const child of element.children) {
                this.findTargetElements(child, uri2Container, results);
            }
        }
    }

}
