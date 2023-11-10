/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { URI } from 'langium';
import { expandToString } from 'langium/generate';
import type { DomainModelServices } from '../language-server/domain-model-module.js';

export function generateWorkspace(services: DomainModelServices, width: number, size: number): void {
    for (let i = 0; i < width; i++) {
        const index = i % 2 === 0 ? i : i - 1;
        const document = services.shared.workspace.LangiumDocumentFactory.fromString(generateFile(i, index, size), URI.parse(`benchmark://${i}.dmodel`));
        services.shared.workspace.LangiumDocuments.addDocument(document);
    }
}

function generateFile(index: number, targetIndex: number, size: number): string {
    let text = '';
    for (let i = 0; i < size; i++) {
        text += expandToString`
            package P${index}_${i} {
                datatype D

                entity E {
                    data: P${targetIndex}_0.D
                    entity: P${targetIndex}_0.E
                }
            }
        `;
    }
    return text;
}