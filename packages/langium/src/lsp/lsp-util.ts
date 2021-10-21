/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { ResponseError } from 'vscode-languageserver';
import { MaybePromise } from '../utils/promise-util';

export type Response<R, E = void> = MaybePromise<R | ResponseError<E>>

export type AsyncResponse<R, E = void> = Promise<R | ResponseError<E>>
