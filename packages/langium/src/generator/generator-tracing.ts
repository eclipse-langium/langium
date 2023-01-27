/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { AstNodeRegionWithAssignments, AstNodeWithTextRegion } from '../serializer/json-serializer';
import type { AstNode, GenericAstNode } from '../syntax-tree';
import { getDocument } from '../utils/ast-util';
import { findNodesForProperty } from '../utils/grammar-util';
import { TreeStreamImpl } from '../utils/stream';
import type { DocumentSegment } from '../workspace/documents';

export interface TraceSourceSpec {
    astNode: AstNode;
    property?: string;
    index?: number;
}

export interface TextRange {
    fileURI?: string;
    offset: number;
    length: number;
}

export interface TraceRegion {
    sourceRegion?: TextRange;
    targetRegion: TextRange;
    children?: TraceRegion[];
}

export interface DocumentSegmentWithFileURI extends DocumentSegment {
    fileURI?: string;
}

export function getSourceRegion(sourceSpec: TraceSourceSpec | undefined): DocumentSegmentWithFileURI | undefined {
    const { astNode, property, index } = sourceSpec ?? {};
    const textRegion: AstNodeRegionWithAssignments | undefined = astNode?.$cstNode ?? (astNode as AstNodeWithTextRegion)?.$textRegion;

    if (astNode === undefined || textRegion === undefined) {
        return undefined;

    } else if (property === undefined) {
        return copyDocumentSegment(textRegion, getDocumentURI(astNode));

    } else {
        const getSingleOrCompoundRegion = (regions: DocumentSegment[]) => {
            if (index !== undefined && index > -1 && Array.isArray((astNode as GenericAstNode)[property])) {
                return index < regions.length ? regions[index] : undefined;

            } else {
                return regions.reduce( mergeDocumentSegment );
            }
        };

        if (textRegion.assignments?.[property]) {
            const region = getSingleOrCompoundRegion(
                textRegion.assignments[property]
            );
            return region && { ...region, fileURI: getDocumentURI(astNode) };

        } else if (astNode.$cstNode) {
            const region = getSingleOrCompoundRegion(
                findNodesForProperty(astNode.$cstNode, property)
            );
            return region && copyDocumentSegment(region, getDocument(astNode)?.uri?.toString());

        } else {
            return undefined;
        }
    }
}

function getDocumentURI(astNode: AstNodeWithTextRegion): string | undefined {
    if (astNode.$cstNode) {
        return getDocument(astNode)?.uri?.toString();

    } else if (astNode.$textRegion) {
        return astNode.$textRegion.documentURI
            || new TreeStreamImpl(astNode, n => n.$container ? [ n.$container ] : []).find( n => n.$textRegion?.documentURI )?.$textRegion?.documentURI;

    } else {
        return undefined;
    }
}

function copyDocumentSegment(region: DocumentSegment, fileURI?: string): DocumentSegmentWithFileURI {
    return {
        offset: region.offset,
        end: region.end,
        length: region.length,
        range: region.range,
        fileURI
    };
}

function mergeDocumentSegment(prev: DocumentSegment, curr: DocumentSegment): DocumentSegment {
    const result = <DocumentSegment>{
        offset: Math.min(prev.offset, curr.offset),
        end: Math.max(prev.end, curr.end),
        get length() {
            return result.end - result.offset;
        },
        range: {
            start: curr.range.start.line < prev.range.start.line
                    || curr.range.start.line === prev.range.start.line && curr.range.start.character < prev.range.start.character
                ? curr.range.start : prev.range.start,
            end: curr.range.end.line > prev.range.end.line
                    || curr.range.end.line === prev.range.end.line && curr.range.end.character > prev.range.end.character
                ? curr.range.end : prev.range.end
        }
    };
    return result;
}