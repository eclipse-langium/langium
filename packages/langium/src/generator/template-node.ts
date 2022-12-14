/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CompositeGeneratorNode, EOL, Generated, GeneratorNode, isGeneratorNode, isNewLineNode, NewLineNode } from './generator-node';
import { findIndentation } from './template-string';

const NEWLINE = Object.freeze(new NewLineNode());
const UNDEFINED_SEGMENT = Object.freeze(new CompositeGeneratorNode());

/**
 * A tag function that attaches the template's content to a {@link CompositeGeneratorNode}.
 * This is done segment by segment, and static template portions as well as substitutions
 * are added individually to the returned {@link CompositeGeneratorNode}.
 * At that common leading indentation of all the template's static parts is trimmed,
 * whereas additional indentations of particular lines within that static parts as well as
 * any linebreaks and indentation within the substititions are kept.
 *
 * For the sake of good readability and good compositionality of results of this function like
 * in the following example, the subsequent rule is applied.
 *
 * ```ts
 *  expandToNode`
 *   This is the beginning of something
 *
 *   ${foo.bar ? epandToNode`
 *     bla bla bla ${foo.bar}
 *
 *   `: undefined
 *   }
 *   end of template
 *  `
 * ```
 *
 * Rule:
 * In case of a multiline template the content of the first line including its terminating
 * linebreak is ignored, if and only if it is empty of contains white space only. Futhermore,
 * in case of a multiline template the content of the last line including its preceding linebreak
 * (last one within the template) is ignored, if and only if it is empty of contains white space only.
 * Thus, the result of all of the following invocations is identical and equal to `generatedContent`.
 * ```ts
 *  expandToNode`generatedContent`
 *  expandToNode`generatedContent
 *  `
 *  expandToNode`
 *    generatedContent`
 *  expandToNode`
 *    generatedContent
 *  `
 * ```
 *
 * @param staticParts the static parts of a tagged template literal
 * @param substitutions the variable parts of a tagged template literal
 * @returns a 'CompositeGeneratorNode' containing the particular aligned lines
 *             after resolving and inserting the substitutions into the given parts
 */
export function expandToNode(staticParts: TemplateStringsArray, ...substitutions: unknown[]): CompositeGeneratorNode {
    // first part: determine the common indentation of all the template lines whith the substitutions being ignored
    const templateProps = findIndentationAndTemplateStructure(staticParts);

    // 2nd part: for all the static template parts: split them and inject a NEW_LINE marker where linebreaks shall be a present in the final result,
    //  and create a flatten list of strings, NEW_LINE marker occurrences, and subsitutions
    const splitAndMerged: Generated[] = splitTemplateLinesAndMergeWithSubstitions(staticParts, substitutions, templateProps);

    // eventually, inject indentation nodes and append the segments to final desired composite generator node
    return composeFinalGeneratorNode(splitAndMerged);
}

type TemplateProps = {
    indentation: number;
    omitFirstLine: boolean;
    omitLastLine: boolean;
    trimLastLine?: boolean;
}

function findIndentationAndTemplateStructure(staticParts: TemplateStringsArray): TemplateProps {
    const lines = staticParts.join('_').split(EOL);
    const omitFirstLine = lines.length > 1 && lines[0].trim().length === 0;
    const omitLastLine = omitFirstLine && lines.length > 1 && lines[lines.length - 1].trim().length === 0;

    if (lines.length === 1 || lines.length !== 0 && lines[0].trim().length !== 0 || lines.length === 2 && lines[1].trim().length === 0) {
        // for cases of non-adjusted templates like
        //   const n1 = expandToNode` `;
        //   const n2 = expandToNode` something `;
        //   const n3 = expandToNode` something
        //   `;
        // ... consider the indentation to be empty, and all the leading white space to be relevant, except for the last (empty) line of n3!
        return {
            indentation: 0, //''
            omitFirstLine,
            omitLastLine,
            trimLastLine: lines.length !== 1 && lines[lines.length - 1].trim().length === 0
        };
    } else {
        // otherwise:
        // for cases of non-adjusted templates like
        //   const n4 = expandToNode` abc
        //     def `;
        //   const n5 = expandToNode`<maybe with some WS here>
        //      abc
        //     def`;
        //   const n6 = expandToNode`<maybe with some WS here>
        //      abc
        //     def
        //   `;
        // ... the indentation shall be determined by the non-empty lines, excluding the last line if it contains white space only

        // if we have a multi-line template and the first line is empty, see n5, n6
        //  ignore the first line;
        let sliced = omitFirstLine ? lines.slice(1) : lines;

        // if there're more than one line remaining and the last one only contains WS, see n6,
        //  ignore the last line
        sliced = omitLastLine ? sliced.slice(0, sliced.length - 1) : sliced;

        // ignore empty lines during indentation calculation, as linting rules might forbid lines containing just whitespace
        sliced = sliced.filter(e => e.length !== 0);

        const indentation = findIndentation(sliced);
        return {
            indentation,
            omitFirstLine,
            // in the subsequent steps omit the last line only if it is empty or if it only contains white space of which the common indentation is not a valid prefix;
            //  in other words: keep the last line if it matches the common indentation (and maybe contains non-whitespace), a non-match may be due to mistaken usage of tabs and spaces
            omitLastLine: omitLastLine && (
                lines[lines.length - 1].length < indentation || !lines[lines.length - 1].startsWith(sliced[0].substring(0, indentation))
            )
        };
    }
}

function splitTemplateLinesAndMergeWithSubstitions(
    staticParts: TemplateStringsArray, substitutions: unknown[], { indentation, omitFirstLine, omitLastLine, trimLastLine }: TemplateProps
): Generated[] {
    const splitAndMerged: Generated[] = [];
    staticParts.forEach((part, i) => {
        splitAndMerged.push(
            ...part.split(
                EOL
            ).map((e, j) => j === 0 || e.length < indentation ? e : e.substring(indentation)
            ).reduce<Generated[]>(
                // treat the particular (potentially multiple) lines of the <i>th template segment (part),
                //  s.t. all the effective lines are collected and separated by the NEWLINE node
                // note: different reduce functions are provided for the initial template segment vs. the remaining segments
                i === 0
                    ? (result, line, j) =>
                        // special handling of the initial template segment, which may contain line-breaks;
                        //  suppresses the injection of unintended NEWLINE indicators for templates like
                        //   expandToNode`
                        //    someText
                        //    ${something}
                        //   `
                        j === 0
                            ? (omitFirstLine                    // for templates with empty first lines like above (expandToNode`\n ...`)
                                ? []                            // skip adding the initial line
                                : [line]                        //  take the initial line if non-empty
                            )
                            : (j === 1 && result.length === 0   // when looking on the 2nd line in case the first line (in the first segment) is skipped ('result' is still empty)
                                ? [line]                        // skip the insertion of the NEWLINE marker and just return the current line
                                : result.concat(NEWLINE, line)  // otherwise append the NEWLINE marker and the current line
                            )
                    : (result, line, j) =>
                        // handling of the remaining template segments
                        j === 0 ? [line] : result.concat(NEWLINE, line) // except for the first line in the current segment prepend each line with NEWLINE
                , [] // start with an empty array
            ).filter(
                e => !(typeof e === 'string' && e.length === 0)         // drop empty strings, they don't contribute anything but might confuse subsequent processing
            ).concat(
                // append the corresponding substitution after each segment (part),
                //  note that 'substitutions[i]' will be undefined for the last segment
                isGeneratorNode(substitutions[i])
                    // if the substitution is a generator node, take it as it is
                    ? substitutions[i] as GeneratorNode
                    : substitutions[i] !== undefined
                        // if the substitution is something else, convert it to a string and wrap it in a node;
                        //  allows us below to distinghuish template strings from substitution (esp. empty) ones
                        ? new CompositeGeneratorNode(String(substitutions[i]))
                        : i < substitutions.length
                            // if 'substitutions[i]' is undefined and we are treating a substitution "in the middle"
                            //   we found a substition that is assumed to not contribute anything on purpose!
                            ? UNDEFINED_SEGMENT  // add a corresponding marker, see below for details on the rational
                            : []                 /* don't concat anything as we passed behind the last substitution, since 'i' enumerates the indices of 'staticParts',
                                                     but 'substitutions' has one entry less and 'substitutions[staticParts.length -1 ]' will always be undefined */
            )
        );
    });

    // for templates like
    //   expandToNode`
    //    someText
    //   `

    // TODO add more documentation here

    const splitAndMergedLength = splitAndMerged.length;
    const lastItem = splitAndMergedLength !== 0 ? splitAndMerged[splitAndMergedLength-1] : undefined;

    if ((omitLastLine || trimLastLine) && typeof lastItem === 'string' && lastItem.trim().length === 0) {
        if (omitFirstLine && splitAndMergedLength !== 1 && splitAndMerged[splitAndMergedLength-2] === NEWLINE) {
            return splitAndMerged.slice(0, splitAndMergedLength-2);
        } else {
            return splitAndMerged.slice(0, splitAndMergedLength-1);
        }
    } else {
        return splitAndMerged;
    }
}

function composeFinalGeneratorNode(splitAndMerged: Generated[]): CompositeGeneratorNode {
    // in order to properly handle the indentation of nested multi-line substitutions,
    //  track the length of static (string) parts per line and wrap the substitution(s) in indentation nodes, if needed
    //
    // of course, this only works nicely if a multi-line substitution is preceded by static string parts on the same line only;
    // in case of dynamic content (with a potentially unknown length) followed by a multi-line substitution
    //  the latter's indentation cannot be determined properly...
    const result = splitAndMerged.reduce<{
        indent: string,
        node: CompositeGeneratorNode
    }>(
        (res, segment, i) => segment === UNDEFINED_SEGMENT
            // ignore all occurences of UNDEFINED_SEGMENT, they are just in there for the below test
            //  of 'isNewLineNode(splitAndMerged[i-1])' not to evaluate to 'truthy' in case of consecutive lines
            //  with no actual content in templates like
            //   expandToNode`
            //     Foo
            //     ${undefined} <<----- here
            //     ${undefined} <<----- and here
            //
            //     Bar
            //   `
            ? res
            : segment === NEWLINE
                ? {
                    indent: '',
                    node: (i === 0 || isNewLineNode(splitAndMerged[i-1]) || typeof splitAndMerged[i - 1] === 'string')
                        ? res.node.appendNewLine() : res.node.appendNewLineIfNotEmpty()
                } : (() => {
                    // the indentation handling is supposed to handle use cases like
                    //   bla bla bla {
                    //      ${foo(bar)}
                    //   }
                    // and
                    //   bla bla bla {
                    //      return ${foo(bar)}
                    //   }
                    // assuming that ${foo(bar)} yields a multiline result;
                    // the whitespace between 'return' and '${foo(bar)}' shall not add to the indentation of '${foo(bar)}'s result!
                    const indent: string = res.indent === '' && typeof segment === 'string' && segment.length !== 0 ? ''.padStart(segment.length - segment.trimLeft().length) : res.indent;
                    return {
                        indent,
                        node: res.indent.length === 0
                            ? res.node.append(segment)
                            : res.node.indent((indented) => indented.append(segment), res.indent)
                    };
                })(),
        {indent: '', node: new CompositeGeneratorNode()}
    );

    return result.node;
}

export interface JoinOptions<T> {
    prefix?: (element: T, index: number, isLast: boolean) => Generated|undefined;
    suffix?: (element: T, index: number, isLast: boolean) => Generated|undefined;
    appendNewLineIfNotEmpty?: true;
}

export function joinToNode<T>(
    iterable: Iterable<T>|T[],
    toString: (element: T, index: number, isLast: boolean) => Generated = String,
    { prefix, suffix, appendNewLineIfNotEmpty }: JoinOptions<T> = {}
): CompositeGeneratorNode|undefined {

    return reduceWithIsLast(iterable, (node, it, i, isLast) => {
        node ??= new CompositeGeneratorNode();
        return node
            .append(prefix && prefix(it, i, isLast))
            .append(toString(it, i, isLast))
            .append(suffix && suffix(it, i, isLast))
            .appendNewLineIfNotEmptyIf(
                // append 'newLineIfNotEmpty' elements only if 'node' has some content already,
                //  as if the parent is an IndentNode with 'indentImmediately' set to 'false'
                //  the indentation is not properly applied to the first non-empty line of the (this) child node
                !node.isEmpty() && !!appendNewLineIfNotEmpty
            );
    });
}

function reduceWithIsLast<T, R>(
    iterable: Iterable<T>|T[],
    callbackfn: (previous: R|undefined, current: T, currentIndex: number, isLast: boolean) => R,
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