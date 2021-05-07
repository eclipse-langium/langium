export interface ArrayLikeStream<T> extends Iterable<T> {
    filter(callback: (element: T) => boolean): Stream<T>
    map<T2>(callback: (element: T) => T2): Stream<T2>
    find(predicate: (value: T, index: number) => boolean): T | undefined
    forEach(callback: (element: T, index: number) => void): void
    indexOf(element: T): number
}

export interface Stream<T> extends ArrayLikeStream<T> {
    iterator(): Iterator<T>
}

export class StreamImpl<S, T> implements Stream<T> {
    protected readonly startFn: () => S;
    protected readonly nextFn: (state: S) => IteratorResult<T>;

    constructor(startFn: () => S, nextFn: (state: S) => IteratorResult<T>) {
        this.startFn = startFn;
        this.nextFn = nextFn;
    }

    iterator(): Iterator<T> {
        const iterator = {
            state: this.startFn(),
            next: () => this.nextFn(iterator.state),
            [Symbol.iterator]: () => iterator
        };
        return iterator;
    }

    [Symbol.iterator](): Iterator<T> {
        return this.iterator();
    }

    filter(callback: (element: T) => boolean): Stream<T> {
        return filterStream(this, callback);
    }

    map<T2>(callback: (element: T) => T2): Stream<T2> {
        return mapStream(this, callback);
    }

    find<S extends T>(predicate: (value: T, index: number) => value is S): S | undefined {
        const iterator = this.iterator();
        let index = 0;
        let result: IteratorResult<T>;
        do {
            result = iterator.next();
            if (predicate(result.value, index)) {
                return result.value;
            }
            index++;
        } while (!result.done);
        return undefined;
    }

    forEach(callback: (element: T, index: number) => void): void {
        const iterator = this.iterator();
        let index = 0;
        let result: IteratorResult<T>;
        do {
            result = iterator.next();
            if (result.value !== undefined) {
                callback(result.value, index);
            }
            index++;
        } while (!result.done);
    }

    indexOf(element: T): number {
        const iterator = this.iterator();
        let index = 0;
        let result: IteratorResult<T>;
        do {
            result = iterator.next();
            if (result.value === element) {
                return index;
            }
            index++;
        } while (!result.done);
        return -1;
    }
}

export class EmptyStream<T> implements Stream<T> {
    private readonly _iterator: Iterator<T>;

    constructor() {
        const iterator = {
            next: () => DONE_RESULT,
            [Symbol.iterator]: () => iterator
        };
        this._iterator = iterator;
    }

    iterator(): Iterator<T> {
        return this._iterator;
    }

    [Symbol.iterator](): Iterator<T> {
        return this._iterator;
    }

    filter(): Stream<T> {
        return EMPTY_STREAM;
    }

    map<T2>(): Stream<T2> {
        return EMPTY_STREAM;
    }

    find(): T | undefined {
        return undefined;
    }

    forEach(): void {
        // Nothing to do
    }

    indexOf(): number {
        return -1;
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const EMPTY_STREAM: EmptyStream<any> = new EmptyStream();

export function toArray<T>(input: Stream<T>): T[] {
    if (input.constructor === Array) {
        return input as T[];
    }
    const result: T[] = [];
    input.forEach(element => result.push(element));
    return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const DONE_RESULT: IteratorResult<any> = Object.freeze({ done: true, value: undefined });

export function filterStream<T>(input: Iterable<T> | ArrayLike<T>, callback: (element: T) => boolean): Stream<T> {
    return new StreamImpl(
        () => createIterator(input),
        (iterator) => {
            let result: IteratorResult<T>;
            do {
                result = iterator.next();
            } while (!result.done && !callback(result.value));
            return result;
        }
    );
}

export function mapStream<T1, T2>(input: Iterable<T1> | ArrayLike<T1>, callback: (element: T1) => T2): Stream<T2> {
    return new StreamImpl(
        () => createIterator(input),
        (iterator) => {
            const { done, value } = iterator.next();
            if (done) {
                return DONE_RESULT;
            } else {
                return { done: false, value: callback(value) };
            }
        }
    );
}

function createIterator<T>(collection: Iterable<T> | ArrayLike<T>): Iterator<T> {
    const method = (collection as Iterable<T>)[Symbol.iterator];
    if (typeof method === 'function') {
        return method.call(collection);
    }
    const length = (collection as ArrayLike<T>).length;
    if (typeof length === 'number' && length >= 0) {
        return new ArrayIterator(collection as ArrayLike<T>);
    }
    return { next: () => DONE_RESULT };
}

class ArrayIterator<T> implements IterableIterator<T> {
    private readonly array: ArrayLike<T>

    constructor(array: ArrayLike<T>) {
        this.array = array;
    }

    private index = 0;

    next(): IteratorResult<T> {
        if (this.index < this.array.length) {
            return { done: false, value: this.array[this.index++] };
        } else {
            return DONE_RESULT;
        }
    }

    [Symbol.iterator]() {
        return this;
    }
}

export interface TreeIterator<T> extends Iterator<T> {
    prune(): void
}

export interface TreeStream<T> extends Stream<T> {
    iterator(): TreeIterator<T>
}

export class TreeStreamImpl<T>
    extends StreamImpl<{ iterators: Array<Iterator<T>>, pruned: boolean }, T>
    implements TreeStream<T> {

    constructor(root: T, children: (node: T) => Stream<T>) {
        super(
            () => ({
                iterators: [children(root).iterator()],
                pruned: false
            }),
            state => {
                if (state.pruned) {
                    state.iterators.pop();
                    state.pruned = false;
                }
                while (state.iterators.length > 0) {
                    const iterator = state.iterators[state.iterators.length - 1];
                    const next = iterator.next();
                    if (next.done) {
                        state.iterators.pop();
                    } else {
                        state.iterators.push(children(next.value).iterator());
                        return next;
                    }
                }
                return DONE_RESULT;
            }
        );
    }

    iterator(): TreeIterator<T> {
        const iterator = {
            state: this.startFn(),
            next: () => this.nextFn(iterator.state),
            prune: () => {
                iterator.state.pruned = true;
            },
            [Symbol.iterator]: () => iterator
        };
        return iterator;
    }
}
