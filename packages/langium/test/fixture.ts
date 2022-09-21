/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { ExpectFunction } from '../src/test';

/**
 * Expectation function for jest. Accepts any primitive/objects and does a deep recursive comparison.
 * @param a Actual element
 * @param e Expected element
 */
export const expectFunction: ExpectFunction = (a, e) => expect(a).toEqual(e);
