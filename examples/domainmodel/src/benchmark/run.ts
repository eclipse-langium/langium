/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { EmptyFileSystem } from 'langium';
import { createDomainModelServices } from '../language-server/domain-model-module.js';
import { generateWorkspace } from './generate.js';
import { performance, PerformanceObserver } from 'node:perf_hooks';

const perfObserver = new PerformanceObserver((items) => {
    items.getEntries().forEach((entry) => {
        console.log(`Benchmark duration for '${entry.name}': ${entry.duration.toFixed(3)}ms`);
    });
});

perfObserver.observe({ entryTypes: ['measure'] });

async function timeBenchmark(name: string, width: number, size: number): Promise<void> {
    const services = createDomainModelServices(EmptyFileSystem);
    generateWorkspace(services.domainmodel, width, size);
    const startMarker = name + '_start';
    const endMarker = name + '_end';
    performance.mark(startMarker);
    await services.shared.workspace.DocumentBuilder.build(services.shared.workspace.LangiumDocuments.all.toArray());
    performance.mark(endMarker);
    performance.measure(name, startMarker, endMarker);
}

(async () => {
    await timeBenchmark('1000 small files', 1000, 1);
    await timeBenchmark('single large file', 1, 1000);
    await timeBenchmark('50 medium sized files', 50, 50);
})();
