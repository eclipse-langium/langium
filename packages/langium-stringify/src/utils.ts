/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

export type Cardinality = '?' | '*' | '+';

export function isOptionalCardinality(cardinality?: Cardinality): boolean {
    return cardinality === '?' || cardinality === '*';
}
