/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import fs from 'fs';
import { CompositeGeneratorNode, NL, processGeneratorNode } from 'langium';
import path from 'path';
import { Model } from '../language-server/generated/ast';

export function generateJavaScript(model: Model, fileName: string, destination: string | undefined): string {
    fileName = fileName.replace(/\..*$/, '').replace(/[.-]/g, '');
    destination = destination ?? `./${path.dirname(fileName)}/generated`;
    const generatedFilePath = `${destination}/${path.basename(fileName)}.js`;

    const fileNode = new CompositeGeneratorNode();
    fileNode.append('"use strict";', NL, NL);
    model.greetings.forEach(greeting => fileNode.append(`console.log('Hello, ${greeting.person.$refName}!');`, NL));

    if (!fs.existsSync(destination)) {
        fs.mkdirSync(destination, { recursive: true });
    }
    fs.writeFileSync(generatedFilePath, processGeneratorNode(fileNode));
    return generatedFilePath;
}