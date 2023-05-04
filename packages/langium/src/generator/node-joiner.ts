/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { AstNode, Properties } from '../syntax-tree';
import type { Generated } from './generator-node';
import type { SourceRegion } from './generator-tracing';
import { CompositeGeneratorNode, traceToNode } from './generator-node';

export interface JoinOptions<T> {
    filter?: (element: T, index: number, isLast: boolean) => boolean;
    prefix?: (element: T, index: number, isLast: boolean) => Generated | undefined;
    suffix?: (element: T, index: number, isLast: boolean) => Generated | undefined;
    separator?: Generated;
    appendNewLineIfNotEmpty?: true;
}

/**
 * Joins the elements of the given `iterable` by applying `toGenerated` to each element
 * and appending the results to a {@link CompositeGeneratorNode} being returned finally.
 *
 * Note: empty strings being returned by `toGenerated` are treated as ordinary string
 * representations, while the result of `undefined` makes this function to ignore the
 * corresponding item and no separator is appended, if configured.
 *
 * Examples:
 * ```
 *   exandToNode`
 *       ${ joinToNode(['a', 'b'], String, { appendNewLineIfNotEmpty: true }) }
 *
 *       ${ joinToNode(new Set(['a', undefined, 'b']), e => e && String(e), { separator: ',', appendNewLineIfNotEmpty: true }) }
 *   `
 * ```
 *
 * @param iterable an {@link Array} or {@link Iterable} providing the elements to be joined
 *
 * @param toGenerated a callback converting each individual element to a string, a
 *  {@link CompositeGeneratorNode}, or undefined if to be omitted, defaults to {@link String}
 *
 * @param options optional config object for defining a `separator`, contributing specialized
 *  `prefix` and/or `suffix` providers, and activating conditional line-break insertion. In addition,
 *  a dedicated `filter` function can be provided that is required get provided with the original
 *  element indices in the aformentioned functions, if the list is to be filtered. If
 *  {@link Array.filter} would be applied to the original list, the indices will be those of the
 *  filtered list during subsequent processing that in particular will cause confusion when using
 *  the tracing variant of this function named ({@link joinTracedToNode}).
 * @returns the resulting {@link CompositeGeneratorNode} representing `iterable`'s content
 */
export function joinToNode<T>(
    iterable: Iterable<T> | T[],
    toGenerated: (element: T, index: number, isLast: boolean) => Generated = String,
    { filter, prefix, suffix, separator, appendNewLineIfNotEmpty }: JoinOptions<T> = {}
): CompositeGeneratorNode | undefined {

    return reduceWithIsLast(iterable, (node, it, i, isLast) => {
        if (filter && !filter(it, i, isLast)) {
            return node;
        }
        const content = toGenerated(it, i, isLast);
        return (node ??= new CompositeGeneratorNode())
            .append(prefix && prefix(it, i, isLast))
            .append(content)
            .append(suffix && suffix(it, i, isLast))
            .appendIf(!isLast && content !== undefined, separator)
            .appendNewLineIfNotEmptyIf(
                // append 'newLineIfNotEmpty' elements only if 'node' has some content already,
                //  as if the parent is an IndentNode with 'indentImmediately' set to 'false'
                //  the indentation is not properly applied to the first non-empty line of the (this) child node
                !node.isEmpty() && !!appendNewLineIfNotEmpty
            );
    });
}

/**
 * Convenience function for joining the elements of some `iterable` and gathering tracing information.
 *
 * This function returns another function that does the processing, and that expects same list of
 *  arguments as expected by {@link joinToNode}, i.e. an `iterable`, a function `toGenerated`
 *  converting each element into a `Generated`, as well as some `options`.
 *
 * That function than joins the elements of `iterable` by delegating to {@link joinToNode}.
 * Via {@link traceToNode} the resulting generator node is supplemented with the provided tracing
 *  information in form of `{astNode, property?, index?}`, and finally returned. In addition,
 *  if `property` is given each element's generator node representation is augmented with the
 *  provided tracing information plus the index of the element within `iterable`.
 *
 * @param astNode the AstNode corresponding to the appended content
 *
 * @param property the value property name (string) corresponding to the appended content,
 *  if e.g. the content corresponds to some `string` or `number` property of `astNode`, is optional
 *
 * @param index the index of the value within a list property corresponding to the appended content,
 *  if the property contains a list of elements, is ignored otherwise, is optinal,
 *  should not be given if no `property` is given
 *
 * @returns a function behaving as described above, which in turn returns a {@link CompositeGeneratorNode}.
 *
 * @example
 *   expandToNode`
 *       children: ${ joinTracedToNode(entity, 'children')(entity.children, child => child.name, { separator: ' ' }) };
 *   `.appendNewLine()
 */
export function joinTracedToNode<T extends AstNode>(astNode: T, property?: Properties<T>): // eslint-disable-next-line @typescript-eslint/indent
    <E>(iterable: Iterable<E> | E[], toGenerated?: (element: E, index: number, isLast: boolean) => Generated, options?: JoinOptions<E>) => CompositeGeneratorNode | undefined;

/**
 * Convenience function for joining the elements of some `iterable` and gathering tracing information
 *  in form of concrete coordinates.
 *
 * This function returns another function that does the processing, and that expects same list of
 *  arguments as expected by {@link joinToNode}, i.e. an `iterable`, a function `toGenerated`
 *  converting each element into a `Generated`, as well as some `options`.
 *
 * That function than joins the elements of `iterable` by delegating to {@link joinToNode}.
 * Via {@link traceToNode} the resulting generator node is supplemented with the provided tracing
 *  information, and finally returned. Elementwise tracing need to be implemented by client code
 *  within `toGenerated`, if required.
 *
 * @param sourceRegion a text region within some file in form of concrete coordinates,
 *  if `undefined` no tracing will happen
 *
 * @returns a function behaving as described above, which in turn returns a {@link CompositeGeneratorNode}.
 *
 * @example
 *   expandToNode`
 *       children: ${ joinTracedToNode(findNodesForProperty(entity.$cstNode, 'children'))(entity.children, child => child.name, { separator: ' ' }) };
 *   `.appendNewLine()
 */
export function joinTracedToNode(sourceRegion: SourceRegion | undefined): // eslint-disable-next-line @typescript-eslint/indent
    <E>(iterable: Iterable<E> | E[], toGenerated?: (element: E, index: number, isLast: boolean) => Generated, options?: JoinOptions<E>) => CompositeGeneratorNode | undefined;

/**
 * Convenience function for joining the elements of some `iterable` and gathering tracing information
 *  in form of a list of concrete coordinates.
 *
 * This function returns another function that does the processing, and that expects same list of
 *  arguments as expected by {@link joinToNode}, i.e. an `iterable`, a function `toGenerated`
 *  converting each element into a `Generated`, as well as some `options`.
 *
 * That function than joins the elements of `iterable` by delegating to {@link joinToNode}.
 * Via {@link traceToNode} the resulting generator node is supplemented with the provided tracing
 *  information, and finally returned. Elementwise tracing need to be implemented by client code
 *  within `toGenerated`, if required.
 *
 * The list of regions in `sourceRegions` will later be reduced to the smallest encompassing region
 *  of all the contained source regions.
 *
 * @param sourceRegions a list of text regions within some file in form of concrete coordinates,
 *  if empty no tracing will happen
 *
 * @returns a function behaving as described above, which in turn returns a {@link CompositeGeneratorNode}.
 *
 * @example
 *   expandToNode`
 *       children: ${ joinTracedToNode(findNodesForProperty(entity.$cstNode, 'children'))(entity.children, child => child.name, { separator: ' ' }) };
 *   `.appendNewLine()
 */
export function joinTracedToNode(sourceRegions: SourceRegion[]): // eslint-disable-next-line @typescript-eslint/indent
    <E>(iterable: Iterable<E> | E[], toGenerated?: (element: E, index: number, isLast: boolean) => Generated, options?: JoinOptions<E>) => CompositeGeneratorNode | undefined;

// implementation:
export function joinTracedToNode<T extends AstNode>(source: T | undefined | SourceRegion | SourceRegion[], property?: Properties<T>): // eslint-disable-next-line @typescript-eslint/indent
    <E>(iterable: Iterable<E> | E[], toGenerated?: (element: E, index: number, isLast: boolean) => Generated, options?: JoinOptions<E>) => CompositeGeneratorNode | undefined {
    return (iterable, toGenerated = String, options) => {
        return traceToNode(source as T, property)(
            joinToNode(
                iterable,
                source && property ? (element, index, isLast) => traceToNode(source as T, property, index)(toGenerated(element, index, isLast)) : toGenerated,
                options
            )
        );
    };
}

/**
 * Convenience function for joining the elements of some `iterable` and gathering tracing information,
 *  if `condition` is equal to `true`.
 *
 * If `condition` is satisfied, this function returns another function that does the processing,
 *  and that expects same list of arguments as expected by {@link joinToNode}, i.e. an `iterable`,
 *  a function `toGenerated` converting each element into a `Generated`, as well as some `options`.
 *
 * That function than joins the elements of `iterable` by delegating to {@link joinToNode}.
 * Via {@link traceToNode} the resulting generator node is supplemented with the provided tracing
 *  information, and finally returned. In addition, if `property` is given each element's
 *  generator node representation is augmented with the provided tracing information
 *  plus the index of the element within `iterable`.
 *
 * Otherwise, if `condition` is equal to false, the returned function just returns `undefined`.
 *
 * @param condition a boolean value indicating whether to evaluate the provided iterable.
 *
 * @param astNode the AstNode corresponding to the appended content
 *
 * @param property the value property name (string) corresponding to the appended content,
 *  if e.g. the content corresponds to some `string` or `number` property of `astNode`, is optional
 *
 * @param index the index of the value within a list property corresponding to the appended content,
 *  if the property contains a list of elements, is ignored otherwise, is optinal,
 *  should not be given if no `property` is given
 *
 * @returns a function behaving as described above, which in turn returns a {@link CompositeGeneratorNode} or `undefined`.
 *
 * @example
 *   expandToNode`
 *       children: ${ joinTracedToNode(entity, 'children')(entity.children, child => child.name, { separator: ' ' }) };
 *   `.appendNewLine()
 */
export function joinTracedToNodeIf<T extends AstNode>(condition: boolean, astNode: T, property?: Properties<T>): // eslint-disable-next-line @typescript-eslint/indent
    <E>(iterable: Iterable<E> | E[], toGenerated?: (element: E, index: number, isLast: boolean) => Generated, options?: JoinOptions<E>) => CompositeGeneratorNode | undefined;

/**
 * Convenience function for joining the elements of some `iterable` and gathering tracing information
 *  in form of a list of concrete coordinates, if `condition` is equal to `true`.
 *
 * If `condition` is satisfied, this function returns another function that does the processing,
 *  and that expects same list of arguments as expected by {@link joinToNode}, i.e. an `iterable`,
 *  a function `toGenerated` converting each element into a `Generated`, as well as some `options`.
 *
 * That function than joins the elements of `iterable` by delegating to {@link joinToNode}.
 * Via {@link traceToNode} the resulting generator node is supplemented with the provided tracing
 *  information, and finally returned. Element-wise tracing need to be implemented by client code
 *  within `toGenerated`, if required.
 *
 * Otherwise, if `condition` is equal to false, the returned function just returns `undefined`.
 *
 * If `sourceRegion` is a function supplying the corresponding regions, it's only called if `condition` is satisfied.
 *
 * @param condition a boolean value indicating whether to evaluate the provided iterable.
 *
 * @param sourceRegion a text region within some file in form of concrete coordinates or a supplier function,
 *  if `undefined` no tracing will happen
 *
 * @returns a function behaving as described above, which in turn returns a {@link CompositeGeneratorNode}.
 *
 * @example
 *   expandToNode`
 *       children: ${ joinTracedToNodeIf(entity !== undefined, () => entity.$cstNode)(entity.children, child => child.name, { separator: ' ' }) };
 *   `.appendNewLine()
 */
export function joinTracedToNodeIf(condition: boolean, sourceRegion: SourceRegion | undefined | (() => SourceRegion | undefined)): // eslint-disable-next-line @typescript-eslint/indent
    <E>(iterable: Iterable<E> | E[], toGenerated?: (element: E, index: number, isLast: boolean) => Generated, options?: JoinOptions<E>) => CompositeGeneratorNode | undefined;

/**
 * Convenience function for joining the elements of some `iterable` and gathering tracing information
 *  in form of a list of concrete coordinates, if `condition` is equal to `true`.
 *
 * If `condition` is satisfied, this function returns another function that does the processing,
 *  and that expects same list of arguments as expected by {@link joinToNode}, i.e. an `iterable`,
 *  a function `toGenerated` converting each element into a `Generated`, as well as some `options`.
 *
 * That function than joins the elements of `iterable` by delegating to {@link joinToNode}.
 * Via {@link traceToNode} the resulting generator node is supplemented with the provided tracing
 *  information, and finally returned. Element-wise tracing need to be implemented by client code
 *  within `toGenerated`, if required.
 *
 * Otherwise, if `condition` is equal to false, the returned function just returns `undefined`.
 *
 * The list of regions in `sourceRegions` will later be reduced to the smallest encompassing region
 *  of all the contained source regions.
 * If `sourceRegions` is a function supplying the corresponding regions, it's only called if `condition` is satisfied.
 *
 * @param condition a boolean value indicating whether to evaluate the provided iterable.
 *
 * @param sourceRegions a list of text regions within some file in form of concrete coordinates or a supplier function,
 *  if empty no tracing will happen
 *
 * @returns a function behaving as described above, which in turn returns a {@link CompositeGeneratorNode}.
 *
 * @example
 *   expandToNode`
 *       children: ${ joinTracedToNodeIf(entity !== undefined, () => findNodesForProperty(entity.$cstNode, 'children'))(entity.children, child => child.name, { separator: ' ' }) };
 *   `.appendNewLine()
 */
export function joinTracedToNodeIf(condition: boolean, sourceRegions: SourceRegion[] | (() => SourceRegion[])): // eslint-disable-next-line @typescript-eslint/indent
    <E>(iterable: Iterable<E> | E[], toGenerated?: (element: E, index: number, isLast: boolean) => Generated, options?: JoinOptions<E>) => CompositeGeneratorNode | undefined;

// implementation:
export function joinTracedToNodeIf<T extends AstNode>(condition: boolean, source: T | undefined | SourceRegion | SourceRegion[] | (() => undefined | SourceRegion | SourceRegion[]), property?: Properties<T>): // eslint-disable-next-line @typescript-eslint/indent
    <E>(iterable: Iterable<E> | E[], toGenerated?: (element: E, index: number, isLast: boolean) => Generated, options?: JoinOptions<E>) => CompositeGeneratorNode | undefined {
    return condition ? joinTracedToNode((typeof source === 'function' ? source() : source) as T, property) : () => undefined;
}

function reduceWithIsLast<T, R>(
    iterable: Iterable<T> | T[],
    callbackfn: (previous: R | undefined, current: T, currentIndex: number, isLast: boolean) => R | undefined,
    initial?: R
) {
    const iterator = iterable[Symbol.iterator]();
    let next = iterator.next();
    let index = 0;
    let result = initial;

    while (!next.done) {
        const nextNext = iterator.next();
        result = callbackfn(result, next.value, index, Boolean(nextNext.done));
        next = nextNext;
        index++;
    }

    return result;
}
