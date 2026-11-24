/******************************************************************************
 * Copyright 2026 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DefaultLangiumProfiler } from 'langium';

describe('DefaultLangiumProfiler', () => {

    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'info').mockImplementation(() => {});
        vi.spyOn(console, 'table').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('records keep their sub-task entries after the task is stopped and run again', () => {
        const profiler = new DefaultLangiumProfiler(new Set(['validating']));
        const task = profiler.createTask('validating', 'Task');

        task.start();
        task.startSubTask('A');
        task.stopSubTask('A');
        task.startSubTask('A');
        task.stopSubTask('A');
        task.startSubTask('B');
        task.stopSubTask('B');
        task.stop();

        task.start();
        task.startSubTask('C');
        task.stopSubTask('C');
        task.stop();

        const [first, second] = profiler.getRecords('validating').toArray();
        expect([...first.entries.keys()]).toEqual(['A', 'B']);
        expect(first.entries.get('A')).toHaveLength(2);
        expect(first.entries.get('B')).toHaveLength(1);
        expect([...second.entries.keys()]).toEqual(['C']);
        expect(second.entries.get('C')).toHaveLength(1);
    });
});
