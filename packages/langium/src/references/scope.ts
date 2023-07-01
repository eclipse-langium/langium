/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { AstNodeDescription } from '../syntax-tree';
import type { Stream} from '../utils/stream';
import { EMPTY_STREAM, stream } from '../utils/stream';

/**
 * A scope describes what target elements are visible from a specific cross-reference context.
 */
export interface Scope {

    /**
     * Find a target element matching the given name. If no element is found, `undefined` is returned.
     * If multiple matching elements are present, the selection of the returned element should be done
     * according to the semantics of your language. Usually it is the element that is most closely defined.
     *
     * @param name Name of the cross-reference target as it appears in the source text.
     */
    getElement(name: string): AstNodeDescription | undefined;

    /**
     * Create a stream of all elements in the scope. This is used to compute completion proposals to be
     * shown in the editor.
     */
    getAllElements(): Stream<AstNodeDescription>;

}

export interface ScopeOptions {
    caseInsensitive?: boolean;
}

/**
 * The default scope implementation is based on a `Stream`. It has an optional _outer scope_ describing
 * the next level of elements, which are queried when a target element is not found in the stream provided
 * to this scope.
 */
export class StreamScope implements Scope {
    readonly elements: Stream<AstNodeDescription>;
    readonly outerScope?: Scope;
    readonly caseInsensitive?: boolean;

    constructor(elements: Stream<AstNodeDescription>, outerScope?: Scope, options?: ScopeOptions) {
        this.elements = elements;
        this.outerScope = outerScope;
        this.caseInsensitive = options?.caseInsensitive;
    }

    getAllElements(): Stream<AstNodeDescription> {
        if (this.outerScope) {
            return this.elements.concat(this.outerScope.getAllElements());
        } else {
            return this.elements;
        }
    }

    getElement(name: string): AstNodeDescription | undefined {
        const local = this.caseInsensitive
            ? this.elements.find(e => e.name.toLowerCase() === name.toLowerCase())
            : this.elements.find(e => e.name === name);
        if (local) {
            return local;
        }
        if (this.outerScope) {
            return this.outerScope.getElement(name);
        }
        return undefined;
    }
}

export class MapScope implements Scope {
    readonly elements: Map<string, AstNodeDescription>;
    readonly outerScope?: Scope;
    readonly caseInsensitive?: boolean;

    constructor(elements: Iterable<AstNodeDescription>, outerScope?: Scope, options?: ScopeOptions) {
        this.elements = new Map();
        this.caseInsensitive = options?.caseInsensitive;
        for (const element of elements) {
            const name = this.caseInsensitive
                ? element.name.toLowerCase()
                : element.name;
            this.elements.set(name, element);
        }
        this.outerScope = outerScope;
    }

    getElement(name: string): AstNodeDescription | undefined {
        name = this.caseInsensitive ? name.toLowerCase() : name;
        return this.elements.get(name);
    }
    getAllElements(): Stream<AstNodeDescription> {
        let elementStream = stream(this.elements.values());
        if (this.outerScope) {
            elementStream = elementStream.concat(this.outerScope.getAllElements());
        }
        return elementStream;
    }

}

export const EMPTY_SCOPE: Scope = {
    getElement(): undefined {
        return undefined;
    },
    getAllElements(): Stream<AstNodeDescription> {
        return EMPTY_STREAM;
    }
};
