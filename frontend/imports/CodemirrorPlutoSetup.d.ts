/**
A text iterator iterates over a sequence of strings. When
iterating over a [`Text`](https://codemirror.net/6/docs/ref/#state.Text) document, result values will
either be lines or line breaks.
*/
interface TextIterator extends Iterator<string>, Iterable<string> {
    /**
    Retrieve the next string. Optionally skip a given number of
    positions after the current position. Always returns the object
    itself.
    */
    next(skip?: number): this;
    /**
    The current string. Will be the empty string when the cursor is
    at its end or `next` hasn't been called on it yet.
    */
    value: string;
    /**
    Whether the end of the iteration has been reached. You should
    probably check this right after calling `next`.
    */
    done: boolean;
    /**
    Whether the current string represents a line break.
    */
    lineBreak: boolean;
}
/**
The data structure for documents. @nonabstract
*/
declare abstract class Text implements Iterable<string> {
    /**
    The length of the string.
    */
    abstract readonly length: number;
    /**
    The number of lines in the string (always >= 1).
    */
    abstract readonly lines: number;
    /**
    Get the line description around the given position.
    */
    lineAt(pos: number): Line$1;
    /**
    Get the description for the given (1-based) line number.
    */
    line(n: number): Line$1;
    /**
    Replace a range of the text with the given content.
    */
    replace(from: number, to: number, text: Text): Text;
    /**
    Append another document to this one.
    */
    append(other: Text): Text;
    /**
    Retrieve the text between the given points.
    */
    slice(from: number, to?: number): Text;
    /**
    Retrieve a part of the document as a string
    */
    abstract sliceString(from: number, to?: number, lineSep?: string): string;
    /**
    Test whether this text is equal to another instance.
    */
    eq(other: Text): boolean;
    /**
    Iterate over the text. When `dir` is `-1`, iteration happens
    from end to start. This will return lines and the breaks between
    them as separate strings.
    */
    iter(dir?: 1 | -1): TextIterator;
    /**
    Iterate over a range of the text. When `from` > `to`, the
    iterator will run in reverse.
    */
    iterRange(from: number, to?: number): TextIterator;
    /**
    Return a cursor that iterates over the given range of lines,
    _without_ returning the line breaks between, and yielding empty
    strings for empty lines.
    
    When `from` and `to` are given, they should be 1-based line numbers.
    */
    iterLines(from?: number, to?: number): TextIterator;
    /**
    Return the document as a string, using newline characters to
    separate lines.
    */
    toString(): string;
    /**
    Convert the document to an array of lines (which can be
    deserialized again via [`Text.of`](https://codemirror.net/6/docs/ref/#state.Text^of)).
    */
    toJSON(): string[];
    /**
    If this is a branch node, `children` will hold the `Text`
    objects that it is made up of. For leaf nodes, this holds null.
    */
    abstract readonly children: readonly Text[] | null;
    /**
    @hide
    */
    [Symbol.iterator]: () => Iterator<string>;
    /**
    Create a `Text` instance for the given array of lines.
    */
    static of(text: readonly string[]): Text;
    /**
    The empty document.
    */
    static empty: Text;
}
/**
This type describes a line in the document. It is created
on-demand when lines are [queried](https://codemirror.net/6/docs/ref/#state.Text.lineAt).
*/
declare class Line$1 {
    /**
    The position of the start of the line.
    */
    readonly from: number;
    /**
    The position at the end of the line (_before_ the line break,
    or at the end of document for the last line).
    */
    readonly to: number;
    /**
    This line's line number (1-based).
    */
    readonly number: number;
    /**
    The line's content.
    */
    readonly text: string;
    /**
    The length of the line (not including any line break after it).
    */
    get length(): number;
}

/**
Distinguishes different ways in which positions can be mapped.
*/
declare enum MapMode {
    /**
    Map a position to a valid new position, even when its context
    was deleted.
    */
    Simple = 0,
    /**
    Return null if deletion happens across the position.
    */
    TrackDel = 1,
    /**
    Return null if the character _before_ the position is deleted.
    */
    TrackBefore = 2,
    /**
    Return null if the character _after_ the position is deleted.
    */
    TrackAfter = 3
}
/**
A change description is a variant of [change set](https://codemirror.net/6/docs/ref/#state.ChangeSet)
that doesn't store the inserted text. As such, it can't be
applied, but is cheaper to store and manipulate.
*/
declare class ChangeDesc {
    /**
    The length of the document before the change.
    */
    get length(): number;
    /**
    The length of the document after the change.
    */
    get newLength(): number;
    /**
    False when there are actual changes in this set.
    */
    get empty(): boolean;
    /**
    Iterate over the unchanged parts left by these changes. `posA`
    provides the position of the range in the old document, `posB`
    the new position in the changed document.
    */
    iterGaps(f: (posA: number, posB: number, length: number) => void): void;
    /**
    Iterate over the ranges changed by these changes. (See
    [`ChangeSet.iterChanges`](https://codemirror.net/6/docs/ref/#state.ChangeSet.iterChanges) for a
    variant that also provides you with the inserted text.)
    `fromA`/`toA` provides the extent of the change in the starting
    document, `fromB`/`toB` the extent of the replacement in the
    changed document.
    
    When `individual` is true, adjacent changes (which are kept
    separate for [position mapping](https://codemirror.net/6/docs/ref/#state.ChangeDesc.mapPos)) are
    reported separately.
    */
    iterChangedRanges(f: (fromA: number, toA: number, fromB: number, toB: number) => void, individual?: boolean): void;
    /**
    Get a description of the inverted form of these changes.
    */
    get invertedDesc(): ChangeDesc;
    /**
    Compute the combined effect of applying another set of changes
    after this one. The length of the document after this set should
    match the length before `other`.
    */
    composeDesc(other: ChangeDesc): ChangeDesc;
    /**
    Map this description, which should start with the same document
    as `other`, over another set of changes, so that it can be
    applied after it. When `before` is true, map as if the changes
    in `this` happened before the ones in `other`.
    */
    mapDesc(other: ChangeDesc, before?: boolean): ChangeDesc;
    /**
    Map a given position through these changes, to produce a
    position pointing into the new document.
    
    `assoc` indicates which side the position should be associated
    with. When it is negative, the mapping will try to keep the
    position close to the character before it (if any), and will
    move it before insertions at that point or replacements across
    that point. When it is zero or positive, the position is associated
    with the character after it, and will be moved forward for
    */
    /**
    
    `mode` determines whether deletions should be
    [reported](https://codemirror.net/6/docs/ref/#state.MapMode). It defaults to
    [`MapMode.Simple`](https://codemirror.net/6/docs/ref/#state.MapMode.Simple) (don't report
    deletions).
    */
    mapPos(pos: number, assoc?: number): number;
    mapPos(pos: number, assoc: number, mode: MapMode): number | null;
    /**
    Check whether these changes touch a given range. When one of the
    changes entirely covers the range, the string `"cover"` is
    returned.
    */
    touchesRange(from: number, to?: number): boolean | "cover";
    /**
    Serialize this change desc to a JSON-representable value.
    */
    toJSON(): readonly number[];
    /**
    Create a change desc from its JSON representation (as produced
    by [`toJSON`](https://codemirror.net/6/docs/ref/#state.ChangeDesc.toJSON).
    */
    static fromJSON(json: any): ChangeDesc;
}
/**
This type is used as argument to
[`EditorState.changes`](https://codemirror.net/6/docs/ref/#state.EditorState.changes) and in the
[`changes` field](https://codemirror.net/6/docs/ref/#state.TransactionSpec.changes) of transaction
specs to succinctly describe document changes. It may either be a
plain object describing a change (a deletion, insertion, or
replacement, depending on which fields are present), a [change
set](https://codemirror.net/6/docs/ref/#state.ChangeSet), or an array of change specs.
*/
type ChangeSpec = {
    from: number;
    to?: number;
    insert?: string | Text;
} | ChangeSet | readonly ChangeSpec[];
/**
A change set represents a group of modifications to a document. It
stores the document length, and can only be applied to documents
with exactly that length.
*/
declare class ChangeSet extends ChangeDesc {
    private constructor();
    /**
    Apply the changes to a document, returning the modified
    document.
    */
    apply(doc: Text): Text;
    mapDesc(other: ChangeDesc, before?: boolean): ChangeDesc;
    /**
    Given the document as it existed _before_ the changes, return a
    change set that represents the inverse of this set, which could
    be used to go from the document created by the changes back to
    the document as it existed before the changes.
    */
    invert(doc: Text): ChangeSet;
    /**
    Combine two subsequent change sets into a single set. `other`
    must start in the document produced by `this`. If `this` goes
    `docA` → `docB` and `other` represents `docB` → `docC`, the
    returned value will represent the change `docA` → `docC`.
    */
    compose(other: ChangeSet): ChangeSet;
    /**
    Given another change set starting in the same document, maps this
    change set over the other, producing a new change set that can be
    applied to the document produced by applying `other`. When
    `before` is `true`, order changes as if `this` comes before
    `other`, otherwise (the default) treat `other` as coming first.
    
    Given two changes `A` and `B`, `A.compose(B.map(A))` and
    `B.compose(A.map(B, true))` will produce the same document. This
    provides a basic form of [operational
    transformation](https://en.wikipedia.org/wiki/Operational_transformation),
    and can be used for collaborative editing.
    */
    map(other: ChangeDesc, before?: boolean): ChangeSet;
    /**
    Iterate over the changed ranges in the document, calling `f` for
    each, with the range in the original document (`fromA`-`toA`)
    and the range that replaces it in the new document
    (`fromB`-`toB`).
    
    When `individual` is true, adjacent changes are reported
    separately.
    */
    iterChanges(f: (fromA: number, toA: number, fromB: number, toB: number, inserted: Text) => void, individual?: boolean): void;
    /**
    Get a [change description](https://codemirror.net/6/docs/ref/#state.ChangeDesc) for this change
    set.
    */
    get desc(): ChangeDesc;
    /**
    Serialize this change set to a JSON-representable value.
    */
    toJSON(): any;
    /**
    Create a change set for the given changes, for a document of the
    given length, using `lineSep` as line separator.
    */
    static of(changes: ChangeSpec, length: number, lineSep?: string): ChangeSet;
    /**
    Create an empty changeset of the given length.
    */
    static empty(length: number): ChangeSet;
    /**
    Create a changeset from its JSON representation (as produced by
    [`toJSON`](https://codemirror.net/6/docs/ref/#state.ChangeSet.toJSON).
    */
    static fromJSON(json: any): ChangeSet;
}

/**
A single selection range. When
[`allowMultipleSelections`](https://codemirror.net/6/docs/ref/#state.EditorState^allowMultipleSelections)
is enabled, a [selection](https://codemirror.net/6/docs/ref/#state.EditorSelection) may hold
multiple ranges. By default, selections hold exactly one range.
*/
declare class SelectionRange {
    /**
    The lower boundary of the range.
    */
    readonly from: number;
    /**
    The upper boundary of the range.
    */
    readonly to: number;
    private flags;
    private constructor();
    /**
    The anchor of the range—the side that doesn't move when you
    extend it.
    */
    get anchor(): number;
    /**
    The head of the range, which is moved when the range is
    [extended](https://codemirror.net/6/docs/ref/#state.SelectionRange.extend).
    */
    get head(): number;
    /**
    True when `anchor` and `head` are at the same position.
    */
    get empty(): boolean;
    /**
    If this is a cursor that is explicitly associated with the
    character on one of its sides, this returns the side. -1 means
    the character before its position, 1 the character after, and 0
    means no association.
    */
    get assoc(): -1 | 0 | 1;
    /**
    The bidirectional text level associated with this cursor, if
    any.
    */
    get bidiLevel(): number | null;
    /**
    The goal column (stored vertical offset) associated with a
    cursor. This is used to preserve the vertical position when
    [moving](https://codemirror.net/6/docs/ref/#view.EditorView.moveVertically) across
    lines of different length.
    */
    get goalColumn(): number | undefined;
    /**
    Map this range through a change, producing a valid range in the
    updated document.
    */
    map(change: ChangeDesc, assoc?: number): SelectionRange;
    /**
    Extend this range to cover at least `from` to `to`.
    */
    extend(from: number, to?: number): SelectionRange;
    /**
    Compare this range to another range.
    */
    eq(other: SelectionRange, includeAssoc?: boolean): boolean;
    /**
    Return a JSON-serializable object representing the range.
    */
    toJSON(): any;
    /**
    Convert a JSON representation of a range to a `SelectionRange`
    instance.
    */
    static fromJSON(json: any): SelectionRange;
}
/**
An editor selection holds one or more selection ranges.
*/
declare class EditorSelection {
    /**
    The ranges in the selection, sorted by position. Ranges cannot
    overlap (but they may touch, if they aren't empty).
    */
    readonly ranges: readonly SelectionRange[];
    /**
    The index of the _main_ range in the selection (which is
    usually the range that was added last).
    */
    readonly mainIndex: number;
    private constructor();
    /**
    Map a selection through a change. Used to adjust the selection
    position for changes.
    */
    map(change: ChangeDesc, assoc?: number): EditorSelection;
    /**
    Compare this selection to another selection. By default, ranges
    are compared only by position. When `includeAssoc` is true,
    cursor ranges must also have the same
    [`assoc`](https://codemirror.net/6/docs/ref/#state.SelectionRange.assoc) value.
    */
    eq(other: EditorSelection, includeAssoc?: boolean): boolean;
    /**
    Get the primary selection range. Usually, you should make sure
    your code applies to _all_ ranges, by using methods like
    [`changeByRange`](https://codemirror.net/6/docs/ref/#state.EditorState.changeByRange).
    */
    get main(): SelectionRange;
    /**
    Make sure the selection only has one range. Returns a selection
    holding only the main range from this selection.
    */
    asSingle(): EditorSelection;
    /**
    Extend this selection with an extra range.
    */
    addRange(range: SelectionRange, main?: boolean): EditorSelection;
    /**
    Replace a given range with another range, and then normalize the
    selection to merge and sort ranges if necessary.
    */
    replaceRange(range: SelectionRange, which?: number): EditorSelection;
    /**
    Convert this selection to an object that can be serialized to
    JSON.
    */
    toJSON(): any;
    /**
    Create a selection from a JSON representation.
    */
    static fromJSON(json: any): EditorSelection;
    /**
    Create a selection holding a single range.
    */
    static single(anchor: number, head?: number): EditorSelection;
    /**
    Sort and merge the given set of ranges, creating a valid
    selection.
    */
    static create(ranges: readonly SelectionRange[], mainIndex?: number): EditorSelection;
    /**
    Create a cursor selection range at the given position. You can
    safely ignore the optional arguments in most situations.
    */
    static cursor(pos: number, assoc?: number, bidiLevel?: number, goalColumn?: number): SelectionRange;
    /**
    Create a selection range.
    */
    static range(anchor: number, head: number, goalColumn?: number, bidiLevel?: number): SelectionRange;
}

type FacetConfig<Input, Output> = {
    /**
    How to combine the input values into a single output value. When
    not given, the array of input values becomes the output. This
    function will immediately be called on creating the facet, with
    an empty array, to compute the facet's default value when no
    inputs are present.
    */
    combine?: (value: readonly Input[]) => Output;
    /**
    How to compare output values to determine whether the value of
    the facet changed. Defaults to comparing by `===` or, if no
    `combine` function was given, comparing each element of the
    array with `===`.
    */
    compare?: (a: Output, b: Output) => boolean;
    /**
    How to compare input values to avoid recomputing the output
    value when no inputs changed. Defaults to comparing with `===`.
    */
    compareInput?: (a: Input, b: Input) => boolean;
    /**
    Forbids dynamic inputs to this facet.
    */
    static?: boolean;
    /**
    If given, these extension(s) (or the result of calling the given
    function with the facet) will be added to any state where this
    facet is provided. (Note that, while a facet's default value can
    be read from a state even if the facet wasn't present in the
    state at all, these extensions won't be added in that
    situation.)
    */
    enables?: Extension | ((self: Facet<Input, Output>) => Extension);
};
/**
A facet is a labeled value that is associated with an editor
state. It takes inputs from any number of extensions, and combines
those into a single output value.

Examples of uses of facets are the [tab
size](https://codemirror.net/6/docs/ref/#state.EditorState^tabSize), [editor
attributes](https://codemirror.net/6/docs/ref/#view.EditorView^editorAttributes), and [update
listeners](https://codemirror.net/6/docs/ref/#view.EditorView^updateListener).

Note that `Facet` instances can be used anywhere where
[`FacetReader`](https://codemirror.net/6/docs/ref/#state.FacetReader) is expected.
*/
declare class Facet<Input, Output = readonly Input[]> implements FacetReader<Output> {
    private isStatic;
    private constructor();
    /**
    Returns a facet reader for this facet, which can be used to
    [read](https://codemirror.net/6/docs/ref/#state.EditorState.facet) it but not to define values for it.
    */
    get reader(): FacetReader<Output>;
    /**
    Define a new facet.
    */
    static define<Input, Output = readonly Input[]>(config?: FacetConfig<Input, Output>): Facet<Input, Output>;
    /**
    Returns an extension that adds the given value to this facet.
    */
    of(value: Input): Extension;
    /**
    Create an extension that computes a value for the facet from a
    state. You must take care to declare the parts of the state that
    this value depends on, since your function is only called again
    for a new state when one of those parts changed.
    
    In cases where your value depends only on a single field, you'll
    want to use the [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method instead.
    */
    compute(deps: readonly Slot<any>[], get: (state: EditorState) => Input): Extension;
    /**
    Create an extension that computes zero or more values for this
    facet from a state.
    */
    computeN(deps: readonly Slot<any>[], get: (state: EditorState) => readonly Input[]): Extension;
    /**
    Shorthand method for registering a facet source with a state
    field as input. If the field's type corresponds to this facet's
    input type, the getter function can be omitted. If given, it
    will be used to retrieve the input from the field value.
    */
    from<T extends Input>(field: StateField<T>): Extension;
    from<T>(field: StateField<T>, get: (value: T) => Input): Extension;
    tag: Output;
}
/**
A facet reader can be used to fetch the value of a facet, through
[`EditorState.facet`](https://codemirror.net/6/docs/ref/#state.EditorState.facet) or as a dependency
in [`Facet.compute`](https://codemirror.net/6/docs/ref/#state.Facet.compute), but not to define new
values for the facet.
*/
type FacetReader<Output> = {
    /**
    Dummy tag that makes sure TypeScript doesn't consider all object
    types as conforming to this type. Not actually present on the
    object.
    */
    tag: Output;
};
type Slot<T> = FacetReader<T> | StateField<T> | "doc" | "selection";
type StateFieldSpec<Value> = {
    /**
    Creates the initial value for the field when a state is created.
    */
    create: (state: EditorState) => Value;
    /**
    Compute a new value from the field's previous value and a
    [transaction](https://codemirror.net/6/docs/ref/#state.Transaction).
    */
    update: (value: Value, transaction: Transaction) => Value;
    /**
    Compare two values of the field, returning `true` when they are
    the same. This is used to avoid recomputing facets that depend
    on the field when its value did not change. Defaults to using
    `===`.
    */
    compare?: (a: Value, b: Value) => boolean;
    /**
    Provide extensions based on this field. The given function will
    be called once with the initialized field. It will usually want
    to call some facet's [`from`](https://codemirror.net/6/docs/ref/#state.Facet.from) method to
    create facet inputs from this field, but can also return other
    extensions that should be enabled when the field is present in a
    configuration.
    */
    provide?: (field: StateField<Value>) => Extension;
    /**
    A function used to serialize this field's content to JSON. Only
    necessary when this field is included in the argument to
    [`EditorState.toJSON`](https://codemirror.net/6/docs/ref/#state.EditorState.toJSON).
    */
    toJSON?: (value: Value, state: EditorState) => any;
    /**
    A function that deserializes the JSON representation of this
    field's content.
    */
    fromJSON?: (json: any, state: EditorState) => Value;
};
/**
Fields can store additional information in an editor state, and
keep it in sync with the rest of the state.
*/
declare class StateField<Value> {
    private createF;
    private updateF;
    private compareF;
    private constructor();
    /**
    Define a state field.
    */
    static define<Value>(config: StateFieldSpec<Value>): StateField<Value>;
    private create;
    /**
    Returns an extension that enables this field and overrides the
    way it is initialized. Can be useful when you need to provide a
    non-default starting value for the field.
    */
    init(create: (state: EditorState) => Value): Extension;
    /**
    State field instances can be used as
    [`Extension`](https://codemirror.net/6/docs/ref/#state.Extension) values to enable the field in a
    given state.
    */
    get extension(): Extension;
}
/**
Extension values can be
[provided](https://codemirror.net/6/docs/ref/#state.EditorStateConfig.extensions) when creating a
state to attach various kinds of configuration and behavior
information. They can either be built-in extension-providing
objects, such as [state fields](https://codemirror.net/6/docs/ref/#state.StateField) or [facet
providers](https://codemirror.net/6/docs/ref/#state.Facet.of), or objects with an extension in its
`extension` property. Extensions can be nested in arrays
arbitrarily deep—they will be flattened when processed.
*/
type Extension = {
    extension: Extension;
} | readonly Extension[];
/**
By default extensions are registered in the order they are found
in the flattened form of nested array that was provided.
Individual extension values can be assigned a precedence to
override this. Extensions that do not have a precedence set get
the precedence of the nearest parent with a precedence, or
[`default`](https://codemirror.net/6/docs/ref/#state.Prec.default) if there is no such parent. The
final ordering of extensions is determined by first sorting by
precedence and then by order within each precedence.
*/
declare const Prec: {
    /**
    The highest precedence level, for extensions that should end up
    near the start of the precedence ordering.
    */
    highest: (ext: Extension) => Extension;
    /**
    A higher-than-default precedence, for extensions that should
    come before those with default precedence.
    */
    high: (ext: Extension) => Extension;
    /**
    The default precedence, which is also used for extensions
    without an explicit precedence.
    */
    default: (ext: Extension) => Extension;
    /**
    A lower-than-default precedence.
    */
    low: (ext: Extension) => Extension;
    /**
    The lowest precedence level. Meant for things that should end up
    near the end of the extension order.
    */
    lowest: (ext: Extension) => Extension;
};
/**
Extension compartments can be used to make a configuration
dynamic. By [wrapping](https://codemirror.net/6/docs/ref/#state.Compartment.of) part of your
configuration in a compartment, you can later
[replace](https://codemirror.net/6/docs/ref/#state.Compartment.reconfigure) that part through a
transaction.
*/
declare class Compartment {
    /**
    Create an instance of this compartment to add to your [state
    configuration](https://codemirror.net/6/docs/ref/#state.EditorStateConfig.extensions).
    */
    of(ext: Extension): Extension;
    /**
    Create an [effect](https://codemirror.net/6/docs/ref/#state.TransactionSpec.effects) that
    reconfigures this compartment.
    */
    reconfigure(content: Extension): StateEffect<unknown>;
    /**
    Get the current content of the compartment in the state, or
    `undefined` if it isn't present.
    */
    get(state: EditorState): Extension | undefined;
}

/**
Annotations are tagged values that are used to add metadata to
transactions in an extensible way. They should be used to model
things that effect the entire transaction (such as its [time
stamp](https://codemirror.net/6/docs/ref/#state.Transaction^time) or information about its
[origin](https://codemirror.net/6/docs/ref/#state.Transaction^userEvent)). For effects that happen
_alongside_ the other changes made by the transaction, [state
effects](https://codemirror.net/6/docs/ref/#state.StateEffect) are more appropriate.
*/
declare class Annotation<T> {
    /**
    The annotation type.
    */
    readonly type: AnnotationType<T>;
    /**
    The value of this annotation.
    */
    readonly value: T;
    /**
    Define a new type of annotation.
    */
    static define<T>(): AnnotationType<T>;
    private _isAnnotation;
}
/**
Marker that identifies a type of [annotation](https://codemirror.net/6/docs/ref/#state.Annotation).
*/
declare class AnnotationType<T> {
    /**
    Create an instance of this annotation.
    */
    of(value: T): Annotation<T>;
}
interface StateEffectSpec<Value> {
    /**
    Provides a way to map an effect like this through a position
    mapping. When not given, the effects will simply not be mapped.
    When the function returns `undefined`, that means the mapping
    deletes the effect.
    */
    map?: (value: Value, mapping: ChangeDesc) => Value | undefined;
}
/**
Representation of a type of state effect. Defined with
[`StateEffect.define`](https://codemirror.net/6/docs/ref/#state.StateEffect^define).
*/
declare class StateEffectType<Value> {
    /**
    @internal
    */
    readonly map: (value: any, mapping: ChangeDesc) => any | undefined;
    /**
    Create a [state effect](https://codemirror.net/6/docs/ref/#state.StateEffect) instance of this
    type.
    */
    of(value: Value): StateEffect<Value>;
}
/**
State effects can be used to represent additional effects
associated with a [transaction](https://codemirror.net/6/docs/ref/#state.Transaction.effects). They
are often useful to model changes to custom [state
fields](https://codemirror.net/6/docs/ref/#state.StateField), when those changes aren't implicit in
document or selection changes.
*/
declare class StateEffect<Value> {
    /**
    The value of this effect.
    */
    readonly value: Value;
    /**
    Map this effect through a position mapping. Will return
    `undefined` when that ends up deleting the effect.
    */
    map(mapping: ChangeDesc): StateEffect<Value> | undefined;
    /**
    Tells you whether this effect object is of a given
    [type](https://codemirror.net/6/docs/ref/#state.StateEffectType).
    */
    is<T>(type: StateEffectType<T>): this is StateEffect<T>;
    /**
    Define a new effect type. The type parameter indicates the type
    of values that his effect holds. It should be a type that
    doesn't include `undefined`, since that is used in
    [mapping](https://codemirror.net/6/docs/ref/#state.StateEffect.map) to indicate that an effect is
    removed.
    */
    static define<Value = null>(spec?: StateEffectSpec<Value>): StateEffectType<Value>;
    /**
    Map an array of effects through a change set.
    */
    static mapEffects(effects: readonly StateEffect<any>[], mapping: ChangeDesc): readonly StateEffect<any>[];
    /**
    This effect can be used to reconfigure the root extensions of
    the editor. Doing this will discard any extensions
    [appended](https://codemirror.net/6/docs/ref/#state.StateEffect^appendConfig), but does not reset
    the content of [reconfigured](https://codemirror.net/6/docs/ref/#state.Compartment.reconfigure)
    compartments.
    */
    static reconfigure: StateEffectType<Extension>;
    /**
    Append extensions to the top-level configuration of the editor.
    */
    static appendConfig: StateEffectType<Extension>;
}
/**
Describes a [transaction](https://codemirror.net/6/docs/ref/#state.Transaction) when calling the
[`EditorState.update`](https://codemirror.net/6/docs/ref/#state.EditorState.update) method.
*/
interface TransactionSpec {
    /**
    The changes to the document made by this transaction.
    */
    changes?: ChangeSpec;
    /**
    When set, this transaction explicitly updates the selection.
    Offsets in this selection should refer to the document as it is
    _after_ the transaction.
    */
    selection?: EditorSelection | {
        anchor: number;
        head?: number;
    } | undefined;
    /**
    Attach [state effects](https://codemirror.net/6/docs/ref/#state.StateEffect) to this transaction.
    Again, when they contain positions and this same spec makes
    changes, those positions should refer to positions in the
    updated document.
    */
    effects?: StateEffect<any> | readonly StateEffect<any>[];
    /**
    Set [annotations](https://codemirror.net/6/docs/ref/#state.Annotation) for this transaction.
    */
    annotations?: Annotation<any> | readonly Annotation<any>[];
    /**
    Shorthand for `annotations:` [`Transaction.userEvent`](https://codemirror.net/6/docs/ref/#state.Transaction^userEvent)`.of(...)`.
    */
    userEvent?: string;
    /**
    When set to `true`, the transaction is marked as needing to
    scroll the current selection into view.
    */
    scrollIntoView?: boolean;
    /**
    By default, transactions can be modified by [change
    filters](https://codemirror.net/6/docs/ref/#state.EditorState^changeFilter) and [transaction
    filters](https://codemirror.net/6/docs/ref/#state.EditorState^transactionFilter). You can set this
    to `false` to disable that. This can be necessary for
    transactions that, for example, include annotations that must be
    kept consistent with their changes.
    */
    filter?: boolean;
    /**
    Normally, when multiple specs are combined (for example by
    [`EditorState.update`](https://codemirror.net/6/docs/ref/#state.EditorState.update)), the
    positions in `changes` are taken to refer to the document
    positions in the initial document. When a spec has `sequental`
    set to true, its positions will be taken to refer to the
    document created by the specs before it instead.
    */
    sequential?: boolean;
}
/**
Changes to the editor state are grouped into transactions.
Typically, a user action creates a single transaction, which may
contain any number of document changes, may change the selection,
or have other effects. Create a transaction by calling
[`EditorState.update`](https://codemirror.net/6/docs/ref/#state.EditorState.update), or immediately
dispatch one by calling
[`EditorView.dispatch`](https://codemirror.net/6/docs/ref/#view.EditorView.dispatch).
*/
declare class Transaction {
    /**
    The state from which the transaction starts.
    */
    readonly startState: EditorState;
    /**
    The document changes made by this transaction.
    */
    readonly changes: ChangeSet;
    /**
    The selection set by this transaction, or undefined if it
    doesn't explicitly set a selection.
    */
    readonly selection: EditorSelection | undefined;
    /**
    The effects added to the transaction.
    */
    readonly effects: readonly StateEffect<any>[];
    /**
    Whether the selection should be scrolled into view after this
    transaction is dispatched.
    */
    readonly scrollIntoView: boolean;
    private constructor();
    /**
    The new document produced by the transaction. Contrary to
    [`.state`](https://codemirror.net/6/docs/ref/#state.Transaction.state)`.doc`, accessing this won't
    force the entire new state to be computed right away, so it is
    recommended that [transaction
    filters](https://codemirror.net/6/docs/ref/#state.EditorState^transactionFilter) use this getter
    when they need to look at the new document.
    */
    get newDoc(): Text;
    /**
    The new selection produced by the transaction. If
    [`this.selection`](https://codemirror.net/6/docs/ref/#state.Transaction.selection) is undefined,
    this will [map](https://codemirror.net/6/docs/ref/#state.EditorSelection.map) the start state's
    current selection through the changes made by the transaction.
    */
    get newSelection(): EditorSelection;
    /**
    The new state created by the transaction. Computed on demand
    (but retained for subsequent access), so it is recommended not to
    access it in [transaction
    filters](https://codemirror.net/6/docs/ref/#state.EditorState^transactionFilter) when possible.
    */
    get state(): EditorState;
    /**
    Get the value of the given annotation type, if any.
    */
    annotation<T>(type: AnnotationType<T>): T | undefined;
    /**
    Indicates whether the transaction changed the document.
    */
    get docChanged(): boolean;
    /**
    Indicates whether this transaction reconfigures the state
    (through a [configuration compartment](https://codemirror.net/6/docs/ref/#state.Compartment) or
    with a top-level configuration
    [effect](https://codemirror.net/6/docs/ref/#state.StateEffect^reconfigure).
    */
    get reconfigured(): boolean;
    /**
    Returns true if the transaction has a [user
    event](https://codemirror.net/6/docs/ref/#state.Transaction^userEvent) annotation that is equal to
    or more specific than `event`. For example, if the transaction
    has `"select.pointer"` as user event, `"select"` and
    `"select.pointer"` will match it.
    */
    isUserEvent(event: string): boolean;
    /**
    Annotation used to store transaction timestamps. Automatically
    added to every transaction, holding `Date.now()`.
    */
    static time: AnnotationType<number>;
    /**
    Annotation used to associate a transaction with a user interface
    event. Holds a string identifying the event, using a
    dot-separated format to support attaching more specific
    information. The events used by the core libraries are:
    
     - `"input"` when content is entered
       - `"input.type"` for typed input
         - `"input.type.compose"` for composition
       - `"input.paste"` for pasted input
       - `"input.drop"` when adding content with drag-and-drop
       - `"input.complete"` when autocompleting
     - `"delete"` when the user deletes content
       - `"delete.selection"` when deleting the selection
       - `"delete.forward"` when deleting forward from the selection
       - `"delete.backward"` when deleting backward from the selection
       - `"delete.cut"` when cutting to the clipboard
     - `"move"` when content is moved
       - `"move.drop"` when content is moved within the editor through drag-and-drop
     - `"select"` when explicitly changing the selection
       - `"select.pointer"` when selecting with a mouse or other pointing device
     - `"undo"` and `"redo"` for history actions
    
    Use [`isUserEvent`](https://codemirror.net/6/docs/ref/#state.Transaction.isUserEvent) to check
    whether the annotation matches a given event.
    */
    static userEvent: AnnotationType<string>;
    /**
    Annotation indicating whether a transaction should be added to
    the undo history or not.
    */
    static addToHistory: AnnotationType<boolean>;
    /**
    Annotation indicating (when present and true) that a transaction
    represents a change made by some other actor, not the user. This
    is used, for example, to tag other people's changes in
    collaborative editing.
    */
    static remote: AnnotationType<boolean>;
}

/**
The categories produced by a [character
categorizer](https://codemirror.net/6/docs/ref/#state.EditorState.charCategorizer). These are used
do things like selecting by word.
*/
declare enum CharCategory {
    /**
    Word characters.
    */
    Word = 0,
    /**
    Whitespace.
    */
    Space = 1,
    /**
    Anything else.
    */
    Other = 2
}

/**
Options passed when [creating](https://codemirror.net/6/docs/ref/#state.EditorState^create) an
editor state.
*/
interface EditorStateConfig {
    /**
    The initial document. Defaults to an empty document. Can be
    provided either as a plain string (which will be split into
    lines according to the value of the [`lineSeparator`
    facet](https://codemirror.net/6/docs/ref/#state.EditorState^lineSeparator)), or an instance of
    the [`Text`](https://codemirror.net/6/docs/ref/#state.Text) class (which is what the state will use
    to represent the document).
    */
    doc?: string | Text;
    /**
    The starting selection. Defaults to a cursor at the very start
    of the document.
    */
    selection?: EditorSelection | {
        anchor: number;
        head?: number;
    };
    /**
    [Extension(s)](https://codemirror.net/6/docs/ref/#state.Extension) to associate with this state.
    */
    extensions?: Extension;
}
/**
The editor state class is a persistent (immutable) data structure.
To update a state, you [create](https://codemirror.net/6/docs/ref/#state.EditorState.update) a
[transaction](https://codemirror.net/6/docs/ref/#state.Transaction), which produces a _new_ state
instance, without modifying the original object.

As such, _never_ mutate properties of a state directly. That'll
just break things.
*/
declare class EditorState {
    /**
    The current document.
    */
    readonly doc: Text;
    /**
    The current selection.
    */
    readonly selection: EditorSelection;
    private constructor();
    /**
    Retrieve the value of a [state field](https://codemirror.net/6/docs/ref/#state.StateField). Throws
    an error when the state doesn't have that field, unless you pass
    `false` as second parameter.
    */
    field<T>(field: StateField<T>): T;
    field<T>(field: StateField<T>, require: false): T | undefined;
    /**
    Create a [transaction](https://codemirror.net/6/docs/ref/#state.Transaction) that updates this
    state. Any number of [transaction specs](https://codemirror.net/6/docs/ref/#state.TransactionSpec)
    can be passed. Unless
    [`sequential`](https://codemirror.net/6/docs/ref/#state.TransactionSpec.sequential) is set, the
    [changes](https://codemirror.net/6/docs/ref/#state.TransactionSpec.changes) (if any) of each spec
    are assumed to start in the _current_ document (not the document
    produced by previous specs), and its
    [selection](https://codemirror.net/6/docs/ref/#state.TransactionSpec.selection) and
    [effects](https://codemirror.net/6/docs/ref/#state.TransactionSpec.effects) are assumed to refer
    to the document created by its _own_ changes. The resulting
    transaction contains the combined effect of all the different
    specs. For [selection](https://codemirror.net/6/docs/ref/#state.TransactionSpec.selection), later
    specs take precedence over earlier ones.
    */
    update(...specs: readonly TransactionSpec[]): Transaction;
    /**
    Create a [transaction spec](https://codemirror.net/6/docs/ref/#state.TransactionSpec) that
    replaces every selection range with the given content.
    */
    replaceSelection(text: string | Text): TransactionSpec;
    /**
    Create a set of changes and a new selection by running the given
    function for each range in the active selection. The function
    can return an optional set of changes (in the coordinate space
    of the start document), plus an updated range (in the coordinate
    space of the document produced by the call's own changes). This
    method will merge all the changes and ranges into a single
    changeset and selection, and return it as a [transaction
    spec](https://codemirror.net/6/docs/ref/#state.TransactionSpec), which can be passed to
    [`update`](https://codemirror.net/6/docs/ref/#state.EditorState.update).
    */
    changeByRange(f: (range: SelectionRange) => {
        range: SelectionRange;
        changes?: ChangeSpec;
        effects?: StateEffect<any> | readonly StateEffect<any>[];
    }): {
        changes: ChangeSet;
        selection: EditorSelection;
        effects: readonly StateEffect<any>[];
    };
    /**
    Create a [change set](https://codemirror.net/6/docs/ref/#state.ChangeSet) from the given change
    description, taking the state's document length and line
    separator into account.
    */
    changes(spec?: ChangeSpec): ChangeSet;
    /**
    Using the state's [line
    separator](https://codemirror.net/6/docs/ref/#state.EditorState^lineSeparator), create a
    [`Text`](https://codemirror.net/6/docs/ref/#state.Text) instance from the given string.
    */
    toText(string: string): Text;
    /**
    Return the given range of the document as a string.
    */
    sliceDoc(from?: number, to?: number): string;
    /**
    Get the value of a state [facet](https://codemirror.net/6/docs/ref/#state.Facet).
    */
    facet<Output>(facet: FacetReader<Output>): Output;
    /**
    Convert this state to a JSON-serializable object. When custom
    fields should be serialized, you can pass them in as an object
    mapping property names (in the resulting object, which should
    not use `doc` or `selection`) to fields.
    */
    toJSON(fields?: {
        [prop: string]: StateField<any>;
    }): any;
    /**
    Deserialize a state from its JSON representation. When custom
    fields should be deserialized, pass the same object you passed
    to [`toJSON`](https://codemirror.net/6/docs/ref/#state.EditorState.toJSON) when serializing as
    third argument.
    */
    static fromJSON(json: any, config?: EditorStateConfig, fields?: {
        [prop: string]: StateField<any>;
    }): EditorState;
    /**
    Create a new state. You'll usually only need this when
    initializing an editor—updated states are created by applying
    transactions.
    */
    static create(config?: EditorStateConfig): EditorState;
    /**
    A facet that, when enabled, causes the editor to allow multiple
    ranges to be selected. Be careful though, because by default the
    editor relies on the native DOM selection, which cannot handle
    multiple selections. An extension like
    [`drawSelection`](https://codemirror.net/6/docs/ref/#view.drawSelection) can be used to make
    secondary selections visible to the user.
    */
    static allowMultipleSelections: Facet<boolean, boolean>;
    /**
    Configures the tab size to use in this state. The first
    (highest-precedence) value of the facet is used. If no value is
    given, this defaults to 4.
    */
    static tabSize: Facet<number, number>;
    /**
    The size (in columns) of a tab in the document, determined by
    the [`tabSize`](https://codemirror.net/6/docs/ref/#state.EditorState^tabSize) facet.
    */
    get tabSize(): number;
    /**
    The line separator to use. By default, any of `"\n"`, `"\r\n"`
    and `"\r"` is treated as a separator when splitting lines, and
    lines are joined with `"\n"`.
    
    When you configure a value here, only that precise separator
    will be used, allowing you to round-trip documents through the
    editor without normalizing line separators.
    */
    static lineSeparator: Facet<string, string | undefined>;
    /**
    Get the proper [line-break](https://codemirror.net/6/docs/ref/#state.EditorState^lineSeparator)
    string for this state.
    */
    get lineBreak(): string;
    /**
    This facet controls the value of the
    [`readOnly`](https://codemirror.net/6/docs/ref/#state.EditorState.readOnly) getter, which is
    consulted by commands and extensions that implement editing
    functionality to determine whether they should apply. It
    defaults to false, but when its highest-precedence value is
    `true`, such functionality disables itself.
    
    Not to be confused with
    [`EditorView.editable`](https://codemirror.net/6/docs/ref/#view.EditorView^editable), which
    controls whether the editor's DOM is set to be editable (and
    thus focusable).
    */
    static readOnly: Facet<boolean, boolean>;
    /**
    Returns true when the editor is
    [configured](https://codemirror.net/6/docs/ref/#state.EditorState^readOnly) to be read-only.
    */
    get readOnly(): boolean;
    /**
    Registers translation phrases. The
    [`phrase`](https://codemirror.net/6/docs/ref/#state.EditorState.phrase) method will look through
    all objects registered with this facet to find translations for
    its argument.
    */
    static phrases: Facet<{
        [key: string]: string;
    }, readonly {
        [key: string]: string;
    }[]>;
    /**
    Look up a translation for the given phrase (via the
    [`phrases`](https://codemirror.net/6/docs/ref/#state.EditorState^phrases) facet), or return the
    original string if no translation is found.
    
    If additional arguments are passed, they will be inserted in
    place of markers like `$1` (for the first value) and `$2`, etc.
    A single `$` is equivalent to `$1`, and `$$` will produce a
    literal dollar sign.
    */
    phrase(phrase: string, ...insert: any[]): string;
    /**
    A facet used to register [language
    data](https://codemirror.net/6/docs/ref/#state.EditorState.languageDataAt) providers.
    */
    static languageData: Facet<(state: EditorState, pos: number, side: 0 | 1 | -1) => readonly {
        [name: string]: any;
    }[], readonly ((state: EditorState, pos: number, side: 0 | 1 | -1) => readonly {
        [name: string]: any;
    }[])[]>;
    /**
    Find the values for a given language data field, provided by the
    the [`languageData`](https://codemirror.net/6/docs/ref/#state.EditorState^languageData) facet.
    
    Examples of language data fields are...
    
    - [`"commentTokens"`](https://codemirror.net/6/docs/ref/#commands.CommentTokens) for specifying
      comment syntax.
    - [`"autocomplete"`](https://codemirror.net/6/docs/ref/#autocomplete.autocompletion^config.override)
      for providing language-specific completion sources.
    - [`"wordChars"`](https://codemirror.net/6/docs/ref/#state.EditorState.charCategorizer) for adding
      characters that should be considered part of words in this
      language.
    - [`"closeBrackets"`](https://codemirror.net/6/docs/ref/#autocomplete.CloseBracketConfig) controls
      bracket closing behavior.
    */
    languageDataAt<T>(name: string, pos: number, side?: -1 | 0 | 1): readonly T[];
    /**
    Return a function that can categorize strings (expected to
    represent a single [grapheme cluster](https://codemirror.net/6/docs/ref/#state.findClusterBreak))
    into one of:
    
     - Word (contains an alphanumeric character or a character
       explicitly listed in the local language's `"wordChars"`
       language data, which should be a string)
     - Space (contains only whitespace)
     - Other (anything else)
    */
    charCategorizer(at: number): (char: string) => CharCategory;
    /**
    Find the word at the given position, meaning the range
    containing all [word](https://codemirror.net/6/docs/ref/#state.CharCategory.Word) characters
    around it. If no word characters are adjacent to the position,
    this returns null.
    */
    wordAt(pos: number): SelectionRange | null;
    /**
    Facet used to register change filters, which are called for each
    transaction (unless explicitly
    [disabled](https://codemirror.net/6/docs/ref/#state.TransactionSpec.filter)), and can suppress
    part of the transaction's changes.
    
    Such a function can return `true` to indicate that it doesn't
    want to do anything, `false` to completely stop the changes in
    the transaction, or a set of ranges in which changes should be
    suppressed. Such ranges are represented as an array of numbers,
    with each pair of two numbers indicating the start and end of a
    range. So for example `[10, 20, 100, 110]` suppresses changes
    between 10 and 20, and between 100 and 110.
    */
    static changeFilter: Facet<(tr: Transaction) => boolean | readonly number[], readonly ((tr: Transaction) => boolean | readonly number[])[]>;
    /**
    Facet used to register a hook that gets a chance to update or
    replace transaction specs before they are applied. This will
    only be applied for transactions that don't have
    [`filter`](https://codemirror.net/6/docs/ref/#state.TransactionSpec.filter) set to `false`. You
    can either return a single transaction spec (possibly the input
    transaction), or an array of specs (which will be combined in
    the same way as the arguments to
    [`EditorState.update`](https://codemirror.net/6/docs/ref/#state.EditorState.update)).
    
    When possible, it is recommended to avoid accessing
    [`Transaction.state`](https://codemirror.net/6/docs/ref/#state.Transaction.state) in a filter,
    since it will force creation of a state that will then be
    discarded again, if the transaction is actually filtered.
    
    (This functionality should be used with care. Indiscriminately
    modifying transaction is likely to break something or degrade
    the user experience.)
    */
    static transactionFilter: Facet<(tr: Transaction) => TransactionSpec | readonly TransactionSpec[], readonly ((tr: Transaction) => TransactionSpec | readonly TransactionSpec[])[]>;
    /**
    This is a more limited form of
    [`transactionFilter`](https://codemirror.net/6/docs/ref/#state.EditorState^transactionFilter),
    which can only add
    [annotations](https://codemirror.net/6/docs/ref/#state.TransactionSpec.annotations) and
    [effects](https://codemirror.net/6/docs/ref/#state.TransactionSpec.effects). _But_, this type
    of filter runs even if the transaction has disabled regular
    [filtering](https://codemirror.net/6/docs/ref/#state.TransactionSpec.filter), making it suitable
    for effects that don't need to touch the changes or selection,
    but do want to process every transaction.
    
    Extenders run _after_ filters, when both are present.
    */
    static transactionExtender: Facet<(tr: Transaction) => Pick<TransactionSpec, "effects" | "annotations"> | null, readonly ((tr: Transaction) => Pick<TransactionSpec, "effects" | "annotations"> | null)[]>;
}

/**
Subtype of [`Command`](https://codemirror.net/6/docs/ref/#view.Command) that doesn't require access
to the actual editor view. Mostly useful to define commands that
can be run and tested outside of a browser environment.
*/
type StateCommand = (target: {
    state: EditorState;
    dispatch: (transaction: Transaction) => void;
}) => boolean;

/**
Utility function for combining behaviors to fill in a config
object from an array of provided configs. `defaults` should hold
default values for all optional fields in `Config`.

The function will, by default, error
when a field gets two values that aren't `===`-equal, but you can
provide combine functions per field to do something else.
*/
declare function combineConfig<Config extends object>(configs: readonly Partial<Config>[], defaults: Partial<Config>, // Should hold only the optional properties of Config, but I haven't managed to express that
combine?: {
    [P in keyof Config]?: (first: Config[P], second: Config[P]) => Config[P];
}): Config;

/**
Each range is associated with a value, which must inherit from
this class.
*/
declare abstract class RangeValue {
    /**
    Compare this value with another value. Used when comparing
    rangesets. The default implementation compares by identity.
    Unless you are only creating a fixed number of unique instances
    of your value type, it is a good idea to implement this
    properly.
    */
    eq(other: RangeValue): boolean;
    /**
    The bias value at the start of the range. Determines how the
    range is positioned relative to other ranges starting at this
    position. Defaults to 0.
    */
    startSide: number;
    /**
    The bias value at the end of the range. Defaults to 0.
    */
    endSide: number;
    /**
    The mode with which the location of the range should be mapped
    when its `from` and `to` are the same, to decide whether a
    change deletes the range. Defaults to `MapMode.TrackDel`.
    */
    mapMode: MapMode;
    /**
    Determines whether this value marks a point range. Regular
    ranges affect the part of the document they cover, and are
    meaningless when empty. Point ranges have a meaning on their
    own. When non-empty, a point range is treated as atomic and
    shadows any ranges contained in it.
    */
    point: boolean;
    /**
    Create a [range](https://codemirror.net/6/docs/ref/#state.Range) with this value.
    */
    range(from: number, to?: number): Range<this>;
}
/**
A range associates a value with a range of positions.
*/
declare class Range<T extends RangeValue> {
    /**
    The range's start position.
    */
    readonly from: number;
    /**
    Its end position.
    */
    readonly to: number;
    /**
    The value associated with this range.
    */
    readonly value: T;
    private constructor();
}
/**
Collection of methods used when comparing range sets.
*/
interface RangeComparator<T extends RangeValue> {
    /**
    Notifies the comparator that a range (in positions in the new
    document) has the given sets of values associated with it, which
    are different in the old (A) and new (B) sets.
    */
    compareRange(from: number, to: number, activeA: T[], activeB: T[]): void;
    /**
    Notification for a changed (or inserted, or deleted) point range.
    */
    comparePoint(from: number, to: number, pointA: T | null, pointB: T | null): void;
    /**
    Notification for a changed boundary between ranges. For example,
    if the same span is covered by two partial ranges before and one
    bigger range after, this is called at the point where the ranges
    used to be split.
    */
    boundChange?(pos: number): void;
}
/**
Methods used when iterating over the spans created by a set of
ranges. The entire iterated range will be covered with either
`span` or `point` calls.
*/
interface SpanIterator<T extends RangeValue> {
    /**
    Called for any ranges not covered by point decorations. `active`
    holds the values that the range is marked with (and may be
    empty). `openStart` indicates how many of those ranges are open
    (continued) at the start of the span.
    */
    span(from: number, to: number, active: readonly T[], openStart: number): void;
    /**
    Called when going over a point decoration. The active range
    decorations that cover the point and have a higher precedence
    are provided in `active`. The open count in `openStart` counts
    the number of those ranges that started before the point and. If
    the point started before the iterated range, `openStart` will be
    `active.length + 1` to signal this.
    */
    point(from: number, to: number, value: T, active: readonly T[], openStart: number, index: number): void;
}
/**
A range cursor is an object that moves to the next range every
time you call `next` on it. Note that, unlike ES6 iterators, these
start out pointing at the first element, so you should call `next`
only after reading the first range (if any).
*/
interface RangeCursor<T> {
    /**
    Move the iterator forward.
    */
    next(): void;
    /**
    Jump the cursor to the given position.
    */
    goto(pos: number): void;
    /**
    The next range's value. Holds `null` when the cursor has reached
    its end.
    */
    value: T | null;
    /**
    The next range's start position.
    */
    from: number;
    /**
    The next end position.
    */
    to: number;
    /**
    The position of the set that this range comes from in the array
    of sets being iterated over.
    */
    rank: number;
}
type RangeSetUpdate<T extends RangeValue> = {
    /**
    An array of ranges to add. If given, this should be sorted by
    `from` position and `startSide` unless
    [`sort`](https://codemirror.net/6/docs/ref/#state.RangeSet.update^updateSpec.sort) is given as
    `true`.
    */
    add?: readonly Range<T>[];
    /**
    Indicates whether the library should sort the ranges in `add`.
    Defaults to `false`.
    */
    sort?: boolean;
    /**
    Filter the ranges already in the set. Only those for which this
    function returns `true` are kept.
    */
    filter?: (from: number, to: number, value: T) => boolean;
    /**
    Can be used to limit the range on which the filter is
    applied. Filtering only a small range, as opposed to the entire
    set, can make updates cheaper.
    */
    filterFrom?: number;
    /**
    The end position to apply the filter to.
    */
    filterTo?: number;
};
/**
A range set stores a collection of [ranges](https://codemirror.net/6/docs/ref/#state.Range) in a
way that makes them efficient to [map](https://codemirror.net/6/docs/ref/#state.RangeSet.map) and
[update](https://codemirror.net/6/docs/ref/#state.RangeSet.update). This is an immutable data
structure.
*/
declare class RangeSet<T extends RangeValue> {
    private constructor();
    /**
    The number of ranges in the set.
    */
    get size(): number;
    /**
    Update the range set, optionally adding new ranges or filtering
    out existing ones.
    
    (Note: The type parameter is just there as a kludge to work
    around TypeScript variance issues that prevented `RangeSet<X>`
    from being a subtype of `RangeSet<Y>` when `X` is a subtype of
    `Y`.)
    */
    update<U extends T>(updateSpec: RangeSetUpdate<U>): RangeSet<T>;
    /**
    Map this range set through a set of changes, return the new set.
    */
    map(changes: ChangeDesc): RangeSet<T>;
    /**
    Iterate over the ranges that touch the region `from` to `to`,
    calling `f` for each. There is no guarantee that the ranges will
    be reported in any specific order. When the callback returns
    `false`, iteration stops.
    */
    between(from: number, to: number, f: (from: number, to: number, value: T) => void | false): void;
    /**
    Iterate over the ranges in this set, in order, including all
    ranges that end at or after `from`.
    */
    iter(from?: number): RangeCursor<T>;
    /**
    Iterate over the ranges in a collection of sets, in order,
    starting from `from`.
    */
    static iter<T extends RangeValue>(sets: readonly RangeSet<T>[], from?: number): RangeCursor<T>;
    /**
    Iterate over two groups of sets, calling methods on `comparator`
    to notify it of possible differences.
    */
    static compare<T extends RangeValue>(oldSets: readonly RangeSet<T>[], newSets: readonly RangeSet<T>[], 
    /**
    This indicates how the underlying data changed between these
    ranges, and is needed to synchronize the iteration.
    */
    textDiff: ChangeDesc, comparator: RangeComparator<T>, 
    /**
    Can be used to ignore all non-point ranges, and points below
    the given size. When -1, all ranges are compared.
    */
    minPointSize?: number): void;
    /**
    Compare the contents of two groups of range sets, returning true
    if they are equivalent in the given range.
    */
    static eq<T extends RangeValue>(oldSets: readonly RangeSet<T>[], newSets: readonly RangeSet<T>[], from?: number, to?: number): boolean;
    /**
    Iterate over a group of range sets at the same time, notifying
    the iterator about the ranges covering every given piece of
    content. Returns the open count (see
    [`SpanIterator.span`](https://codemirror.net/6/docs/ref/#state.SpanIterator.span)) at the end
    of the iteration.
    */
    static spans<T extends RangeValue>(sets: readonly RangeSet<T>[], from: number, to: number, iterator: SpanIterator<T>, 
    /**
    When given and greater than -1, only points of at least this
    size are taken into account.
    */
    minPointSize?: number): number;
    /**
    Create a range set for the given range or array of ranges. By
    default, this expects the ranges to be _sorted_ (by start
    position and, if two start at the same position,
    `value.startSide`). You can pass `true` as second argument to
    cause the method to sort them.
    */
    static of<T extends RangeValue>(ranges: readonly Range<T>[] | Range<T>, sort?: boolean): RangeSet<T>;
    /**
    Join an array of range sets into a single set.
    */
    static join<T extends RangeValue>(sets: readonly RangeSet<T>[]): RangeSet<T>;
    /**
    The empty set of ranges.
    */
    static empty: RangeSet<any>;
}

declare class StyleModule {
  constructor(spec: {[selector: string]: StyleSpec}, options?: {
    finish?(sel: string): string
  })
  getRules(): string
  static mount(
    root: Document | ShadowRoot | DocumentOrShadowRoot,
    module: StyleModule | ReadonlyArray<StyleModule>,
    options?: {nonce?: string}
  ): void
  static newName(): string
}

type StyleSpec = {
  [propOrSelector: string]: string | number | StyleSpec | null
}

/**
Used to indicate [text direction](https://codemirror.net/6/docs/ref/#view.EditorView.textDirection).
*/
declare enum Direction {
    /**
    Left-to-right.
    */
    LTR = 0,
    /**
    Right-to-left.
    */
    RTL = 1
}
/**
Represents a contiguous range of text that has a single direction
(as in left-to-right or right-to-left).
*/
declare class BidiSpan {
    /**
    The start of the span (relative to the start of the line).
    */
    readonly from: number;
    /**
    The end of the span.
    */
    readonly to: number;
    /**
    The ["bidi
    level"](https://unicode.org/reports/tr9/#Basic_Display_Algorithm)
    of the span (in this context, 0 means
    left-to-right, 1 means right-to-left, 2 means left-to-right
    number inside right-to-left text).
    */
    readonly level: number;
    /**
    The direction of this span.
    */
    get dir(): Direction;
}

type Attrs = {
    [name: string]: string;
};

/**
Basic rectangle type.
*/
interface Rect {
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
}
type ScrollStrategy = "nearest" | "start" | "end" | "center";

interface MarkDecorationSpec {
    /**
    Whether the mark covers its start and end position or not. This
    influences whether content inserted at those positions becomes
    part of the mark. Defaults to false.
    */
    inclusive?: boolean;
    /**
    Specify whether the start position of the marked range should be
    inclusive. Overrides `inclusive`, when both are present.
    */
    inclusiveStart?: boolean;
    /**
    Whether the end should be inclusive.
    */
    inclusiveEnd?: boolean;
    /**
    Add attributes to the DOM elements that hold the text in the
    marked range.
    */
    attributes?: {
        [key: string]: string;
    };
    /**
    Shorthand for `{attributes: {class: value}}`.
    */
    class?: string;
    /**
    Add a wrapping element around the text in the marked range. Note
    that there will not necessarily be a single element covering the
    entire range—other decorations with lower precedence might split
    this one if they partially overlap it, and line breaks always
    end decoration elements.
    */
    tagName?: string;
    /**
    When using sets of decorations in
    [`bidiIsolatedRanges`](https://codemirror.net/6/docs/ref/##view.EditorView^bidiIsolatedRanges),
    this property provides the direction of the isolates. When null
    or not given, it indicates the range has `dir=auto`, and its
    direction should be derived from the first strong directional
    character in it.
    */
    bidiIsolate?: Direction | null;
    /**
    Decoration specs allow extra properties, which can be retrieved
    through the decoration's [`spec`](https://codemirror.net/6/docs/ref/#view.Decoration.spec)
    property.
    */
    [other: string]: any;
}
interface WidgetDecorationSpec {
    /**
    The type of widget to draw here.
    */
    widget: WidgetType;
    /**
    Which side of the given position the widget is on. When this is
    positive, the widget will be drawn after the cursor if the
    cursor is on the same position. Otherwise, it'll be drawn before
    it. When multiple widgets sit at the same position, their `side`
    values will determine their ordering—those with a lower value
    come first. Defaults to 0. May not be more than 10000 or less
    than -10000.
    */
    side?: number;
    /**
    By default, to avoid unintended mixing of block and inline
    widgets, block widgets with a positive `side` are always drawn
    after all inline widgets at that position, and those with a
    non-positive side before inline widgets. Setting this option to
    `true` for a block widget will turn this off and cause it to be
    rendered between the inline widgets, ordered by `side`.
    */
    inlineOrder?: boolean;
    /**
    Determines whether this is a block widgets, which will be drawn
    between lines, or an inline widget (the default) which is drawn
    between the surrounding text.
    
    Note that block-level decorations should not have vertical
    margins, and if you dynamically change their height, you should
    make sure to call
    [`requestMeasure`](https://codemirror.net/6/docs/ref/#view.EditorView.requestMeasure), so that the
    editor can update its information about its vertical layout.
    */
    block?: boolean;
    /**
    Other properties are allowed.
    */
    [other: string]: any;
}
interface ReplaceDecorationSpec {
    /**
    An optional widget to drawn in the place of the replaced
    content.
    */
    widget?: WidgetType;
    /**
    Whether this range covers the positions on its sides. This
    influences whether new content becomes part of the range and
    whether the cursor can be drawn on its sides. Defaults to false
    for inline replacements, and true for block replacements.
    */
    inclusive?: boolean;
    /**
    Set inclusivity at the start.
    */
    inclusiveStart?: boolean;
    /**
    Set inclusivity at the end.
    */
    inclusiveEnd?: boolean;
    /**
    Whether this is a block-level decoration. Defaults to false.
    */
    block?: boolean;
    /**
    Other properties are allowed.
    */
    [other: string]: any;
}
interface LineDecorationSpec {
    /**
    DOM attributes to add to the element wrapping the line.
    */
    attributes?: {
        [key: string]: string;
    };
    /**
    Shorthand for `{attributes: {class: value}}`.
    */
    class?: string;
    /**
    Other properties are allowed.
    */
    [other: string]: any;
}
/**
Widgets added to the content are described by subclasses of this
class. Using a description object like that makes it possible to
delay creating of the DOM structure for a widget until it is
needed, and to avoid redrawing widgets even if the decorations
that define them are recreated.
*/
declare abstract class WidgetType {
    /**
    Build the DOM structure for this widget instance.
    */
    abstract toDOM(view: EditorView): HTMLElement;
    /**
    Compare this instance to another instance of the same type.
    (TypeScript can't express this, but only instances of the same
    specific class will be passed to this method.) This is used to
    avoid redrawing widgets when they are replaced by a new
    decoration of the same type. The default implementation just
    returns `false`, which will cause new instances of the widget to
    always be redrawn.
    */
    eq(widget: WidgetType): boolean;
    /**
    Update a DOM element created by a widget of the same type (but
    different, non-`eq` content) to reflect this widget. May return
    true to indicate that it could update, false to indicate it
    couldn't (in which case the widget will be redrawn). The default
    implementation just returns false.
    */
    updateDOM(dom: HTMLElement, view: EditorView): boolean;
    /**
    The estimated height this widget will have, to be used when
    estimating the height of content that hasn't been drawn. May
    return -1 to indicate you don't know. The default implementation
    returns -1.
    */
    get estimatedHeight(): number;
    /**
    For inline widgets that are displayed inline (as opposed to
    `inline-block`) and introduce line breaks (through `<br>` tags
    or textual newlines), this must indicate the amount of line
    breaks they introduce. Defaults to 0.
    */
    get lineBreaks(): number;
    /**
    Can be used to configure which kinds of events inside the widget
    should be ignored by the editor. The default is to ignore all
    events.
    */
    ignoreEvent(event: Event): boolean;
    /**
    Override the way screen coordinates for positions at/in the
    widget are found. `pos` will be the offset into the widget, and
    `side` the side of the position that is being queried—less than
    zero for before, greater than zero for after, and zero for
    directly at that position.
    */
    coordsAt(dom: HTMLElement, pos: number, side: number): Rect | null;
    /**
    This is called when the an instance of the widget is removed
    from the editor view.
    */
    destroy(dom: HTMLElement): void;
}
/**
A decoration set represents a collection of decorated ranges,
organized for efficient access and mapping. See
[`RangeSet`](https://codemirror.net/6/docs/ref/#state.RangeSet) for its methods.
*/
type DecorationSet = RangeSet<Decoration>;
/**
The different types of blocks that can occur in an editor view.
*/
declare enum BlockType {
    /**
    A line of text.
    */
    Text = 0,
    /**
    A block widget associated with the position after it.
    */
    WidgetBefore = 1,
    /**
    A block widget associated with the position before it.
    */
    WidgetAfter = 2,
    /**
    A block widget [replacing](https://codemirror.net/6/docs/ref/#view.Decoration^replace) a range of content.
    */
    WidgetRange = 3
}
/**
A decoration provides information on how to draw or style a piece
of content. You'll usually use it wrapped in a
[`Range`](https://codemirror.net/6/docs/ref/#state.Range), which adds a start and end position.
@nonabstract
*/
declare abstract class Decoration extends RangeValue {
    /**
    The config object used to create this decoration. You can
    include additional properties in there to store metadata about
    your decoration.
    */
    readonly spec: any;
    protected constructor(
    /**
    @internal
    */
    startSide: number, 
    /**
    @internal
    */
    endSide: number, 
    /**
    @internal
    */
    widget: WidgetType | null, 
    /**
    The config object used to create this decoration. You can
    include additional properties in there to store metadata about
    your decoration.
    */
    spec: any);
    abstract eq(other: Decoration): boolean;
    /**
    Create a mark decoration, which influences the styling of the
    content in its range. Nested mark decorations will cause nested
    DOM elements to be created. Nesting order is determined by
    precedence of the [facet](https://codemirror.net/6/docs/ref/#view.EditorView^decorations), with
    the higher-precedence decorations creating the inner DOM nodes.
    Such elements are split on line boundaries and on the boundaries
    of lower-precedence decorations.
    */
    static mark(spec: MarkDecorationSpec): Decoration;
    /**
    Create a widget decoration, which displays a DOM element at the
    given position.
    */
    static widget(spec: WidgetDecorationSpec): Decoration;
    /**
    Create a replace decoration which replaces the given range with
    a widget, or simply hides it.
    */
    static replace(spec: ReplaceDecorationSpec): Decoration;
    /**
    Create a line decoration, which can add DOM attributes to the
    line starting at the given position.
    */
    static line(spec: LineDecorationSpec): Decoration;
    /**
    Build a [`DecorationSet`](https://codemirror.net/6/docs/ref/#view.DecorationSet) from the given
    decorated range or ranges. If the ranges aren't already sorted,
    pass `true` for `sort` to make the library sort them for you.
    */
    static set(of: Range<Decoration> | readonly Range<Decoration>[], sort?: boolean): DecorationSet;
    /**
    The empty set of decorations.
    */
    static none: DecorationSet;
}
interface BlockWrapperSpec {
    /**
    Tag name of the wrapping element.
    */
    tagName: string;
    /**
    DOM attributes to add to the wrapping element.
    */
    attributes?: {
        [key: string]: string;
    };
}
/**
A block wrapper defines a DOM node that wraps lines or other block
wrappers at the top of the document. It affects any line or block
widget that starts inside its range, including blocks starting
directly at `from` but not including `to`.
*/
declare class BlockWrapper extends RangeValue {
    readonly tagName: string;
    readonly attributes: Attrs;
    private constructor();
    eq(other: RangeValue): boolean;
    /**
    Create a block wrapper object with the given tag name and
    attributes.
    */
    static create(spec: BlockWrapperSpec): BlockWrapper;
    /**
    Create a range set from the given block wrapper ranges.
    */
    static set(of: Range<BlockWrapper> | readonly Range<BlockWrapper>[], sort?: boolean): RangeSet<BlockWrapper>;
}

/**
Command functions are used in key bindings and other types of user
actions. Given an editor view, they check whether their effect can
apply to the editor, and if it can, perform it as a side effect
(which usually means [dispatching](https://codemirror.net/6/docs/ref/#view.EditorView.dispatch) a
transaction) and return `true`.
*/
type Command = (target: EditorView) => boolean;
declare class ScrollTarget {
    readonly range: SelectionRange;
    readonly y: ScrollStrategy;
    readonly x: ScrollStrategy;
    readonly yMargin: number;
    readonly xMargin: number;
    readonly isSnapshot: boolean;
    constructor(range: SelectionRange, y?: ScrollStrategy, x?: ScrollStrategy, yMargin?: number, xMargin?: number, isSnapshot?: boolean);
    map(changes: ChangeDesc): ScrollTarget;
    clip(state: EditorState): ScrollTarget;
}
/**
This is the interface plugin objects conform to.
*/
interface PluginValue extends Object {
    /**
    Notifies the plugin of an update that happened in the view. This
    is called _before_ the view updates its own DOM. It is
    responsible for updating the plugin's internal state (including
    any state that may be read by plugin fields) and _writing_ to
    the DOM for the changes in the update. To avoid unnecessary
    layout recomputations, it should _not_ read the DOM layout—use
    [`requestMeasure`](https://codemirror.net/6/docs/ref/#view.EditorView.requestMeasure) to schedule
    your code in a DOM reading phase if you need to.
    */
    update?(update: ViewUpdate): void;
    /**
    Called when the document view is updated (due to content,
    decoration, or viewport changes). Should not try to immediately
    start another view update. Often useful for calling
    [`requestMeasure`](https://codemirror.net/6/docs/ref/#view.EditorView.requestMeasure).
    */
    docViewUpdate?(view: EditorView): void;
    /**
    Called when the plugin is no longer going to be used. Should
    revert any changes the plugin made to the DOM.
    */
    destroy?(): void;
}
/**
Provides additional information when defining a [view
plugin](https://codemirror.net/6/docs/ref/#view.ViewPlugin).
*/
interface PluginSpec<V extends PluginValue> {
    /**
    Register the given [event
    handlers](https://codemirror.net/6/docs/ref/#view.EditorView^domEventHandlers) for the plugin.
    When called, these will have their `this` bound to the plugin
    value.
    */
    eventHandlers?: DOMEventHandlers<V>;
    /**
    Registers [event observers](https://codemirror.net/6/docs/ref/#view.EditorView^domEventObservers)
    for the plugin. Will, when called, have their `this` bound to
    the plugin value.
    */
    eventObservers?: DOMEventHandlers<V>;
    /**
    Specify that the plugin provides additional extensions when
    added to an editor configuration.
    */
    provide?: (plugin: ViewPlugin<V, any>) => Extension;
    /**
    Allow the plugin to provide decorations. When given, this should
    be a function that take the plugin value and return a
    [decoration set](https://codemirror.net/6/docs/ref/#view.DecorationSet). See also the caveat about
    [layout-changing decorations](https://codemirror.net/6/docs/ref/#view.EditorView^decorations) that
    depend on the view.
    */
    decorations?: (value: V) => DecorationSet;
}
/**
View plugins associate stateful values with a view. They can
influence the way the content is drawn, and are notified of things
that happen in the view. They optionally take an argument, in
which case you need to call [`of`](https://codemirror.net/6/docs/ref/#view.ViewPlugin.of) to create
an extension for the plugin. When the argument type is undefined,
you can use the plugin instance as an extension directly.
*/
declare class ViewPlugin<V extends PluginValue, Arg = undefined> {
    /**
    When `Arg` is undefined, instances of this class act as
    extensions. Otherwise, you have to call `of` to create an
    extension value.
    */
    extension: Arg extends undefined ? Extension : null;
    private baseExtensions;
    private constructor();
    /**
    Create an extension for this plugin with the given argument.
    */
    of(arg: Arg): Extension;
    /**
    Define a plugin from a constructor function that creates the
    plugin's value, given an editor view.
    */
    static define<V extends PluginValue, Arg = undefined>(create: (view: EditorView, arg: Arg) => V, spec?: PluginSpec<V>): ViewPlugin<V, Arg>;
    /**
    Create a plugin for a class whose constructor takes a single
    editor view as argument.
    */
    static fromClass<V extends PluginValue, Arg = undefined>(cls: {
        new (view: EditorView, arg: Arg): V;
    }, spec?: PluginSpec<V>): ViewPlugin<V, Arg>;
}
interface MeasureRequest<T> {
    /**
    Called in a DOM read phase to gather information that requires
    DOM layout. Should _not_ mutate the document.
    */
    read(view: EditorView): T;
    /**
    Called in a DOM write phase to update the document. Should _not_
    do anything that triggers DOM layout.
    */
    write?(measure: T, view: EditorView): void;
    /**
    When multiple requests with the same key are scheduled, only the
    last one will actually be run.
    */
    key?: any;
}
type AttrSource = Attrs | ((view: EditorView) => Attrs | null);
/**
View [plugins](https://codemirror.net/6/docs/ref/#view.ViewPlugin) are given instances of this
class, which describe what happened, whenever the view is updated.
*/
declare class ViewUpdate {
    /**
    The editor view that the update is associated with.
    */
    readonly view: EditorView;
    /**
    The new editor state.
    */
    readonly state: EditorState;
    /**
    The transactions involved in the update. May be empty.
    */
    readonly transactions: readonly Transaction[];
    /**
    The changes made to the document by this update.
    */
    readonly changes: ChangeSet;
    /**
    The previous editor state.
    */
    readonly startState: EditorState;
    private constructor();
    /**
    Tells you whether the [viewport](https://codemirror.net/6/docs/ref/#view.EditorView.viewport) or
    [visible ranges](https://codemirror.net/6/docs/ref/#view.EditorView.visibleRanges) changed in this
    update.
    */
    get viewportChanged(): boolean;
    /**
    Returns true when
    [`viewportChanged`](https://codemirror.net/6/docs/ref/#view.ViewUpdate.viewportChanged) is true
    and the viewport change is not just the result of mapping it in
    response to document changes.
    */
    get viewportMoved(): boolean;
    /**
    Indicates whether the height of a block element in the editor
    changed in this update.
    */
    get heightChanged(): boolean;
    /**
    Returns true when the document was modified or the size of the
    editor, or elements within the editor, changed.
    */
    get geometryChanged(): boolean;
    /**
    True when this update indicates a focus change.
    */
    get focusChanged(): boolean;
    /**
    Whether the document changed in this update.
    */
    get docChanged(): boolean;
    /**
    Whether the selection was explicitly set in this update.
    */
    get selectionSet(): boolean;
}

/**
Interface that objects registered with
[`EditorView.mouseSelectionStyle`](https://codemirror.net/6/docs/ref/#view.EditorView^mouseSelectionStyle)
must conform to.
*/
interface MouseSelectionStyle {
    /**
    Return a new selection for the mouse gesture that starts with
    the event that was originally given to the constructor, and ends
    with the event passed here. In case of a plain click, those may
    both be the `mousedown` event, in case of a drag gesture, the
    latest `mousemove` event will be passed.
    
    When `extend` is true, that means the new selection should, if
    possible, extend the start selection. If `multiple` is true, the
    new selection should be added to the original selection.
    */
    get: (curEvent: MouseEvent, extend: boolean, multiple: boolean) => EditorSelection;
    /**
    Called when the view is updated while the gesture is in
    progress. When the document changes, it may be necessary to map
    some data (like the original selection or start position)
    through the changes.
    
    This may return `true` to indicate that the `get` method should
    get queried again after the update, because something in the
    update could change its result. Be wary of infinite loops when
    using this (where `get` returns a new selection, which will
    trigger `update`, which schedules another `get` in response).
    */
    update: (update: ViewUpdate) => boolean | void;
}
type MakeSelectionStyle = (view: EditorView, event: MouseEvent) => MouseSelectionStyle | null;

/**
Record used to represent information about a block-level element
in the editor view.
*/
declare class BlockInfo {
    /**
    The start of the element in the document.
    */
    readonly from: number;
    /**
    The length of the element.
    */
    readonly length: number;
    /**
    The top position of the element (relative to the top of the
    document).
    */
    readonly top: number;
    /**
    Its height.
    */
    readonly height: number;
    /**
    The type of element this is. When querying lines, this may be
    an array of all the blocks that make up the line.
    */
    get type(): BlockType | readonly BlockInfo[];
    /**
    The end of the element as a document position.
    */
    get to(): number;
    /**
    The bottom position of the element.
    */
    get bottom(): number;
    /**
    If this is a widget block, this will return the widget
    associated with it.
    */
    get widget(): WidgetType | null;
    /**
    If this is a textblock, this holds the number of line breaks
    that appear in widgets inside the block.
    */
    get widgetLineBreaks(): number;
}

/**
The type of object given to the [`EditorView`](https://codemirror.net/6/docs/ref/#view.EditorView)
constructor.
*/
interface EditorViewConfig extends EditorStateConfig {
    /**
    The view's initial state. If not given, a new state is created
    by passing this configuration object to
    [`EditorState.create`](https://codemirror.net/6/docs/ref/#state.EditorState^create), using its
    `doc`, `selection`, and `extensions` field (if provided).
    */
    state?: EditorState;
    /**
    When given, the editor is immediately appended to the given
    element on creation. (Otherwise, you'll have to place the view's
    [`dom`](https://codemirror.net/6/docs/ref/#view.EditorView.dom) element in the document yourself.)
    */
    parent?: Element | DocumentFragment;
    /**
    If the view is going to be mounted in a shadow root or document
    other than the one held by the global variable `document` (the
    default), you should pass it here. If you provide `parent`, but
    not this option, the editor will automatically look up a root
    from the parent.
    */
    root?: Document | ShadowRoot;
    /**
    Pass an effect created with
    [`EditorView.scrollIntoView`](https://codemirror.net/6/docs/ref/#view.EditorView^scrollIntoView) or
    [`EditorView.scrollSnapshot`](https://codemirror.net/6/docs/ref/#view.EditorView.scrollSnapshot)
    here to set an initial scroll position.
    */
    scrollTo?: StateEffect<any>;
    /**
    Override the way transactions are
    [dispatched](https://codemirror.net/6/docs/ref/#view.EditorView.dispatch) for this editor view.
    Your implementation, if provided, should probably call the
    view's [`update` method](https://codemirror.net/6/docs/ref/#view.EditorView.update).
    */
    dispatchTransactions?: (trs: readonly Transaction[], view: EditorView) => void;
    /**
    **Deprecated** single-transaction version of
    `dispatchTransactions`. Will force transactions to be dispatched
    one at a time when used.
    */
    dispatch?: (tr: Transaction, view: EditorView) => void;
}
/**
An editor view represents the editor's user interface. It holds
the editable DOM surface, and possibly other elements such as the
line number gutter. It handles events and dispatches state
transactions for editing actions.
*/
declare class EditorView {
    /**
    The current editor state.
    */
    get state(): EditorState;
    /**
    To be able to display large documents without consuming too much
    memory or overloading the browser, CodeMirror only draws the
    code that is visible (plus a margin around it) to the DOM. This
    property tells you the extent of the current drawn viewport, in
    document positions.
    */
    get viewport(): {
        from: number;
        to: number;
    };
    /**
    When there are, for example, large collapsed ranges in the
    viewport, its size can be a lot bigger than the actual visible
    content. Thus, if you are doing something like styling the
    content in the viewport, it is preferable to only do so for
    these ranges, which are the subset of the viewport that is
    actually drawn.
    */
    get visibleRanges(): readonly {
        from: number;
        to: number;
    }[];
    /**
    Returns false when the editor is entirely scrolled out of view
    or otherwise hidden.
    */
    get inView(): boolean;
    /**
    Indicates whether the user is currently composing text via
    [IME](https://en.wikipedia.org/wiki/Input_method), and at least
    one change has been made in the current composition.
    */
    get composing(): boolean;
    /**
    Indicates whether the user is currently in composing state. Note
    that on some platforms, like Android, this will be the case a
    lot, since just putting the cursor on a word starts a
    composition there.
    */
    get compositionStarted(): boolean;
    private dispatchTransactions;
    private _root;
    /**
    The document or shadow root that the view lives in.
    */
    get root(): DocumentOrShadowRoot;
    /**
    The DOM element that wraps the entire editor view.
    */
    readonly dom: HTMLElement;
    /**
    The DOM element that can be styled to scroll. (Note that it may
    not have been, so you can't assume this is scrollable.)
    */
    readonly scrollDOM: HTMLElement;
    /**
    The editable DOM element holding the editor content. You should
    not, usually, interact with this content directly though the
    DOM, since the editor will immediately undo most of the changes
    you make. Instead, [dispatch](https://codemirror.net/6/docs/ref/#view.EditorView.dispatch)
    [transactions](https://codemirror.net/6/docs/ref/#state.Transaction) to modify content, and
    [decorations](https://codemirror.net/6/docs/ref/#view.Decoration) to style it.
    */
    readonly contentDOM: HTMLElement;
    private announceDOM;
    private plugins;
    private pluginMap;
    private editorAttrs;
    private contentAttrs;
    private styleModules;
    private bidiCache;
    private destroyed;
    /**
    Construct a new view. You'll want to either provide a `parent`
    option, or put `view.dom` into your document after creating a
    view, so that the user can see the editor.
    */
    constructor(config?: EditorViewConfig);
    /**
    All regular editor state updates should go through this. It
    takes a transaction, array of transactions, or transaction spec
    and updates the view to show the new state produced by that
    transaction. Its implementation can be overridden with an
    [option](https://codemirror.net/6/docs/ref/#view.EditorView.constructor^config.dispatchTransactions).
    This function is bound to the view instance, so it does not have
    to be called as a method.
    
    Note that when multiple `TransactionSpec` arguments are
    provided, these define a single transaction (the specs will be
    merged), not a sequence of transactions.
    */
    dispatch(tr: Transaction): void;
    dispatch(trs: readonly Transaction[]): void;
    dispatch(...specs: TransactionSpec[]): void;
    /**
    Update the view for the given array of transactions. This will
    update the visible document and selection to match the state
    produced by the transactions, and notify view plugins of the
    change. You should usually call
    [`dispatch`](https://codemirror.net/6/docs/ref/#view.EditorView.dispatch) instead, which uses this
    as a primitive.
    */
    update(transactions: readonly Transaction[]): void;
    /**
    Reset the view to the given state. (This will cause the entire
    document to be redrawn and all view plugins to be reinitialized,
    so you should probably only use it when the new state isn't
    derived from the old state. Otherwise, use
    [`dispatch`](https://codemirror.net/6/docs/ref/#view.EditorView.dispatch) instead.)
    */
    setState(newState: EditorState): void;
    private updatePlugins;
    private docViewUpdate;
    /**
    Get the CSS classes for the currently active editor themes.
    */
    get themeClasses(): string;
    private updateAttrs;
    private showAnnouncements;
    private mountStyles;
    private readMeasured;
    /**
    Schedule a layout measurement, optionally providing callbacks to
    do custom DOM measuring followed by a DOM write phase. Using
    this is preferable reading DOM layout directly from, for
    example, an event handler, because it'll make sure measuring and
    drawing done by other components is synchronized, avoiding
    unnecessary DOM layout computations.
    */
    requestMeasure<T>(request?: MeasureRequest<T>): void;
    /**
    Get the value of a specific plugin, if present. Note that
    plugins that crash can be dropped from a view, so even when you
    know you registered a given plugin, it is recommended to check
    the return value of this method.
    */
    plugin<T extends PluginValue>(plugin: ViewPlugin<T, any>): T | null;
    /**
    The top position of the document, in screen coordinates. This
    may be negative when the editor is scrolled down. Points
    directly to the top of the first line, not above the padding.
    */
    get documentTop(): number;
    /**
    Reports the padding above and below the document.
    */
    get documentPadding(): {
        top: number;
        bottom: number;
    };
    /**
    If the editor is transformed with CSS, this provides the scale
    along the X axis. Otherwise, it will just be 1. Note that
    transforms other than translation and scaling are not supported.
    */
    get scaleX(): number;
    /**
    Provide the CSS transformed scale along the Y axis.
    */
    get scaleY(): number;
    /**
    Find the text line or block widget at the given vertical
    position (which is interpreted as relative to the [top of the
    document](https://codemirror.net/6/docs/ref/#view.EditorView.documentTop)).
    */
    elementAtHeight(height: number): BlockInfo;
    /**
    Find the line block (see
    [`lineBlockAt`](https://codemirror.net/6/docs/ref/#view.EditorView.lineBlockAt)) at the given
    height, again interpreted relative to the [top of the
    document](https://codemirror.net/6/docs/ref/#view.EditorView.documentTop).
    */
    lineBlockAtHeight(height: number): BlockInfo;
    /**
    Get the extent and vertical position of all [line
    blocks](https://codemirror.net/6/docs/ref/#view.EditorView.lineBlockAt) in the viewport. Positions
    are relative to the [top of the
    document](https://codemirror.net/6/docs/ref/#view.EditorView.documentTop);
    */
    get viewportLineBlocks(): BlockInfo[];
    /**
    Find the line block around the given document position. A line
    block is a range delimited on both sides by either a
    non-[hidden](https://codemirror.net/6/docs/ref/#view.Decoration^replace) line break, or the
    start/end of the document. It will usually just hold a line of
    text, but may be broken into multiple textblocks by block
    widgets.
    */
    lineBlockAt(pos: number): BlockInfo;
    /**
    The editor's total content height.
    */
    get contentHeight(): number;
    /**
    Move a cursor position by [grapheme
    cluster](https://codemirror.net/6/docs/ref/#state.findClusterBreak). `forward` determines whether
    the motion is away from the line start, or towards it. In
    bidirectional text, the line is traversed in visual order, using
    the editor's [text direction](https://codemirror.net/6/docs/ref/#view.EditorView.textDirection).
    When the start position was the last one on the line, the
    returned position will be across the line break. If there is no
    further line, the original position is returned.
    
    By default, this method moves over a single cluster. The
    optional `by` argument can be used to move across more. It will
    be called with the first cluster as argument, and should return
    a predicate that determines, for each subsequent cluster,
    whether it should also be moved over.
    */
    moveByChar(start: SelectionRange, forward: boolean, by?: (initial: string) => (next: string) => boolean): SelectionRange;
    /**
    Move a cursor position across the next group of either
    [letters](https://codemirror.net/6/docs/ref/#state.EditorState.charCategorizer) or non-letter
    non-whitespace characters.
    */
    moveByGroup(start: SelectionRange, forward: boolean): SelectionRange;
    /**
    Get the cursor position visually at the start or end of a line.
    Note that this may differ from the _logical_ position at its
    start or end (which is simply at `line.from`/`line.to`) if text
    at the start or end goes against the line's base text direction.
    */
    visualLineSide(line: Line$1, end: boolean): SelectionRange;
    /**
    Move to the next line boundary in the given direction. If
    `includeWrap` is true, line wrapping is on, and there is a
    further wrap point on the current line, the wrap point will be
    returned. Otherwise this function will return the start or end
    of the line.
    */
    moveToLineBoundary(start: SelectionRange, forward: boolean, includeWrap?: boolean): SelectionRange;
    /**
    Move a cursor position vertically. When `distance` isn't given,
    it defaults to moving to the next line (including wrapped
    lines). Otherwise, `distance` should provide a positive distance
    in pixels.
    
    When `start` has a
    [`goalColumn`](https://codemirror.net/6/docs/ref/#state.SelectionRange.goalColumn), the vertical
    motion will use that as a target horizontal position. Otherwise,
    the cursor's own horizontal position is used. The returned
    cursor will have its goal column set to whichever column was
    used.
    */
    moveVertically(start: SelectionRange, forward: boolean, distance?: number): SelectionRange;
    /**
    Find the DOM parent node and offset (child offset if `node` is
    an element, character offset when it is a text node) at the
    given document position.
    
    Note that for positions that aren't currently in
    `visibleRanges`, the resulting DOM position isn't necessarily
    meaningful (it may just point before or after a placeholder
    element).
    */
    domAtPos(pos: number, side?: -1 | 1): {
        node: Node;
        offset: number;
    };
    /**
    Find the document position at the given DOM node. Can be useful
    for associating positions with DOM events. Will raise an error
    when `node` isn't part of the editor content.
    */
    posAtDOM(node: Node, offset?: number): number;
    /**
    Get the document position at the given screen coordinates. For
    positions not covered by the visible viewport's DOM structure,
    this will return null, unless `false` is passed as second
    argument, in which case it'll return an estimated position that
    would be near the coordinates if it were rendered.
    */
    posAtCoords(coords: {
        x: number;
        y: number;
    }, precise: false): number;
    posAtCoords(coords: {
        x: number;
        y: number;
    }): number | null;
    /**
    Like [`posAtCoords`](https://codemirror.net/6/docs/ref/#view.EditorView.posAtCoords), but also
    returns which side of the position the coordinates are closest
    to. For example, for coordinates on the left side of a
    left-to-right character, the position before that letter is
    returned, with `assoc` 1, whereas on the right side, you'd get
    the position after the character, with `assoc` -1.
    */
    posAndSideAtCoords(coords: {
        x: number;
        y: number;
    }, precise: false): {
        pos: number;
        assoc: -1 | 1;
    };
    posAndSideAtCoords(coords: {
        x: number;
        y: number;
    }): {
        pos: number;
        assoc: -1 | 1;
    } | null;
    /**
    Get the screen coordinates at the given document position.
    `side` determines whether the coordinates are based on the
    element before (-1) or after (1) the position (if no element is
    available on the given side, the method will transparently use
    another strategy to get reasonable coordinates).
    */
    coordsAtPos(pos: number, side?: -1 | 1): Rect | null;
    /**
    Return the rectangle around a given character. If `pos` does not
    point in front of a character that is in the viewport and
    rendered (i.e. not replaced, not a line break), this will return
    null. For space characters that are a line wrap point, this will
    return the position before the line break.
    */
    coordsForChar(pos: number): Rect | null;
    /**
    The default width of a character in the editor. May not
    accurately reflect the width of all characters (given variable
    width fonts or styling of invididual ranges).
    */
    get defaultCharacterWidth(): number;
    /**
    The default height of a line in the editor. May not be accurate
    for all lines.
    */
    get defaultLineHeight(): number;
    /**
    The text direction
    ([`direction`](https://developer.mozilla.org/en-US/docs/Web/CSS/direction)
    CSS property) of the editor's content element.
    */
    get textDirection(): Direction;
    /**
    Find the text direction of the block at the given position, as
    assigned by CSS. If
    [`perLineTextDirection`](https://codemirror.net/6/docs/ref/#view.EditorView^perLineTextDirection)
    isn't enabled, or the given position is outside of the viewport,
    this will always return the same as
    [`textDirection`](https://codemirror.net/6/docs/ref/#view.EditorView.textDirection). Note that
    this may trigger a DOM layout.
    */
    textDirectionAt(pos: number): Direction;
    /**
    Whether this editor [wraps lines](https://codemirror.net/6/docs/ref/#view.EditorView.lineWrapping)
    (as determined by the
    [`white-space`](https://developer.mozilla.org/en-US/docs/Web/CSS/white-space)
    CSS property of its content element).
    */
    get lineWrapping(): boolean;
    /**
    Returns the bidirectional text structure of the given line
    (which should be in the current document) as an array of span
    objects. The order of these spans matches the [text
    direction](https://codemirror.net/6/docs/ref/#view.EditorView.textDirection)—if that is
    left-to-right, the leftmost spans come first, otherwise the
    rightmost spans come first.
    */
    bidiSpans(line: Line$1): readonly BidiSpan[];
    /**
    Check whether the editor has focus.
    */
    get hasFocus(): boolean;
    /**
    Put focus on the editor.
    */
    focus(): void;
    /**
    Update the [root](https://codemirror.net/6/docs/ref/##view.EditorViewConfig.root) in which the editor lives. This is only
    necessary when moving the editor's existing DOM to a new window or shadow root.
    */
    setRoot(root: Document | ShadowRoot): void;
    /**
    Clean up this editor view, removing its element from the
    document, unregistering event handlers, and notifying
    plugins. The view instance can no longer be used after
    calling this.
    */
    destroy(): void;
    /**
    Returns an effect that can be
    [added](https://codemirror.net/6/docs/ref/#state.TransactionSpec.effects) to a transaction to
    cause it to scroll the given position or range into view.
    */
    static scrollIntoView(pos: number | SelectionRange, options?: {
        /**
        By default (`"nearest"`) the position will be vertically
        scrolled only the minimal amount required to move the given
        position into view. You can set this to `"start"` to move it
        to the top of the view, `"end"` to move it to the bottom, or
        `"center"` to move it to the center.
        */
        y?: ScrollStrategy;
        /**
        Effect similar to
        [`y`](https://codemirror.net/6/docs/ref/#view.EditorView^scrollIntoView^options.y), but for the
        horizontal scroll position.
        */
        x?: ScrollStrategy;
        /**
        Extra vertical distance to add when moving something into
        view. Not used with the `"center"` strategy. Defaults to 5.
        Must be less than the height of the editor.
        */
        yMargin?: number;
        /**
        Extra horizontal distance to add. Not used with the `"center"`
        strategy. Defaults to 5. Must be less than the width of the
        editor.
        */
        xMargin?: number;
    }): StateEffect<unknown>;
    /**
    Return an effect that resets the editor to its current (at the
    time this method was called) scroll position. Note that this
    only affects the editor's own scrollable element, not parents.
    See also
    [`EditorViewConfig.scrollTo`](https://codemirror.net/6/docs/ref/#view.EditorViewConfig.scrollTo).
    
    The effect should be used with a document identical to the one
    it was created for. Failing to do so is not an error, but may
    not scroll to the expected position. You can
    [map](https://codemirror.net/6/docs/ref/#state.StateEffect.map) the effect to account for changes.
    */
    scrollSnapshot(): StateEffect<ScrollTarget>;
    /**
    Enable or disable tab-focus mode, which disables key bindings
    for Tab and Shift-Tab, letting the browser's default
    focus-changing behavior go through instead. This is useful to
    prevent trapping keyboard users in your editor.
    
    Without argument, this toggles the mode. With a boolean, it
    enables (true) or disables it (false). Given a number, it
    temporarily enables the mode until that number of milliseconds
    have passed or another non-Tab key is pressed.
    */
    setTabFocusMode(to?: boolean | number): void;
    /**
    Facet to add a [style
    module](https://github.com/marijnh/style-mod#documentation) to
    an editor view. The view will ensure that the module is
    mounted in its [document
    root](https://codemirror.net/6/docs/ref/#view.EditorView.constructor^config.root).
    */
    static styleModule: Facet<StyleModule, readonly StyleModule[]>;
    /**
    Returns an extension that can be used to add DOM event handlers.
    The value should be an object mapping event names to handler
    functions. For any given event, such functions are ordered by
    extension precedence, and the first handler to return true will
    be assumed to have handled that event, and no other handlers or
    built-in behavior will be activated for it. These are registered
    on the [content element](https://codemirror.net/6/docs/ref/#view.EditorView.contentDOM), except
    for `scroll` handlers, which will be called any time the
    editor's [scroll element](https://codemirror.net/6/docs/ref/#view.EditorView.scrollDOM) or one of
    its parent nodes is scrolled.
    */
    static domEventHandlers(handlers: DOMEventHandlers<any>): Extension;
    /**
    Create an extension that registers DOM event observers. Contrary
    to event [handlers](https://codemirror.net/6/docs/ref/#view.EditorView^domEventHandlers),
    observers can't be prevented from running by a higher-precedence
    handler returning true. They also don't prevent other handlers
    and observers from running when they return true, and should not
    call `preventDefault`.
    */
    static domEventObservers(observers: DOMEventHandlers<any>): Extension;
    /**
    An input handler can override the way changes to the editable
    DOM content are handled. Handlers are passed the document
    positions between which the change was found, and the new
    content. When one returns true, no further input handlers are
    called and the default behavior is prevented.
    
    The `insert` argument can be used to get the default transaction
    that would be applied for this input. This can be useful when
    dispatching the custom behavior as a separate transaction.
    */
    static inputHandler: Facet<(view: EditorView, from: number, to: number, text: string, insert: () => Transaction) => boolean, readonly ((view: EditorView, from: number, to: number, text: string, insert: () => Transaction) => boolean)[]>;
    /**
    Functions provided in this facet will be used to transform text
    pasted or dropped into the editor.
    */
    static clipboardInputFilter: Facet<(text: string, state: EditorState) => string, readonly ((text: string, state: EditorState) => string)[]>;
    /**
    Transform text copied or dragged from the editor.
    */
    static clipboardOutputFilter: Facet<(text: string, state: EditorState) => string, readonly ((text: string, state: EditorState) => string)[]>;
    /**
    Scroll handlers can override how things are scrolled into view.
    If they return `true`, no further handling happens for the
    scrolling. If they return false, the default scroll behavior is
    applied. Scroll handlers should never initiate editor updates.
    */
    static scrollHandler: Facet<(view: EditorView, range: SelectionRange, options: {
        x: ScrollStrategy;
        y: ScrollStrategy;
        xMargin: number;
        yMargin: number;
    }) => boolean, readonly ((view: EditorView, range: SelectionRange, options: {
        x: ScrollStrategy;
        y: ScrollStrategy;
        xMargin: number;
        yMargin: number;
    }) => boolean)[]>;
    /**
    This facet can be used to provide functions that create effects
    to be dispatched when the editor's focus state changes.
    */
    static focusChangeEffect: Facet<(state: EditorState, focusing: boolean) => StateEffect<any> | null, readonly ((state: EditorState, focusing: boolean) => StateEffect<any> | null)[]>;
    /**
    By default, the editor assumes all its content has the same
    [text direction](https://codemirror.net/6/docs/ref/#view.Direction). Configure this with a `true`
    value to make it read the text direction of every (rendered)
    line separately.
    */
    static perLineTextDirection: Facet<boolean, boolean>;
    /**
    Allows you to provide a function that should be called when the
    library catches an exception from an extension (mostly from view
    plugins, but may be used by other extensions to route exceptions
    from user-code-provided callbacks). This is mostly useful for
    debugging and logging. See [`logException`](https://codemirror.net/6/docs/ref/#view.logException).
    */
    static exceptionSink: Facet<(exception: any) => void, readonly ((exception: any) => void)[]>;
    /**
    A facet that can be used to register a function to be called
    every time the view updates.
    */
    static updateListener: Facet<(update: ViewUpdate) => void, readonly ((update: ViewUpdate) => void)[]>;
    /**
    Facet that controls whether the editor content DOM is editable.
    When its highest-precedence value is `false`, the element will
    not have its `contenteditable` attribute set. (Note that this
    doesn't affect API calls that change the editor content, even
    when those are bound to keys or buttons. See the
    [`readOnly`](https://codemirror.net/6/docs/ref/#state.EditorState.readOnly) facet for that.)
    */
    static editable: Facet<boolean, boolean>;
    /**
    Allows you to influence the way mouse selection happens. The
    functions in this facet will be called for a `mousedown` event
    on the editor, and can return an object that overrides the way a
    selection is computed from that mouse click or drag.
    */
    static mouseSelectionStyle: Facet<MakeSelectionStyle, readonly MakeSelectionStyle[]>;
    /**
    Facet used to configure whether a given selection drag event
    should move or copy the selection. The given predicate will be
    called with the `mousedown` event, and can return `true` when
    the drag should move the content.
    */
    static dragMovesSelection: Facet<(event: MouseEvent) => boolean, readonly ((event: MouseEvent) => boolean)[]>;
    /**
    Facet used to configure whether a given selecting click adds a
    new range to the existing selection or replaces it entirely. The
    default behavior is to check `event.metaKey` on macOS, and
    `event.ctrlKey` elsewhere.
    */
    static clickAddsSelectionRange: Facet<(event: MouseEvent) => boolean, readonly ((event: MouseEvent) => boolean)[]>;
    /**
    A facet that determines which [decorations](https://codemirror.net/6/docs/ref/#view.Decoration)
    are shown in the view. Decorations can be provided in two
    ways—directly, or via a function that takes an editor view.
    
    Only decoration sets provided directly are allowed to influence
    the editor's vertical layout structure. The ones provided as
    functions are called _after_ the new viewport has been computed,
    and thus **must not** introduce block widgets or replacing
    decorations that cover line breaks.
    
    If you want decorated ranges to behave like atomic units for
    cursor motion and deletion purposes, also provide the range set
    containing the decorations to
    [`EditorView.atomicRanges`](https://codemirror.net/6/docs/ref/#view.EditorView^atomicRanges).
    */
    static decorations: Facet<DecorationSet | ((view: EditorView) => DecorationSet), readonly (DecorationSet | ((view: EditorView) => DecorationSet))[]>;
    /**
    [Block wrappers](https://codemirror.net/6/docs/ref/#view.BlockWrapper) provide a way to add DOM
    structure around editor lines and block widgets. Sets of
    wrappers are provided in a similar way to decorations, and are
    nested in a similar way when they overlap. A wrapper affects all
    lines and block widgets that start inside its range.
    */
    static blockWrappers: Facet<RangeSet<BlockWrapper> | ((view: EditorView) => RangeSet<BlockWrapper>), readonly (RangeSet<BlockWrapper> | ((view: EditorView) => RangeSet<BlockWrapper>))[]>;
    /**
    Facet that works much like
    [`decorations`](https://codemirror.net/6/docs/ref/#view.EditorView^decorations), but puts its
    inputs at the very bottom of the precedence stack, meaning mark
    decorations provided here will only be split by other, partially
    overlapping `outerDecorations` ranges, and wrap around all
    regular decorations. Use this for mark elements that should, as
    much as possible, remain in one piece.
    */
    static outerDecorations: Facet<DecorationSet | ((view: EditorView) => DecorationSet), readonly (DecorationSet | ((view: EditorView) => DecorationSet))[]>;
    /**
    Used to provide ranges that should be treated as atoms as far as
    cursor motion is concerned. This causes methods like
    [`moveByChar`](https://codemirror.net/6/docs/ref/#view.EditorView.moveByChar) and
    [`moveVertically`](https://codemirror.net/6/docs/ref/#view.EditorView.moveVertically) (and the
    commands built on top of them) to skip across such regions when
    a selection endpoint would enter them. This does _not_ prevent
    direct programmatic [selection
    updates](https://codemirror.net/6/docs/ref/#state.TransactionSpec.selection) from moving into such
    regions.
    */
    static atomicRanges: Facet<(view: EditorView) => RangeSet<any>, readonly ((view: EditorView) => RangeSet<any>)[]>;
    /**
    When range decorations add a `unicode-bidi: isolate` style, they
    should also include a
    [`bidiIsolate`](https://codemirror.net/6/docs/ref/#view.MarkDecorationSpec.bidiIsolate) property
    in their decoration spec, and be exposed through this facet, so
    that the editor can compute the proper text order. (Other values
    for `unicode-bidi`, except of course `normal`, are not
    supported.)
    */
    static bidiIsolatedRanges: Facet<DecorationSet | ((view: EditorView) => DecorationSet), readonly (DecorationSet | ((view: EditorView) => DecorationSet))[]>;
    /**
    Facet that allows extensions to provide additional scroll
    margins (space around the sides of the scrolling element that
    should be considered invisible). This can be useful when the
    plugin introduces elements that cover part of that element (for
    example a horizontally fixed gutter).
    */
    static scrollMargins: Facet<(view: EditorView) => Partial<Rect> | null, readonly ((view: EditorView) => Partial<Rect> | null)[]>;
    /**
    Create a theme extension. The first argument can be a
    [`style-mod`](https://github.com/marijnh/style-mod#documentation)
    style spec providing the styles for the theme. These will be
    prefixed with a generated class for the style.
    
    Because the selectors will be prefixed with a scope class, rule
    that directly match the editor's [wrapper
    element](https://codemirror.net/6/docs/ref/#view.EditorView.dom)—to which the scope class will be
    added—need to be explicitly differentiated by adding an `&` to
    the selector for that element—for example
    `&.cm-focused`.
    
    When `dark` is set to true, the theme will be marked as dark,
    which will cause the `&dark` rules from [base
    themes](https://codemirror.net/6/docs/ref/#view.EditorView^baseTheme) to be used (as opposed to
    `&light` when a light theme is active).
    */
    static theme(spec: {
        [selector: string]: StyleSpec;
    }, options?: {
        dark?: boolean;
    }): Extension;
    /**
    This facet records whether a dark theme is active. The extension
    returned by [`theme`](https://codemirror.net/6/docs/ref/#view.EditorView^theme) automatically
    includes an instance of this when the `dark` option is set to
    true.
    */
    static darkTheme: Facet<boolean, boolean>;
    /**
    Create an extension that adds styles to the base theme. Like
    with [`theme`](https://codemirror.net/6/docs/ref/#view.EditorView^theme), use `&` to indicate the
    place of the editor wrapper element when directly targeting
    that. You can also use `&dark` or `&light` instead to only
    target editors with a dark or light theme.
    */
    static baseTheme(spec: {
        [selector: string]: StyleSpec;
    }): Extension;
    /**
    Provides a Content Security Policy nonce to use when creating
    the style sheets for the editor. Holds the empty string when no
    nonce has been provided.
    */
    static cspNonce: Facet<string, string>;
    /**
    Facet that provides additional DOM attributes for the editor's
    editable DOM element.
    */
    static contentAttributes: Facet<AttrSource, readonly AttrSource[]>;
    /**
    Facet that provides DOM attributes for the editor's outer
    element.
    */
    static editorAttributes: Facet<AttrSource, readonly AttrSource[]>;
    /**
    An extension that enables line wrapping in the editor (by
    setting CSS `white-space` to `pre-wrap` in the content).
    */
    static lineWrapping: Extension;
    /**
    State effect used to include screen reader announcements in a
    transaction. These will be added to the DOM in a visually hidden
    element with `aria-live="polite"` set, and should be used to
    describe effects that are visually obvious but may not be
    noticed by screen reader users (such as moving to the next
    search match).
    */
    static announce: StateEffectType<string>;
    /**
    Retrieve an editor view instance from the view's DOM
    representation.
    */
    static findFromDOM(dom: HTMLElement): EditorView | null;
}
/**
Helper type that maps event names to event object types, or the
`any` type for unknown events.
*/
interface DOMEventMap extends HTMLElementEventMap {
    [other: string]: any;
}
/**
Event handlers are specified with objects like this. For event
types known by TypeScript, this will infer the event argument type
to hold the appropriate event object type. For unknown events, it
is inferred to `any`, and should be explicitly set if you want type
checking.
*/
type DOMEventHandlers<This> = {
    [event in keyof DOMEventMap]?: (this: This, event: DOMEventMap[event], view: EditorView) => boolean | void;
};

/**
Key bindings associate key names with
[command](https://codemirror.net/6/docs/ref/#view.Command)-style functions.

Key names may be strings like `"Shift-Ctrl-Enter"`—a key identifier
prefixed with zero or more modifiers. Key identifiers are based on
the strings that can appear in
[`KeyEvent.key`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key).
Use lowercase letters to refer to letter keys (or uppercase letters
if you want shift to be held). You may use `"Space"` as an alias
for the `" "` name.

Modifiers can be given in any order. `Shift-` (or `s-`), `Alt-` (or
`a-`), `Ctrl-` (or `c-` or `Control-`) and `Cmd-` (or `m-` or
`Meta-`) are recognized.

When a key binding contains multiple key names separated by
spaces, it represents a multi-stroke binding, which will fire when
the user presses the given keys after each other.

You can use `Mod-` as a shorthand for `Cmd-` on Mac and `Ctrl-` on
other platforms. So `Mod-b` is `Ctrl-b` on Linux but `Cmd-b` on
macOS.
*/
interface KeyBinding {
    /**
    The key name to use for this binding. If the platform-specific
    property (`mac`, `win`, or `linux`) for the current platform is
    used as well in the binding, that one takes precedence. If `key`
    isn't defined and the platform-specific binding isn't either,
    a binding is ignored.
    */
    key?: string;
    /**
    Key to use specifically on macOS.
    */
    mac?: string;
    /**
    Key to use specifically on Windows.
    */
    win?: string;
    /**
    Key to use specifically on Linux.
    */
    linux?: string;
    /**
    The command to execute when this binding is triggered. When the
    command function returns `false`, further bindings will be tried
    for the key.
    */
    run?: Command;
    /**
    When given, this defines a second binding, using the (possibly
    platform-specific) key name prefixed with `Shift-` to activate
    this command.
    */
    shift?: Command;
    /**
    When this property is present, the function is called for every
    key that is not a multi-stroke prefix.
    */
    any?: (view: EditorView, event: KeyboardEvent) => boolean;
    /**
    By default, key bindings apply when focus is on the editor
    content (the `"editor"` scope). Some extensions, mostly those
    that define their own panels, might want to allow you to
    register bindings local to that panel. Such bindings should use
    a custom scope name. You may also assign multiple scope names to
    a binding, separating them by spaces.
    */
    scope?: string;
    /**
    When set to true (the default is false), this will always
    prevent the further handling for the bound key, even if the
    command(s) return false. This can be useful for cases where the
    native behavior of the key is annoying or irrelevant but the
    command doesn't always apply (such as, Mod-u for undo selection,
    which would cause the browser to view source instead when no
    selection can be undone).
    */
    preventDefault?: boolean;
    /**
    When set to true, `stopPropagation` will be called on keyboard
    events that have their `preventDefault` called in response to
    this key binding (see also
    [`preventDefault`](https://codemirror.net/6/docs/ref/#view.KeyBinding.preventDefault)).
    */
    stopPropagation?: boolean;
}
/**
Facet used for registering keymaps.

You can add multiple keymaps to an editor. Their priorities
determine their precedence (the ones specified early or with high
priority get checked first). When a handler has returned `true`
for a given key, no further handlers are called.
*/
declare const keymap: Facet<readonly KeyBinding[], readonly (readonly KeyBinding[])[]>;

type SelectionConfig = {
    /**
    The length of a full cursor blink cycle, in milliseconds.
    Defaults to 1200. Can be set to 0 to disable blinking.
    */
    cursorBlinkRate?: number;
    /**
    Whether to show a cursor for non-empty ranges. Defaults to
    true.
    */
    drawRangeCursor?: boolean;
};
/**
Returns an extension that hides the browser's native selection and
cursor, replacing the selection with a background behind the text
(with the `cm-selectionBackground` class), and the
cursors with elements overlaid over the code (using
`cm-cursor-primary` and `cm-cursor-secondary`).

This allows the editor to display secondary selection ranges, and
tends to produce a type of selection more in line with that users
expect in a text editor (the native selection styling will often
leave gaps between lines and won't fill the horizontal space after
a line when the selection continues past it).

It does have a performance cost, in that it requires an extra DOM
layout cycle for many updates (the selection is drawn based on DOM
layout information that's only available after laying out the
content).
*/
declare function drawSelection(config?: SelectionConfig): Extension;

interface SpecialCharConfig {
    /**
    An optional function that renders the placeholder elements.
    
    The `description` argument will be text that clarifies what the
    character is, which should be provided to screen readers (for
    example with the
    [`aria-label`](https://www.w3.org/TR/wai-aria/#aria-label)
    attribute) and optionally shown to the user in other ways (such
    as the
    [`title`](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/title)
    attribute).
    
    The given placeholder string is a suggestion for how to display
    the character visually.
    */
    render?: ((code: number, description: string | null, placeholder: string) => HTMLElement) | null;
    /**
    Regular expression that matches the special characters to
    highlight. Must have its 'g'/global flag set.
    */
    specialChars?: RegExp;
    /**
    Regular expression that can be used to add characters to the
    default set of characters to highlight.
    */
    addSpecialChars?: RegExp | null;
}
/**
Returns an extension that installs highlighting of special
characters.
*/
declare function highlightSpecialChars(
/**
Configuration options.
*/
config?: SpecialCharConfig): Extension;

/**
Mark lines that have a cursor on them with the `"cm-activeLine"`
DOM class.
*/
declare function highlightActiveLine(): Extension;

/**
Extension that enables a placeholder—a piece of example content
to show when the editor is empty.
*/
declare function placeholder(content: string | HTMLElement | ((view: EditorView) => HTMLElement)): Extension;

/**
Helper class used to make it easier to maintain decorations on
visible code that matches a given regular expression. To be used
in a [view plugin](https://codemirror.net/6/docs/ref/#view.ViewPlugin). Instances of this object
represent a matching configuration.
*/
declare class MatchDecorator {
    private regexp;
    private addMatch;
    private boundary;
    private maxLength;
    /**
    Create a decorator.
    */
    constructor(config: {
        /**
        The regular expression to match against the content. Will only
        be matched inside lines (not across them). Should have its 'g'
        flag set.
        */
        regexp: RegExp;
        /**
        The decoration to apply to matches, either directly or as a
        function of the match.
        */
        decoration?: Decoration | ((match: RegExpExecArray, view: EditorView, pos: number) => Decoration | null);
        /**
        Customize the way decorations are added for matches. This
        function, when given, will be called for matches and should
        call `add` to create decorations for them. Note that the
        decorations should appear *in* the given range, and the
        function should have no side effects beyond calling `add`.
        
        The `decoration` option is ignored when `decorate` is
        provided.
        */
        decorate?: (add: (from: number, to: number, decoration: Decoration) => void, from: number, to: number, match: RegExpExecArray, view: EditorView) => void;
        /**
        By default, changed lines are re-matched entirely. You can
        provide a boundary expression, which should match single
        character strings that can never occur in `regexp`, to reduce
        the amount of re-matching.
        */
        boundary?: RegExp;
        /**
        Matching happens by line, by default, but when lines are
        folded or very long lines are only partially drawn, the
        decorator may avoid matching part of them for speed. This
        controls how much additional invisible content it should
        include in its matches. Defaults to 1000.
        */
        maxLength?: number;
    });
    /**
    Compute the full set of decorations for matches in the given
    view's viewport. You'll want to call this when initializing your
    plugin.
    */
    createDeco(view: EditorView): RangeSet<Decoration>;
    /**
    Update a set of decorations for a view update. `deco` _must_ be
    the set of decorations produced by _this_ `MatchDecorator` for
    the view state before the update.
    */
    updateDeco(update: ViewUpdate, deco: DecorationSet): DecorationSet;
    private updateRange;
}

/**
Create an extension that enables rectangular selections. By
default, it will react to left mouse drag with the Alt key held
down. When such a selection occurs, the text within the rectangle
that was dragged over will be selected, as one selection
[range](https://codemirror.net/6/docs/ref/#state.SelectionRange) per line.
*/
declare function rectangularSelection(options?: {
    /**
    A custom predicate function, which takes a `mousedown` event and
    returns true if it should be used for rectangular selection.
    */
    eventFilter?: (event: MouseEvent) => boolean;
}): Extension;

/**
Creates an extension that configures tooltip behavior.
*/
declare function tooltips(config?: {
    /**
    By default, tooltips use `"fixed"`
    [positioning](https://developer.mozilla.org/en-US/docs/Web/CSS/position),
    which has the advantage that tooltips don't get cut off by
    scrollable parent elements. However, CSS rules like `contain:
    layout` can break fixed positioning in child nodes, which can be
    worked about by using `"absolute"` here.
    
    On iOS, which at the time of writing still doesn't properly
    support fixed positioning, the library always uses absolute
    positioning.
    
    If the tooltip parent element sits in a transformed element, the
    library also falls back to absolute positioning.
    */
    position?: "fixed" | "absolute";
    /**
    The element to put the tooltips into. By default, they are put
    in the editor (`cm-editor`) element, and that is usually what
    you want. But in some layouts that can lead to positioning
    issues, and you need to use a different parent to work around
    those.
    */
    parent?: HTMLElement;
    /**
    By default, when figuring out whether there is room for a
    tooltip at a given position, the extension considers the entire
    space between 0,0 and
    `documentElement.clientWidth`/`clientHeight` to be available for
    showing tooltips. You can provide a function here that returns
    an alternative rectangle.
    */
    tooltipSpace?: (view: EditorView) => Rect;
}): Extension;
/**
Describes a tooltip. Values of this type, when provided through
the [`showTooltip`](https://codemirror.net/6/docs/ref/#view.showTooltip) facet, control the
individual tooltips on the editor.
*/
interface Tooltip {
    /**
    The document position at which to show the tooltip.
    */
    pos: number;
    /**
    The end of the range annotated by this tooltip, if different
    from `pos`.
    */
    end?: number;
    /**
    A constructor function that creates the tooltip's [DOM
    representation](https://codemirror.net/6/docs/ref/#view.TooltipView).
    */
    create(view: EditorView): TooltipView;
    /**
    Whether the tooltip should be shown above or below the target
    position. Not guaranteed to be respected for hover tooltips
    since all hover tooltips for the same range are always
    positioned together. Defaults to false.
    */
    above?: boolean;
    /**
    Whether the `above` option should be honored when there isn't
    enough space on that side to show the tooltip inside the
    viewport. Defaults to false.
    */
    strictSide?: boolean;
    /**
    When set to true, show a triangle connecting the tooltip element
    to position `pos`.
    */
    arrow?: boolean;
    /**
    By default, tooltips are hidden when their position is outside
    of the visible editor content. Set this to false to turn that
    off.
    */
    clip?: boolean;
}
/**
Describes the way a tooltip is displayed.
*/
interface TooltipView {
    /**
    The DOM element to position over the editor.
    */
    dom: HTMLElement;
    /**
    Adjust the position of the tooltip relative to its anchor
    position. A positive `x` value will move the tooltip
    horizontally along with the text direction (so right in
    left-to-right context, left in right-to-left). A positive `y`
    will move the tooltip up when it is above its anchor, and down
    otherwise.
    */
    offset?: {
        x: number;
        y: number;
    };
    /**
    By default, a tooltip's screen position will be based on the
    text position of its `pos` property. This method can be provided
    to make the tooltip view itself responsible for finding its
    screen position.
    */
    getCoords?: (pos: number) => Rect;
    /**
    By default, tooltips are moved when they overlap with other
    tooltips. Set this to `true` to disable that behavior for this
    tooltip.
    */
    overlap?: boolean;
    /**
    Called after the tooltip is added to the DOM for the first time.
    */
    mount?(view: EditorView): void;
    /**
    Update the DOM element for a change in the view's state.
    */
    update?(update: ViewUpdate): void;
    /**
    Called when the tooltip is removed from the editor or the editor
    is destroyed.
    */
    destroy?(): void;
    /**
    Called when the tooltip has been (re)positioned. The argument is
    the [space](https://codemirror.net/6/docs/ref/#view.tooltips^config.tooltipSpace) available to the
    tooltip.
    */
    positioned?(space: Rect): void;
    /**
    By default, the library will restrict the size of tooltips so
    that they don't stick out of the available space. Set this to
    false to disable that.
    */
    resize?: boolean;
}
/**
Facet to which an extension can add a value to show a tooltip.
*/
declare const showTooltip: Facet<Tooltip | null, readonly (Tooltip | null)[]>;
type Handlers$1 = {
    [event: string]: (view: EditorView, line: BlockInfo, event: Event) => boolean;
};
interface LineNumberConfig {
    /**
    How to display line numbers. Defaults to simply converting them
    to string.
    */
    formatNumber?: (lineNo: number, state: EditorState) => string;
    /**
    Supply event handlers for DOM events on this gutter.
    */
    domEventHandlers?: Handlers$1;
}
/**
Create a line number gutter extension.
*/
declare function lineNumbers(config?: LineNumberConfig): Extension;

/**
This facet provides a way to register functions that, given a
transaction, provide a set of effects that the history should
store when inverting the transaction. This can be used to
integrate some kinds of effects in the history, so that they can
be undone (and redone again).
*/
declare const invertedEffects: Facet<(tr: Transaction) => readonly StateEffect<any>[], readonly ((tr: Transaction) => readonly StateEffect<any>[])[]>;
interface HistoryConfig {
    /**
    The minimum depth (amount of events) to store. Defaults to 100.
    */
    minDepth?: number;
    /**
    The maximum time (in milliseconds) that adjacent events can be
    apart and still be grouped together. Defaults to 500.
    */
    newGroupDelay?: number;
    /**
    By default, when close enough together in time, changes are
    joined into an existing undo event if they touch any of the
    changed ranges from that event. You can pass a custom predicate
    here to influence that logic.
    */
    joinToEvent?: (tr: Transaction, isAdjacent: boolean) => boolean;
}
/**
Create a history extension with the given configuration.
*/
declare function history(config?: HistoryConfig): Extension;
/**
Default key bindings for the undo history.

- Mod-z: [`undo`](https://codemirror.net/6/docs/ref/#commands.undo).
- Mod-y (Mod-Shift-z on macOS) + Ctrl-Shift-z on Linux: [`redo`](https://codemirror.net/6/docs/ref/#commands.redo).
- Mod-u: [`undoSelection`](https://codemirror.net/6/docs/ref/#commands.undoSelection).
- Alt-u (Mod-Shift-u on macOS): [`redoSelection`](https://codemirror.net/6/docs/ref/#commands.redoSelection).
*/
declare const historyKeymap: readonly KeyBinding[];
/**
Move the selected lines up one line.
*/
declare const moveLineUp: StateCommand;
/**
Move the selected lines down one line.
*/
declare const moveLineDown: StateCommand;
/**
Add a [unit](https://codemirror.net/6/docs/ref/#language.indentUnit) of indentation to all selected
lines.
*/
declare const indentMore: StateCommand;
/**
Remove a [unit](https://codemirror.net/6/docs/ref/#language.indentUnit) of indentation from all
selected lines.
*/
declare const indentLess: StateCommand;
/**
The default keymap. Includes all bindings from
[`standardKeymap`](https://codemirror.net/6/docs/ref/#commands.standardKeymap) plus the following:

- Alt-ArrowLeft (Ctrl-ArrowLeft on macOS): [`cursorSyntaxLeft`](https://codemirror.net/6/docs/ref/#commands.cursorSyntaxLeft) ([`selectSyntaxLeft`](https://codemirror.net/6/docs/ref/#commands.selectSyntaxLeft) with Shift)
- Alt-ArrowRight (Ctrl-ArrowRight on macOS): [`cursorSyntaxRight`](https://codemirror.net/6/docs/ref/#commands.cursorSyntaxRight) ([`selectSyntaxRight`](https://codemirror.net/6/docs/ref/#commands.selectSyntaxRight) with Shift)
- Alt-ArrowUp: [`moveLineUp`](https://codemirror.net/6/docs/ref/#commands.moveLineUp)
- Alt-ArrowDown: [`moveLineDown`](https://codemirror.net/6/docs/ref/#commands.moveLineDown)
- Shift-Alt-ArrowUp: [`copyLineUp`](https://codemirror.net/6/docs/ref/#commands.copyLineUp)
- Shift-Alt-ArrowDown: [`copyLineDown`](https://codemirror.net/6/docs/ref/#commands.copyLineDown)
- Ctrl-Alt-ArrowUp (Cmd-Alt-ArrowUp on macOS): [`addCursorAbove`](https://codemirror.net/6/docs/ref/#commands.addCursorAbove).
- Ctrl-Alt-ArrowDown (Cmd-Alt-ArrowDown on macOS): [`addCursorBelow`](https://codemirror.net/6/docs/ref/#commands.addCursorBelow).
- Escape: [`simplifySelection`](https://codemirror.net/6/docs/ref/#commands.simplifySelection)
- Ctrl-Enter (Cmd-Enter on macOS): [`insertBlankLine`](https://codemirror.net/6/docs/ref/#commands.insertBlankLine)
- Alt-l (Ctrl-l on macOS): [`selectLine`](https://codemirror.net/6/docs/ref/#commands.selectLine)
- Ctrl-i (Cmd-i on macOS): [`selectParentSyntax`](https://codemirror.net/6/docs/ref/#commands.selectParentSyntax)
- Ctrl-[ (Cmd-[ on macOS): [`indentLess`](https://codemirror.net/6/docs/ref/#commands.indentLess)
- Ctrl-] (Cmd-] on macOS): [`indentMore`](https://codemirror.net/6/docs/ref/#commands.indentMore)
- Ctrl-Alt-\\ (Cmd-Alt-\\ on macOS): [`indentSelection`](https://codemirror.net/6/docs/ref/#commands.indentSelection)
- Shift-Ctrl-k (Shift-Cmd-k on macOS): [`deleteLine`](https://codemirror.net/6/docs/ref/#commands.deleteLine)
- Shift-Ctrl-\\ (Shift-Cmd-\\ on macOS): [`cursorMatchingBracket`](https://codemirror.net/6/docs/ref/#commands.cursorMatchingBracket)
- Ctrl-/ (Cmd-/ on macOS): [`toggleComment`](https://codemirror.net/6/docs/ref/#commands.toggleComment).
- Shift-Alt-a: [`toggleBlockComment`](https://codemirror.net/6/docs/ref/#commands.toggleBlockComment).
- Ctrl-m (Alt-Shift-m on macOS): [`toggleTabFocusMode`](https://codemirror.net/6/docs/ref/#commands.toggleTabFocusMode).
*/
declare const defaultKeymap: readonly KeyBinding[];

/**
The [`TreeFragment.applyChanges`](#common.TreeFragment^applyChanges)
method expects changed ranges in this format.
*/
interface ChangedRange {
    /**
    The start of the change in the start document
    */
    fromA: number;
    /**
    The end of the change in the start document
    */
    toA: number;
    /**
    The start of the replacement in the new document
    */
    fromB: number;
    /**
    The end of the replacement in the new document
    */
    toB: number;
}
/**
Tree fragments are used during [incremental
parsing](#common.Parser.startParse) to track parts of old trees
that can be reused in a new parse. An array of fragments is used
to track regions of an old tree whose nodes might be reused in new
parses. Use the static
[`applyChanges`](#common.TreeFragment^applyChanges) method to
update fragments for document changes.
*/
declare class TreeFragment {
    /**
    The start of the unchanged range pointed to by this fragment.
    This refers to an offset in the _updated_ document (as opposed
    to the original tree).
    */
    readonly from: number;
    /**
    The end of the unchanged range.
    */
    readonly to: number;
    /**
    The tree that this fragment is based on.
    */
    readonly tree: Tree;
    /**
    The offset between the fragment's tree and the document that
    this fragment can be used against. Add this when going from
    document to tree positions, subtract it to go from tree to
    document positions.
    */
    readonly offset: number;
    /**
    Construct a tree fragment. You'll usually want to use
    [`addTree`](#common.TreeFragment^addTree) and
    [`applyChanges`](#common.TreeFragment^applyChanges) instead of
    calling this directly.
    */
    constructor(
    /**
    The start of the unchanged range pointed to by this fragment.
    This refers to an offset in the _updated_ document (as opposed
    to the original tree).
    */
    from: number, 
    /**
    The end of the unchanged range.
    */
    to: number, 
    /**
    The tree that this fragment is based on.
    */
    tree: Tree, 
    /**
    The offset between the fragment's tree and the document that
    this fragment can be used against. Add this when going from
    document to tree positions, subtract it to go from tree to
    document positions.
    */
    offset: number, openStart?: boolean, openEnd?: boolean);
    /**
    Whether the start of the fragment represents the start of a
    parse, or the end of a change. (In the second case, it may not
    be safe to reuse some nodes at the start, depending on the
    parsing algorithm.)
    */
    get openStart(): boolean;
    /**
    Whether the end of the fragment represents the end of a
    full-document parse, or the start of a change.
    */
    get openEnd(): boolean;
    /**
    Create a set of fragments from a freshly parsed tree, or update
    an existing set of fragments by replacing the ones that overlap
    with a tree with content from the new tree. When `partial` is
    true, the parse is treated as incomplete, and the resulting
    fragment has [`openEnd`](#common.TreeFragment.openEnd) set to
    true.
    */
    static addTree(tree: Tree, fragments?: readonly TreeFragment[], partial?: boolean): readonly TreeFragment[];
    /**
    Apply a set of edits to an array of fragments, removing or
    splitting fragments as necessary to remove edited ranges, and
    adjusting offsets for fragments that moved.
    */
    static applyChanges(fragments: readonly TreeFragment[], changes: readonly ChangedRange[], minGap?: number): readonly TreeFragment[];
}
/**
Interface used to represent an in-progress parse, which can be
moved forward piece-by-piece.
*/
interface PartialParse {
    /**
    Advance the parse state by some amount. Will return the finished
    syntax tree when the parse completes.
    */
    advance(): Tree | null;
    /**
    The position up to which the document has been parsed. Note
    that, in multi-pass parsers, this will stay back until the last
    pass has moved past a given position.
    */
    readonly parsedPos: number;
    /**
    Tell the parse to not advance beyond the given position.
    `advance` will return a tree when the parse has reached the
    position. Note that, depending on the parser algorithm and the
    state of the parse when `stopAt` was called, that tree may
    contain nodes beyond the position. It is an error to call
    `stopAt` with a higher position than it's [current
    value](#common.PartialParse.stoppedAt).
    */
    stopAt(pos: number): void;
    /**
    Reports whether `stopAt` has been called on this parse.
    */
    readonly stoppedAt: number | null;
}
/**
A superclass that parsers should extend.
*/
declare abstract class Parser {
    /**
    Start a parse for a single tree. This is the method concrete
    parser implementations must implement. Called by `startParse`,
    with the optional arguments resolved.
    */
    abstract createParse(input: Input, fragments: readonly TreeFragment[], ranges: readonly {
        from: number;
        to: number;
    }[]): PartialParse;
    /**
    Start a parse, returning a [partial parse](#common.PartialParse)
    object. [`fragments`](#common.TreeFragment) can be passed in to
    make the parse incremental.
    
    By default, the entire input is parsed. You can pass `ranges`,
    which should be a sorted array of non-empty, non-overlapping
    ranges, to parse only those ranges. The tree returned in that
    case will start at `ranges[0].from`.
    */
    startParse(input: Input | string, fragments?: readonly TreeFragment[], ranges?: readonly {
        from: number;
        to: number;
    }[]): PartialParse;
    /**
    Run a full parse, returning the resulting tree.
    */
    parse(input: Input | string, fragments?: readonly TreeFragment[], ranges?: readonly {
        from: number;
        to: number;
    }[]): Tree;
}
/**
This is the interface parsers use to access the document. To run
Lezer directly on your own document data structure, you have to
write an implementation of it.
*/
interface Input {
    /**
    The length of the document.
    */
    readonly length: number;
    /**
    Get the chunk after the given position. The returned string
    should start at `from` and, if that isn't the end of the
    document, may be of any length greater than zero.
    */
    chunk(from: number): string;
    /**
    Indicates whether the chunks already end at line breaks, so that
    client code that wants to work by-line can avoid re-scanning
    them for line breaks. When this is true, the result of `chunk()`
    should either be a single line break, or the content between
    `from` and the next line break.
    */
    readonly lineChunks: boolean;
    /**
    Read the part of the document between the given positions.
    */
    read(from: number, to: number): string;
}
/**
Parse wrapper functions are supported by some parsers to inject
additional parsing logic.
*/
type ParseWrapper = (inner: PartialParse, input: Input, fragments: readonly TreeFragment[], ranges: readonly {
    from: number;
    to: number;
}[]) => PartialParse;
/**
Each [node type](#common.NodeType) or [individual tree](#common.Tree)
can have metadata associated with it in props. Instances of this
class represent prop names.
*/
declare class NodeProp<T> {
    /**
    Indicates whether this prop is stored per [node
    type](#common.NodeType) or per [tree node](#common.Tree).
    */
    perNode: boolean;
    /**
    A method that deserializes a value of this prop from a string.
    Can be used to allow a prop to be directly written in a grammar
    file.
    */
    deserialize: (str: string) => T;
    /**
    Create a new node prop type.
    */
    constructor(config?: {
        /**
        The [deserialize](#common.NodeProp.deserialize) function to
        use for this prop, used for example when directly providing
        the prop from a grammar file. Defaults to a function that
        raises an error.
        */
        deserialize?: (str: string) => T;
        /**
        If configuring another value for this prop when it already
        exists on a node should combine the old and new values, rather
        than overwrite the old value, you can pass a function that
        does the combining here.
        */
        combine?: (a: T, b: T) => T;
        /**
        By default, node props are stored in the [node
        type](#common.NodeType). It can sometimes be useful to directly
        store information (usually related to the parsing algorithm)
        in [nodes](#common.Tree) themselves. Set this to true to enable
        that for this prop.
        */
        perNode?: boolean;
    });
    /**
    This is meant to be used with
    [`NodeSet.extend`](#common.NodeSet.extend) or
    [`LRParser.configure`](#lr.ParserConfig.props) to compute
    prop values for each node type in the set. Takes a [match
    object](#common.NodeType^match) or function that returns undefined
    if the node type doesn't get this prop, and the prop's value if
    it does.
    */
    add(match: {
        [selector: string]: T;
    } | ((type: NodeType) => T | undefined)): NodePropSource;
    /**
    Prop that is used to describe matching delimiters. For opening
    delimiters, this holds an array of node names (written as a
    space-separated string when declaring this prop in a grammar)
    for the node types of closing delimiters that match it.
    */
    static closedBy: NodeProp<readonly string[]>;
    /**
    The inverse of [`closedBy`](#common.NodeProp^closedBy). This is
    attached to closing delimiters, holding an array of node names
    of types of matching opening delimiters.
    */
    static openedBy: NodeProp<readonly string[]>;
    /**
    Used to assign node types to groups (for example, all node
    types that represent an expression could be tagged with an
    `"Expression"` group).
    */
    static group: NodeProp<readonly string[]>;
    /**
    Attached to nodes to indicate these should be
    [displayed](https://codemirror.net/docs/ref/#language.syntaxTree)
    in a bidirectional text isolate, so that direction-neutral
    characters on their sides don't incorrectly get associated with
    surrounding text. You'll generally want to set this for nodes
    that contain arbitrary text, like strings and comments, and for
    nodes that appear _inside_ arbitrary text, like HTML tags. When
    not given a value, in a grammar declaration, defaults to
    `"auto"`.
    */
    static isolate: NodeProp<"rtl" | "ltr" | "auto">;
    /**
    The hash of the [context](#lr.ContextTracker.constructor)
    that the node was parsed in, if any. Used to limit reuse of
    contextual nodes.
    */
    static contextHash: NodeProp<number>;
    /**
    The distance beyond the end of the node that the tokenizer
    looked ahead for any of the tokens inside the node. (The LR
    parser only stores this when it is larger than 25, for
    efficiency reasons.)
    */
    static lookAhead: NodeProp<number>;
    /**
    This per-node prop is used to replace a given node, or part of a
    node, with another tree. This is useful to include trees from
    different languages in mixed-language parsers.
    */
    static mounted: NodeProp<MountedTree>;
}
/**
A mounted tree, which can be [stored](#common.NodeProp^mounted) on
a tree node to indicate that parts of its content are
represented by another tree.
*/
declare class MountedTree {
    /**
    The inner tree.
    */
    readonly tree: Tree;
    /**
    If this is null, this tree replaces the entire node (it will
    be included in the regular iteration instead of its host
    node). If not, only the given ranges are considered to be
    covered by this tree. This is used for trees that are mixed in
    a way that isn't strictly hierarchical. Such mounted trees are
    only entered by [`resolveInner`](#common.Tree.resolveInner)
    and [`enter`](#common.SyntaxNode.enter).
    */
    readonly overlay: readonly {
        from: number;
        to: number;
    }[] | null;
    /**
    The parser used to create this subtree.
    */
    readonly parser: Parser;
    /**
    [Indicates](#common.IterMode.EnterBracketed) that the nested
    content is delineated with some kind
    of bracket token.
    */
    readonly bracketed: boolean;
    constructor(
    /**
    The inner tree.
    */
    tree: Tree, 
    /**
    If this is null, this tree replaces the entire node (it will
    be included in the regular iteration instead of its host
    node). If not, only the given ranges are considered to be
    covered by this tree. This is used for trees that are mixed in
    a way that isn't strictly hierarchical. Such mounted trees are
    only entered by [`resolveInner`](#common.Tree.resolveInner)
    and [`enter`](#common.SyntaxNode.enter).
    */
    overlay: readonly {
        from: number;
        to: number;
    }[] | null, 
    /**
    The parser used to create this subtree.
    */
    parser: Parser, 
    /**
    [Indicates](#common.IterMode.EnterBracketed) that the nested
    content is delineated with some kind
    of bracket token.
    */
    bracketed?: boolean);
}
/**
Type returned by [`NodeProp.add`](#common.NodeProp.add). Describes
whether a prop should be added to a given node type in a node set,
and what value it should have.
*/
type NodePropSource = (type: NodeType) => null | [NodeProp<any>, any];
/**
Each node in a syntax tree has a node type associated with it.
*/
declare class NodeType {
    /**
    The name of the node type. Not necessarily unique, but if the
    grammar was written properly, different node types with the
    same name within a node set should play the same semantic
    role.
    */
    readonly name: string;
    /**
    The id of this node in its set. Corresponds to the term ids
    used in the parser.
    */
    readonly id: number;
    /**
    Define a node type.
    */
    static define(spec: {
        /**
        The ID of the node type. When this type is used in a
        [set](#common.NodeSet), the ID must correspond to its index in
        the type array.
        */
        id: number;
        /**
        The name of the node type. Leave empty to define an anonymous
        node.
        */
        name?: string;
        /**
        [Node props](#common.NodeProp) to assign to the type. The value
        given for any given prop should correspond to the prop's type.
        */
        props?: readonly ([NodeProp<any>, any] | NodePropSource)[];
        /**
        Whether this is a [top node](#common.NodeType.isTop).
        */
        top?: boolean;
        /**
        Whether this node counts as an [error
        node](#common.NodeType.isError).
        */
        error?: boolean;
        /**
        Whether this node is a [skipped](#common.NodeType.isSkipped)
        node.
        */
        skipped?: boolean;
    }): NodeType;
    /**
    Retrieves a node prop for this type. Will return `undefined` if
    the prop isn't present on this node.
    */
    prop<T>(prop: NodeProp<T>): T | undefined;
    /**
    True when this is the top node of a grammar.
    */
    get isTop(): boolean;
    /**
    True when this node is produced by a skip rule.
    */
    get isSkipped(): boolean;
    /**
    Indicates whether this is an error node.
    */
    get isError(): boolean;
    /**
    When true, this node type doesn't correspond to a user-declared
    named node, for example because it is used to cache repetition.
    */
    get isAnonymous(): boolean;
    /**
    Returns true when this node's name or one of its
    [groups](#common.NodeProp^group) matches the given string.
    */
    is(name: string | number): boolean;
    /**
    An empty dummy node type to use when no actual type is available.
    */
    static none: NodeType;
    /**
    Create a function from node types to arbitrary values by
    specifying an object whose property names are node or
    [group](#common.NodeProp^group) names. Often useful with
    [`NodeProp.add`](#common.NodeProp.add). You can put multiple
    names, separated by spaces, in a single property name to map
    multiple node names to a single value.
    */
    static match<T>(map: {
        [selector: string]: T;
    }): (node: NodeType) => T | undefined;
}
/**
A node set holds a collection of node types. It is used to
compactly represent trees by storing their type ids, rather than a
full pointer to the type object, in a numeric array. Each parser
[has](#lr.LRParser.nodeSet) a node set, and [tree
buffers](#common.TreeBuffer) can only store collections of nodes
from the same set. A set can have a maximum of 2**16 (65536) node
types in it, so that the ids fit into 16-bit typed array slots.
*/
declare class NodeSet {
    /**
    The node types in this set, by id.
    */
    readonly types: readonly NodeType[];
    /**
    Create a set with the given types. The `id` property of each
    type should correspond to its position within the array.
    */
    constructor(
    /**
    The node types in this set, by id.
    */
    types: readonly NodeType[]);
    /**
    Create a copy of this set with some node properties added. The
    arguments to this method can be created with
    [`NodeProp.add`](#common.NodeProp.add).
    */
    extend(...props: NodePropSource[]): NodeSet;
}
/**
Options that control iteration. Can be combined with the `|`
operator to enable multiple ones.
*/
declare enum IterMode {
    /**
    When enabled, iteration will only visit [`Tree`](#common.Tree)
    objects, not nodes packed into
    [`TreeBuffer`](#common.TreeBuffer)s.
    */
    ExcludeBuffers = 1,
    /**
    Enable this to make iteration include anonymous nodes (such as
    the nodes that wrap repeated grammar constructs into a balanced
    tree).
    */
    IncludeAnonymous = 2,
    /**
    By default, regular [mounted](#common.NodeProp^mounted) nodes
    replace their base node in iteration. Enable this to ignore them
    instead.
    */
    IgnoreMounts = 4,
    /**
    This option only applies in
    [`enter`](#common.SyntaxNode.enter)-style methods. It tells the
    library to not enter mounted overlays if one covers the given
    position.
    */
    IgnoreOverlays = 8,
    /**
    When set, positions on the boundary of a mounted overlay tree
    that has its [`bracketed`](#common.NestedParse.bracketed) flag
    set will enter that tree regardless of side. Only supported in
    [`enter`](#common.SyntaxNode.enter), not in cursors.
    */
    EnterBracketed = 16
}
/**
A piece of syntax tree. There are two ways to approach these
trees: the way they are actually stored in memory, and the
convenient way.

Syntax trees are stored as a tree of `Tree` and `TreeBuffer`
objects. By packing detail information into `TreeBuffer` leaf
nodes, the representation is made a lot more memory-efficient.

However, when you want to actually work with tree nodes, this
representation is very awkward, so most client code will want to
use the [`TreeCursor`](#common.TreeCursor) or
[`SyntaxNode`](#common.SyntaxNode) interface instead, which provides
a view on some part of this data structure, and can be used to
move around to adjacent nodes.
*/
declare class Tree {
    /**
    The type of the top node.
    */
    readonly type: NodeType;
    /**
    This node's child nodes.
    */
    readonly children: readonly (Tree | TreeBuffer)[];
    /**
    The positions (offsets relative to the start of this tree) of
    the children.
    */
    readonly positions: readonly number[];
    /**
    The total length of this tree
    */
    readonly length: number;
    /**
    Construct a new tree. See also [`Tree.build`](#common.Tree^build).
    */
    constructor(
    /**
    The type of the top node.
    */
    type: NodeType, 
    /**
    This node's child nodes.
    */
    children: readonly (Tree | TreeBuffer)[], 
    /**
    The positions (offsets relative to the start of this tree) of
    the children.
    */
    positions: readonly number[], 
    /**
    The total length of this tree
    */
    length: number, 
    /**
    Per-node [node props](#common.NodeProp) to associate with this node.
    */
    props?: readonly [NodeProp<any> | number, any][]);
    /**
    The empty tree
    */
    static empty: Tree;
    /**
    Get a [tree cursor](#common.TreeCursor) positioned at the top of
    the tree. Mode can be used to [control](#common.IterMode) which
    nodes the cursor visits.
    */
    cursor(mode?: IterMode): TreeCursor;
    /**
    Get a [tree cursor](#common.TreeCursor) pointing into this tree
    at the given position and side (see
    [`moveTo`](#common.TreeCursor.moveTo).
    */
    cursorAt(pos: number, side?: -1 | 0 | 1, mode?: IterMode): TreeCursor;
    /**
    Get a [syntax node](#common.SyntaxNode) object for the top of the
    tree.
    */
    get topNode(): SyntaxNode;
    /**
    Get the [syntax node](#common.SyntaxNode) at the given position.
    If `side` is -1, this will move into nodes that end at the
    position. If 1, it'll move into nodes that start at the
    position. With 0, it'll only enter nodes that cover the position
    from both sides.
    
    Note that this will not enter
    [overlays](#common.MountedTree.overlay), and you often want
    [`resolveInner`](#common.Tree.resolveInner) instead.
    */
    resolve(pos: number, side?: -1 | 0 | 1): SyntaxNode;
    /**
    Like [`resolve`](#common.Tree.resolve), but will enter
    [overlaid](#common.MountedTree.overlay) nodes, producing a syntax node
    pointing into the innermost overlaid tree at the given position
    (with parent links going through all parent structure, including
    the host trees).
    */
    resolveInner(pos: number, side?: -1 | 0 | 1): SyntaxNode;
    /**
    In some situations, it can be useful to iterate through all
    nodes around a position, including those in overlays that don't
    directly cover the position. This method gives you an iterator
    that will produce all nodes, from small to big, around the given
    position.
    */
    resolveStack(pos: number, side?: -1 | 0 | 1): NodeIterator;
    /**
    Iterate over the tree and its children, calling `enter` for any
    node that touches the `from`/`to` region (if given) before
    running over such a node's children, and `leave` (if given) when
    leaving the node. When `enter` returns `false`, that node will
    not have its children iterated over (or `leave` called).
    */
    iterate(spec: {
        enter(node: SyntaxNodeRef): boolean | void;
        leave?(node: SyntaxNodeRef): void;
        from?: number;
        to?: number;
        mode?: IterMode;
    }): void;
    /**
    Get the value of the given [node prop](#common.NodeProp) for this
    node. Works with both per-node and per-type props.
    */
    prop<T>(prop: NodeProp<T>): T | undefined;
    /**
    Returns the node's [per-node props](#common.NodeProp.perNode) in a
    format that can be passed to the [`Tree`](#common.Tree)
    constructor.
    */
    get propValues(): readonly [NodeProp<any> | number, any][];
    /**
    Balance the direct children of this tree, producing a copy of
    which may have children grouped into subtrees with type
    [`NodeType.none`](#common.NodeType^none).
    */
    balance(config?: {
        /**
        Function to create the newly balanced subtrees.
        */
        makeTree?: (children: readonly (Tree | TreeBuffer)[], positions: readonly number[], length: number) => Tree;
    }): Tree;
    /**
    Build a tree from a postfix-ordered buffer of node information,
    or a cursor over such a buffer.
    */
    static build(data: BuildData): Tree;
}
/**
Represents a sequence of nodes.
*/
type NodeIterator = {
    node: SyntaxNode;
    next: NodeIterator | null;
};
type BuildData = {
    /**
    The buffer or buffer cursor to read the node data from.
    
    When this is an array, it should contain four values for every
    node in the tree.
    
     - The first holds the node's type, as a node ID pointing into
       the given `NodeSet`.
     - The second holds the node's start offset.
     - The third the end offset.
     - The fourth the amount of space taken up in the array by this
       node and its children. Since there's four values per node,
       this is the total number of nodes inside this node (children
       and transitive children) plus one for the node itself, times
       four.
    
    Parent nodes should appear _after_ child nodes in the array. As
    an example, a node of type 10 spanning positions 0 to 4, with
    two children, of type 11 and 12, might look like this:
    
        [11, 0, 1, 4, 12, 2, 4, 4, 10, 0, 4, 12]
    */
    buffer: BufferCursor | readonly number[];
    /**
    The node types to use.
    */
    nodeSet: NodeSet;
    /**
    The id of the top node type.
    */
    topID: number;
    /**
    The position the tree should start at. Defaults to 0.
    */
    start?: number;
    /**
    The position in the buffer where the function should stop
    reading. Defaults to 0.
    */
    bufferStart?: number;
    /**
    The length of the wrapping node. The end offset of the last
    child is used when not provided.
    */
    length?: number;
    /**
    The maximum buffer length to use. Defaults to
    [`DefaultBufferLength`](#common.DefaultBufferLength).
    */
    maxBufferLength?: number;
    /**
    An optional array holding reused nodes that the buffer can refer
    to.
    */
    reused?: readonly Tree[];
    /**
    The first node type that indicates repeat constructs in this
    grammar.
    */
    minRepeatType?: number;
};
/**
This is used by `Tree.build` as an abstraction for iterating over
a tree buffer. A cursor initially points at the very last element
in the buffer. Every time `next()` is called it moves on to the
previous one.
*/
interface BufferCursor {
    /**
    The current buffer position (four times the number of nodes
    remaining).
    */
    pos: number;
    /**
    The node ID of the next node in the buffer.
    */
    id: number;
    /**
    The start position of the next node in the buffer.
    */
    start: number;
    /**
    The end position of the next node.
    */
    end: number;
    /**
    The size of the next node (the number of nodes inside, counting
    the node itself, times 4).
    */
    size: number;
    /**
    Moves `this.pos` down by 4.
    */
    next(): void;
    /**
    Create a copy of this cursor.
    */
    fork(): BufferCursor;
}
/**
Tree buffers contain (type, start, end, endIndex) quads for each
node. In such a buffer, nodes are stored in prefix order (parents
before children, with the endIndex of the parent indicating which
children belong to it).
*/
declare class TreeBuffer {
    /**
    The buffer's content.
    */
    readonly buffer: Uint16Array;
    /**
    The total length of the group of nodes in the buffer.
    */
    readonly length: number;
    /**
    The node set used in this buffer.
    */
    readonly set: NodeSet;
    /**
    Create a tree buffer.
    */
    constructor(
    /**
    The buffer's content.
    */
    buffer: Uint16Array, 
    /**
    The total length of the group of nodes in the buffer.
    */
    length: number, 
    /**
    The node set used in this buffer.
    */
    set: NodeSet);
}
/**
The set of properties provided by both [`SyntaxNode`](#common.SyntaxNode)
and [`TreeCursor`](#common.TreeCursor). Note that, if you need
an object that is guaranteed to stay stable in the future, you
need to use the [`node`](#common.SyntaxNodeRef.node) accessor.
*/
interface SyntaxNodeRef {
    /**
    The start position of the node.
    */
    readonly from: number;
    /**
    The end position of the node.
    */
    readonly to: number;
    /**
    The type of the node.
    */
    readonly type: NodeType;
    /**
    The name of the node (`.type.name`).
    */
    readonly name: string;
    /**
    Get the [tree](#common.Tree) that represents the current node,
    if any. Will return null when the node is in a [tree
    buffer](#common.TreeBuffer).
    */
    readonly tree: Tree | null;
    /**
    Retrieve a stable [syntax node](#common.SyntaxNode) at this
    position.
    */
    readonly node: SyntaxNode;
    /**
    Test whether the node matches a given context—a sequence of
    direct parent nodes. Empty strings in the context array act as
    wildcards, other strings must match the ancestor node's name.
    */
    matchContext(context: readonly string[]): boolean;
}
/**
A syntax node provides an immutable pointer to a given node in a
tree. When iterating over large amounts of nodes, you may want to
use a mutable [cursor](#common.TreeCursor) instead, which is more
efficient.
*/
interface SyntaxNode extends SyntaxNodeRef {
    /**
    The node's parent node, if any.
    */
    parent: SyntaxNode | null;
    /**
    The first child, if the node has children.
    */
    firstChild: SyntaxNode | null;
    /**
    The node's last child, if available.
    */
    lastChild: SyntaxNode | null;
    /**
    The first child that ends after `pos`.
    */
    childAfter(pos: number): SyntaxNode | null;
    /**
    The last child that starts before `pos`.
    */
    childBefore(pos: number): SyntaxNode | null;
    /**
    Enter the child at the given position. If side is -1 the child
    may end at that position, when 1 it may start there.
    
    This will by default enter
    [overlaid](#common.MountedTree.overlay)
    [mounted](#common.NodeProp^mounted) trees. You can set
    `overlays` to false to disable that.
    
    Similarly, when `buffers` is false this will not enter
    [buffers](#common.TreeBuffer), only [nodes](#common.Tree) (which
    is mostly useful when looking for props, which cannot exist on
    buffer-allocated nodes).
    */
    enter(pos: number, side: -1 | 0 | 1, mode?: IterMode): SyntaxNode | null;
    /**
    This node's next sibling, if any.
    */
    nextSibling: SyntaxNode | null;
    /**
    This node's previous sibling.
    */
    prevSibling: SyntaxNode | null;
    /**
    Read the given node prop from this node.
    */
    prop<T>(prop: NodeProp<T>): T | undefined;
    /**
    A [tree cursor](#common.TreeCursor) starting at this node.
    */
    cursor(mode?: IterMode): TreeCursor;
    /**
    Find the node around, before (if `side` is -1), or after (`side`
    is 1) the given position. Will look in parent nodes if the
    position is outside this node.
    */
    resolve(pos: number, side?: -1 | 0 | 1): SyntaxNode;
    /**
    Similar to `resolve`, but enter
    [overlaid](#common.MountedTree.overlay) nodes.
    */
    resolveInner(pos: number, side?: -1 | 0 | 1): SyntaxNode;
    /**
    Move the position to the innermost node before `pos` that looks
    like it is unfinished (meaning it ends in an error node or has a
    child ending in an error node right at its end).
    */
    enterUnfinishedNodesBefore(pos: number): SyntaxNode;
    /**
    Get a [tree](#common.Tree) for this node. Will allocate one if it
    points into a buffer.
    */
    toTree(): Tree;
    /**
    Get the first child of the given type (which may be a [node
    name](#common.NodeType.name) or a [group
    name](#common.NodeProp^group)). If `before` is non-null, only
    return children that occur somewhere after a node with that name
    or group. If `after` is non-null, only return children that
    occur somewhere before a node with that name or group.
    */
    getChild(type: string | number, before?: string | number | null, after?: string | number | null): SyntaxNode | null;
    /**
    Like [`getChild`](#common.SyntaxNode.getChild), but return all
    matching children, not just the first.
    */
    getChildren(type: string | number, before?: string | number | null, after?: string | number | null): SyntaxNode[];
}
/**
A tree cursor object focuses on a given node in a syntax tree, and
allows you to move to adjacent nodes.
*/
declare class TreeCursor implements SyntaxNodeRef {
    /**
    The node's type.
    */
    type: NodeType;
    /**
    Shorthand for `.type.name`.
    */
    get name(): string;
    /**
    The start source offset of this node.
    */
    from: number;
    /**
    The end source offset.
    */
    to: number;
    private stack;
    private bufferNode;
    private yieldNode;
    private yieldBuf;
    /**
    Move the cursor to this node's first child. When this returns
    false, the node has no child, and the cursor has not been moved.
    */
    firstChild(): boolean;
    /**
    Move the cursor to this node's last child.
    */
    lastChild(): boolean;
    /**
    Move the cursor to the first child that ends after `pos`.
    */
    childAfter(pos: number): boolean;
    /**
    Move to the last child that starts before `pos`.
    */
    childBefore(pos: number): boolean;
    /**
    Move the cursor to the child around `pos`. If side is -1 the
    child may end at that position, when 1 it may start there. This
    will also enter [overlaid](#common.MountedTree.overlay)
    [mounted](#common.NodeProp^mounted) trees unless `overlays` is
    set to false.
    */
    enter(pos: number, side: -1 | 0 | 1, mode?: IterMode): boolean;
    /**
    Move to the node's parent node, if this isn't the top node.
    */
    parent(): boolean;
    /**
    Move to this node's next sibling, if any.
    */
    nextSibling(): boolean;
    /**
    Move to this node's previous sibling, if any.
    */
    prevSibling(): boolean;
    private atLastNode;
    private move;
    /**
    Move to the next node in a
    [pre-order](https://en.wikipedia.org/wiki/Tree_traversal#Pre-order,_NLR)
    traversal, going from a node to its first child or, if the
    current node is empty or `enter` is false, its next sibling or
    the next sibling of the first parent node that has one.
    */
    next(enter?: boolean): boolean;
    /**
    Move to the next node in a last-to-first pre-order traversal. A
    node is followed by its last child or, if it has none, its
    previous sibling or the previous sibling of the first parent
    node that has one.
    */
    prev(enter?: boolean): boolean;
    /**
    Move the cursor to the innermost node that covers `pos`. If
    `side` is -1, it will enter nodes that end at `pos`. If it is 1,
    it will enter nodes that start at `pos`.
    */
    moveTo(pos: number, side?: -1 | 0 | 1): this;
    /**
    Get a [syntax node](#common.SyntaxNode) at the cursor's current
    position.
    */
    get node(): SyntaxNode;
    /**
    Get the [tree](#common.Tree) that represents the current node, if
    any. Will return null when the node is in a [tree
    buffer](#common.TreeBuffer).
    */
    get tree(): Tree | null;
    /**
    Iterate over the current node and all its descendants, calling
    `enter` when entering a node and `leave`, if given, when leaving
    one. When `enter` returns `false`, any children of that node are
    skipped, and `leave` isn't called for it.
    */
    iterate(enter: (node: SyntaxNodeRef) => boolean | void, leave?: (node: SyntaxNodeRef) => void): void;
    /**
    Test whether the current node matches a given context—a sequence
    of direct parent node names. Empty strings in the context array
    are treated as wildcards.
    */
    matchContext(context: readonly string[]): boolean;
}
/**
Provides a way to associate values with pieces of trees. As long
as that part of the tree is reused, the associated values can be
retrieved from an updated tree.
*/
declare class NodeWeakMap<T> {
    private map;
    private setBuffer;
    private getBuffer;
    /**
    Set the value for this syntax node.
    */
    set(node: SyntaxNode, value: T): void;
    /**
    Retrieve value for this syntax node, if it exists in the map.
    */
    get(node: SyntaxNode): T | undefined;
    /**
    Set the value for the node that a cursor currently points to.
    */
    cursorSet(cursor: TreeCursor, value: T): void;
    /**
    Retrieve the value for the node that a cursor currently points
    to.
    */
    cursorGet(cursor: TreeCursor): T | undefined;
}

/**
Objects returned by the function passed to
[`parseMixed`](#common.parseMixed) should conform to this
interface.
*/
interface NestedParse {
    /**
    The parser to use for the inner region.
    */
    parser: Parser;
    /**
    When this property is not given, the entire node is parsed with
    this parser, and it is [mounted](#common.NodeProp^mounted) as a
    non-overlay node, replacing its host node in tree iteration.
    
    When an array of ranges is given, only those ranges are parsed,
    and the tree is mounted as an
    [overlay](#common.MountedTree.overlay).
    
    When a function is given, that function will be called for
    descendant nodes of the target node, not including child nodes
    that are covered by another nested parse, to determine the
    overlay ranges. When it returns true, the entire descendant is
    included, otherwise just the range given. The mixed parser will
    optimize range-finding in reused nodes, which means it's a good
    idea to use a function here when the target node is expected to
    have a large, deep structure.
    */
    overlay?: readonly {
        from: number;
        to: number;
    }[] | ((node: SyntaxNodeRef) => {
        from: number;
        to: number;
    } | boolean);
    /**
    When `true`, indicates that this nested language is surrounded
    by some kind of bracket token, which can be used to make
    iteration [eagerly](#common.IterMode.EnterBracketed) enter such
    trees.
    */
    bracketed?: boolean;
}
/**
Create a parse wrapper that, after the inner parse completes,
scans its tree for mixed language regions with the `nest`
function, runs the resulting [inner parses](#common.NestedParse),
and then [mounts](#common.NodeProp^mounted) their results onto the
tree.
*/
declare function parseMixed(nest: (node: SyntaxNodeRef, input: Input) => NestedParse | null): ParseWrapper;

/**
A parse stack. These are used internally by the parser to track
parsing progress. They also provide some properties and methods
that external code such as a tokenizer can use to get information
about the parse state.
*/
declare class Stack {
    /**
    The input position up to which this stack has parsed.
    */
    pos: number;
    /**
    The stack's current [context](#lr.ContextTracker) value, if
    any. Its type will depend on the context tracker's type
    parameter, or it will be `null` if there is no context
    tracker.
    */
    get context(): any;
    /**
    Check if the given term would be able to be shifted (optionally
    after some reductions) on this stack. This can be useful for
    external tokenizers that want to make sure they only provide a
    given token when it applies.
    */
    canShift(term: number): boolean;
    /**
    Get the parser used by this stack.
    */
    get parser(): LRParser;
    /**
    Test whether a given dialect (by numeric ID, as exported from
    the terms file) is enabled.
    */
    dialectEnabled(dialectID: number): boolean;
    private shiftContext;
    private reduceContext;
    private updateContext;
}

/**
[Tokenizers](#lr.ExternalTokenizer) interact with the input
through this interface. It presents the input as a stream of
characters, tracking lookahead and hiding the complexity of
[ranges](#common.Parser.parse^ranges) from tokenizer code.
*/
declare class InputStream {
    /**
    Backup chunk
    */
    private chunk2;
    private chunk2Pos;
    /**
    The character code of the next code unit in the input, or -1
    when the stream is at the end of the input.
    */
    next: number;
    /**
    The current position of the stream. Note that, due to parses
    being able to cover non-contiguous
    [ranges](#common.Parser.startParse), advancing the stream does
    not always mean its position moves a single unit.
    */
    pos: number;
    private rangeIndex;
    private range;
    /**
    Look at a code unit near the stream position. `.peek(0)` equals
    `.next`, `.peek(-1)` gives you the previous character, and so
    on.
    
    Note that looking around during tokenizing creates dependencies
    on potentially far-away content, which may reduce the
    effectiveness incremental parsing—when looking forward—or even
    cause invalid reparses when looking backward more than 25 code
    units, since the library does not track lookbehind.
    */
    peek(offset: number): number;
    /**
    Accept a token. By default, the end of the token is set to the
    current stream position, but you can pass an offset (relative to
    the stream position) to change that.
    */
    acceptToken(token: number, endOffset?: number): void;
    /**
    Accept a token ending at a specific given position.
    */
    acceptTokenTo(token: number, endPos: number): void;
    private getChunk;
    private readNext;
    /**
    Move the stream forward N (defaults to 1) code units. Returns
    the new value of [`next`](#lr.InputStream.next).
    */
    advance(n?: number): number;
    private setDone;
}
interface ExternalOptions {
    /**
    When set to true, mark this tokenizer as depending on the
    current parse stack, which prevents its result from being cached
    between parser actions at the same positions.
    */
    contextual?: boolean;
    /**
    By defaults, when a tokenizer returns a token, that prevents
    tokenizers with lower precedence from even running. When
    `fallback` is true, the tokenizer is allowed to run when a
    previous tokenizer returned a token that didn't match any of the
    current state's actions.
    */
    fallback?: boolean;
    /**
    When set to true, tokenizing will not stop after this tokenizer
    has produced a token. (But it will still fail to reach this one
    if a higher-precedence tokenizer produced a token.)
    */
    extend?: boolean;
}
/**
`@external tokens` declarations in the grammar should resolve to
an instance of this class.
*/
declare class ExternalTokenizer {
    /**
    Create a tokenizer. The first argument is the function that,
    given an input stream, scans for the types of tokens it
    recognizes at the stream's position, and calls
    [`acceptToken`](#lr.InputStream.acceptToken) when it finds
    one.
    */
    constructor(
    /**
    @internal
    */
    token: (input: InputStream, stack: Stack) => void, options?: ExternalOptions);
}

/**
Context trackers are used to track stateful context (such as
indentation in the Python grammar, or parent elements in the XML
grammar) needed by external tokenizers. You declare them in a
grammar file as `@context exportName from "module"`.

Context values should be immutable, and can be updated (replaced)
on shift or reduce actions.

The export used in a `@context` declaration should be of this
type.
*/
declare class ContextTracker<T> {
    /**
    Define a context tracker.
    */
    constructor(spec: {
        /**
        The initial value of the context at the start of the parse.
        */
        start: T;
        /**
        Update the context when the parser executes a
        [shift](https://en.wikipedia.org/wiki/LR_parser#Shift_and_reduce_actions)
        action.
        */
        shift?(context: T, term: number, stack: Stack, input: InputStream): T;
        /**
        Update the context when the parser executes a reduce action.
        */
        reduce?(context: T, term: number, stack: Stack, input: InputStream): T;
        /**
        Update the context when the parser reuses a node from a tree
        fragment.
        */
        reuse?(context: T, node: Tree, stack: Stack, input: InputStream): T;
        /**
        Reduce a context value to a number (for cheap storage and
        comparison). Only needed for strict contexts.
        */
        hash?(context: T): number;
        /**
        By default, nodes can only be reused during incremental
        parsing if they were created in the same context as the one in
        which they are reused. Set this to false to disable that
        check (and the overhead of storing the hashes).
        */
        strict?: boolean;
    });
}
/**
Configuration options when
[reconfiguring](#lr.LRParser.configure) a parser.
*/
interface ParserConfig {
    /**
    Node prop values to add to the parser's node set.
    */
    props?: readonly NodePropSource[];
    /**
    The name of the `@top` declaration to parse from. If not
    specified, the first top rule declaration in the grammar is
    used.
    */
    top?: string;
    /**
    A space-separated string of dialects to enable.
    */
    dialect?: string;
    /**
    Replace the given external tokenizers with new ones.
    */
    tokenizers?: {
        from: ExternalTokenizer;
        to: ExternalTokenizer;
    }[];
    /**
    Replace external specializers with new ones.
    */
    specializers?: {
        from: (value: string, stack: Stack) => number;
        to: (value: string, stack: Stack) => number;
    }[];
    /**
    Replace the context tracker with a new one.
    */
    contextTracker?: ContextTracker<any>;
    /**
    When true, the parser will raise an exception, rather than run
    its error-recovery strategies, when the input doesn't match the
    grammar.
    */
    strict?: boolean;
    /**
    Add a wrapper, which can extend parses created by this parser
    with additional logic (usually used to add
    [mixed-language](#common.parseMixed) parsing).
    */
    wrap?: ParseWrapper;
    /**
    The maximum length of the TreeBuffers generated in the output
    tree. Defaults to 1024.
    */
    bufferLength?: number;
}
/**
Holds the parse tables for a given grammar, as generated by
`lezer-generator`, and provides [methods](#common.Parser) to parse
content with.
*/
declare class LRParser extends Parser {
    /**
    The nodes used in the trees emitted by this parser.
    */
    readonly nodeSet: NodeSet;
    createParse(input: Input, fragments: readonly TreeFragment[], ranges: readonly {
        from: number;
        to: number;
    }[]): PartialParse;
    /**
    Configure the parser. Returns a new parser instance that has the
    given settings modified. Settings not provided in `config` are
    kept from the original parser.
    */
    configure(config: ParserConfig): LRParser;
    /**
    Tells you whether any [parse wrappers](#lr.ParserConfig.wrap)
    are registered for this parser.
    */
    hasWrappers(): boolean;
    /**
    Returns the name associated with a given term. This will only
    work for all terms when the parser was generated with the
    `--names` option. By default, only the names of tagged terms are
    stored.
    */
    getName(term: number): string;
    /**
    The type of top node produced by the parser.
    */
    get topNode(): NodeType;
    /**
    Used by the output of the parser generator. Not available to
    user code. @hide
    */
    static deserialize(spec: any): LRParser;
}

/**
Highlighting tags are markers that denote a highlighting category.
They are [associated](#highlight.styleTags) with parts of a syntax
tree by a language mode, and then mapped to an actual CSS style by
a [highlighter](#highlight.Highlighter).

Because syntax tree node types and highlight styles have to be
able to talk the same language, CodeMirror uses a mostly _closed_
[vocabulary](#highlight.tags) of syntax tags (as opposed to
traditional open string-based systems, which make it hard for
highlighting themes to cover all the tokens produced by the
various languages).

It _is_ possible to [define](#highlight.Tag^define) your own
highlighting tags for system-internal use (where you control both
the language package and the highlighter), but such tags will not
be picked up by regular highlighters (though you can derive them
from standard tags to allow highlighters to fall back to those).
*/
declare class Tag {
    /**
    The set of this tag and all its parent tags, starting with
    this one itself and sorted in order of decreasing specificity.
    */
    readonly set: Tag[];
    toString(): string;
    /**
    Define a new tag. If `parent` is given, the tag is treated as a
    sub-tag of that parent, and
    [highlighters](#highlight.tagHighlighter) that don't mention
    this tag will try to fall back to the parent tag (or grandparent
    tag, etc).
    */
    static define(name?: string, parent?: Tag): Tag;
    static define(parent?: Tag): Tag;
    /**
    Define a tag _modifier_, which is a function that, given a tag,
    will return a tag that is a subtag of the original. Applying the
    same modifier to a twice tag will return the same value (`m1(t1)
    == m1(t1)`) and applying multiple modifiers will, regardless or
    order, produce the same tag (`m1(m2(t1)) == m2(m1(t1))`).
    
    When multiple modifiers are applied to a given base tag, each
    smaller set of modifiers is registered as a parent, so that for
    example `m1(m2(m3(t1)))` is a subtype of `m1(m2(t1))`,
    `m1(m3(t1)`, and so on.
    */
    static defineModifier(name?: string): (tag: Tag) => Tag;
}
/**
A highlighter defines a mapping from highlighting tags and
language scopes to CSS class names. They are usually defined via
[`tagHighlighter`](#highlight.tagHighlighter) or some wrapper
around that, but it is also possible to implement them from
scratch.
*/
interface Highlighter {
    /**
    Get the set of classes that should be applied to the given set
    of highlighting tags, or null if this highlighter doesn't assign
    a style to the tags.
    */
    style(tags: readonly Tag[]): string | null;
    /**
    When given, the highlighter will only be applied to trees on
    whose [top](#common.NodeType.isTop) node this predicate returns
    true.
    */
    scope?(node: NodeType): boolean;
}
/**
The default set of highlighting [tags](#highlight.Tag).

This collection is heavily biased towards programming languages,
and necessarily incomplete. A full ontology of syntactic
constructs would fill a stack of books, and be impractical to
write themes for. So try to make do with this set. If all else
fails, [open an
issue](https://github.com/codemirror/codemirror.next) to propose a
new tag, or [define](#highlight.Tag^define) a local custom tag for
your use case.

Note that it is not obligatory to always attach the most specific
tag possible to an element—if your grammar can't easily
distinguish a certain type of element (such as a local variable),
it is okay to style it as its more general variant (a variable).

For tags that extend some parent tag, the documentation links to
the parent.
*/
declare const tags: {
    /**
    A comment.
    */
    comment: Tag;
    /**
    A line [comment](#highlight.tags.comment).
    */
    lineComment: Tag;
    /**
    A block [comment](#highlight.tags.comment).
    */
    blockComment: Tag;
    /**
    A documentation [comment](#highlight.tags.comment).
    */
    docComment: Tag;
    /**
    Any kind of identifier.
    */
    name: Tag;
    /**
    The [name](#highlight.tags.name) of a variable.
    */
    variableName: Tag;
    /**
    A type [name](#highlight.tags.name).
    */
    typeName: Tag;
    /**
    A tag name (subtag of [`typeName`](#highlight.tags.typeName)).
    */
    tagName: Tag;
    /**
    A property or field [name](#highlight.tags.name).
    */
    propertyName: Tag;
    /**
    An attribute name (subtag of [`propertyName`](#highlight.tags.propertyName)).
    */
    attributeName: Tag;
    /**
    The [name](#highlight.tags.name) of a class.
    */
    className: Tag;
    /**
    A label [name](#highlight.tags.name).
    */
    labelName: Tag;
    /**
    A namespace [name](#highlight.tags.name).
    */
    namespace: Tag;
    /**
    The [name](#highlight.tags.name) of a macro.
    */
    macroName: Tag;
    /**
    A literal value.
    */
    literal: Tag;
    /**
    A string [literal](#highlight.tags.literal).
    */
    string: Tag;
    /**
    A documentation [string](#highlight.tags.string).
    */
    docString: Tag;
    /**
    A character literal (subtag of [string](#highlight.tags.string)).
    */
    character: Tag;
    /**
    An attribute value (subtag of [string](#highlight.tags.string)).
    */
    attributeValue: Tag;
    /**
    A number [literal](#highlight.tags.literal).
    */
    number: Tag;
    /**
    An integer [number](#highlight.tags.number) literal.
    */
    integer: Tag;
    /**
    A floating-point [number](#highlight.tags.number) literal.
    */
    float: Tag;
    /**
    A boolean [literal](#highlight.tags.literal).
    */
    bool: Tag;
    /**
    Regular expression [literal](#highlight.tags.literal).
    */
    regexp: Tag;
    /**
    An escape [literal](#highlight.tags.literal), for example a
    backslash escape in a string.
    */
    escape: Tag;
    /**
    A color [literal](#highlight.tags.literal).
    */
    color: Tag;
    /**
    A URL [literal](#highlight.tags.literal).
    */
    url: Tag;
    /**
    A language keyword.
    */
    keyword: Tag;
    /**
    The [keyword](#highlight.tags.keyword) for the self or this
    object.
    */
    self: Tag;
    /**
    The [keyword](#highlight.tags.keyword) for null.
    */
    null: Tag;
    /**
    A [keyword](#highlight.tags.keyword) denoting some atomic value.
    */
    atom: Tag;
    /**
    A [keyword](#highlight.tags.keyword) that represents a unit.
    */
    unit: Tag;
    /**
    A modifier [keyword](#highlight.tags.keyword).
    */
    modifier: Tag;
    /**
    A [keyword](#highlight.tags.keyword) that acts as an operator.
    */
    operatorKeyword: Tag;
    /**
    A control-flow related [keyword](#highlight.tags.keyword).
    */
    controlKeyword: Tag;
    /**
    A [keyword](#highlight.tags.keyword) that defines something.
    */
    definitionKeyword: Tag;
    /**
    A [keyword](#highlight.tags.keyword) related to defining or
    interfacing with modules.
    */
    moduleKeyword: Tag;
    /**
    An operator.
    */
    operator: Tag;
    /**
    An [operator](#highlight.tags.operator) that dereferences something.
    */
    derefOperator: Tag;
    /**
    Arithmetic-related [operator](#highlight.tags.operator).
    */
    arithmeticOperator: Tag;
    /**
    Logical [operator](#highlight.tags.operator).
    */
    logicOperator: Tag;
    /**
    Bit [operator](#highlight.tags.operator).
    */
    bitwiseOperator: Tag;
    /**
    Comparison [operator](#highlight.tags.operator).
    */
    compareOperator: Tag;
    /**
    [Operator](#highlight.tags.operator) that updates its operand.
    */
    updateOperator: Tag;
    /**
    [Operator](#highlight.tags.operator) that defines something.
    */
    definitionOperator: Tag;
    /**
    Type-related [operator](#highlight.tags.operator).
    */
    typeOperator: Tag;
    /**
    Control-flow [operator](#highlight.tags.operator).
    */
    controlOperator: Tag;
    /**
    Program or markup punctuation.
    */
    punctuation: Tag;
    /**
    [Punctuation](#highlight.tags.punctuation) that separates
    things.
    */
    separator: Tag;
    /**
    Bracket-style [punctuation](#highlight.tags.punctuation).
    */
    bracket: Tag;
    /**
    Angle [brackets](#highlight.tags.bracket) (usually `<` and `>`
    tokens).
    */
    angleBracket: Tag;
    /**
    Square [brackets](#highlight.tags.bracket) (usually `[` and `]`
    tokens).
    */
    squareBracket: Tag;
    /**
    Parentheses (usually `(` and `)` tokens). Subtag of
    [bracket](#highlight.tags.bracket).
    */
    paren: Tag;
    /**
    Braces (usually `{` and `}` tokens). Subtag of
    [bracket](#highlight.tags.bracket).
    */
    brace: Tag;
    /**
    Content, for example plain text in XML or markup documents.
    */
    content: Tag;
    /**
    [Content](#highlight.tags.content) that represents a heading.
    */
    heading: Tag;
    /**
    A level 1 [heading](#highlight.tags.heading).
    */
    heading1: Tag;
    /**
    A level 2 [heading](#highlight.tags.heading).
    */
    heading2: Tag;
    /**
    A level 3 [heading](#highlight.tags.heading).
    */
    heading3: Tag;
    /**
    A level 4 [heading](#highlight.tags.heading).
    */
    heading4: Tag;
    /**
    A level 5 [heading](#highlight.tags.heading).
    */
    heading5: Tag;
    /**
    A level 6 [heading](#highlight.tags.heading).
    */
    heading6: Tag;
    /**
    A prose [content](#highlight.tags.content) separator (such as a horizontal rule).
    */
    contentSeparator: Tag;
    /**
    [Content](#highlight.tags.content) that represents a list.
    */
    list: Tag;
    /**
    [Content](#highlight.tags.content) that represents a quote.
    */
    quote: Tag;
    /**
    [Content](#highlight.tags.content) that is emphasized.
    */
    emphasis: Tag;
    /**
    [Content](#highlight.tags.content) that is styled strong.
    */
    strong: Tag;
    /**
    [Content](#highlight.tags.content) that is part of a link.
    */
    link: Tag;
    /**
    [Content](#highlight.tags.content) that is styled as code or
    monospace.
    */
    monospace: Tag;
    /**
    [Content](#highlight.tags.content) that has a strike-through
    style.
    */
    strikethrough: Tag;
    /**
    Inserted text in a change-tracking format.
    */
    inserted: Tag;
    /**
    Deleted text.
    */
    deleted: Tag;
    /**
    Changed text.
    */
    changed: Tag;
    /**
    An invalid or unsyntactic element.
    */
    invalid: Tag;
    /**
    Metadata or meta-instruction.
    */
    meta: Tag;
    /**
    [Metadata](#highlight.tags.meta) that applies to the entire
    document.
    */
    documentMeta: Tag;
    /**
    [Metadata](#highlight.tags.meta) that annotates or adds
    attributes to a given syntactic element.
    */
    annotation: Tag;
    /**
    Processing instruction or preprocessor directive. Subtag of
    [meta](#highlight.tags.meta).
    */
    processingInstruction: Tag;
    /**
    [Modifier](#highlight.Tag^defineModifier) that indicates that a
    given element is being defined. Expected to be used with the
    various [name](#highlight.tags.name) tags.
    */
    definition: (tag: Tag) => Tag;
    /**
    [Modifier](#highlight.Tag^defineModifier) that indicates that
    something is constant. Mostly expected to be used with
    [variable names](#highlight.tags.variableName).
    */
    constant: (tag: Tag) => Tag;
    /**
    [Modifier](#highlight.Tag^defineModifier) used to indicate that
    a [variable](#highlight.tags.variableName) or [property
    name](#highlight.tags.propertyName) is being called or defined
    as a function.
    */
    function: (tag: Tag) => Tag;
    /**
    [Modifier](#highlight.Tag^defineModifier) that can be applied to
    [names](#highlight.tags.name) to indicate that they belong to
    the language's standard environment.
    */
    standard: (tag: Tag) => Tag;
    /**
    [Modifier](#highlight.Tag^defineModifier) that indicates a given
    [names](#highlight.tags.name) is local to some scope.
    */
    local: (tag: Tag) => Tag;
    /**
    A generic variant [modifier](#highlight.Tag^defineModifier) that
    can be used to tag language-specific alternative variants of
    some common tag. It is recommended for themes to define special
    forms of at least the [string](#highlight.tags.string) and
    [variable name](#highlight.tags.variableName) tags, since those
    come up a lot.
    */
    special: (tag: Tag) => Tag;
};

/**
A language object manages parsing and per-language
[metadata](https://codemirror.net/6/docs/ref/#state.EditorState.languageDataAt). Parse data is
managed as a [Lezer](https://lezer.codemirror.net) tree. The class
can be used directly, via the [`LRLanguage`](https://codemirror.net/6/docs/ref/#language.LRLanguage)
subclass for [Lezer](https://lezer.codemirror.net/) LR parsers, or
via the [`StreamLanguage`](https://codemirror.net/6/docs/ref/#language.StreamLanguage) subclass
for stream parsers.
*/
declare class Language {
    /**
    The [language data](https://codemirror.net/6/docs/ref/#state.EditorState.languageDataAt) facet
    used for this language.
    */
    readonly data: Facet<{
        [name: string]: any;
    }>;
    /**
    A language name.
    */
    readonly name: string;
    /**
    The extension value to install this as the document language.
    */
    readonly extension: Extension;
    /**
    The parser object. Can be useful when using this as a [nested
    parser](https://lezer.codemirror.net/docs/ref#common.Parser).
    */
    parser: Parser;
    /**
    Construct a language object. If you need to invoke this
    directly, first define a data facet with
    [`defineLanguageFacet`](https://codemirror.net/6/docs/ref/#language.defineLanguageFacet), and then
    configure your parser to [attach](https://codemirror.net/6/docs/ref/#language.languageDataProp) it
    to the language's outer syntax node.
    */
    constructor(
    /**
    The [language data](https://codemirror.net/6/docs/ref/#state.EditorState.languageDataAt) facet
    used for this language.
    */
    data: Facet<{
        [name: string]: any;
    }>, parser: Parser, extraExtensions?: Extension[], 
    /**
    A language name.
    */
    name?: string);
    /**
    Query whether this language is active at the given position.
    */
    isActiveAt(state: EditorState, pos: number, side?: -1 | 0 | 1): boolean;
    /**
    Find the document regions that were parsed using this language.
    The returned regions will _include_ any nested languages rooted
    in this language, when those exist.
    */
    findRegions(state: EditorState): {
        from: number;
        to: number;
    }[];
    /**
    Indicates whether this language allows nested languages. The
    default implementation returns true.
    */
    get allowsNesting(): boolean;
}
/**
A subclass of [`Language`](https://codemirror.net/6/docs/ref/#language.Language) for use with Lezer
[LR parsers](https://lezer.codemirror.net/docs/ref#lr.LRParser)
parsers.
*/
declare class LRLanguage extends Language {
    readonly parser: LRParser;
    private constructor();
    /**
    Define a language from a parser.
    */
    static define(spec: {
        /**
        The [name](https://codemirror.net/6/docs/ref/#Language.name) of the language.
        */
        name?: string;
        /**
        The parser to use. Should already have added editor-relevant
        node props (and optionally things like dialect and top rule)
        configured.
        */
        parser: LRParser;
        /**
        [Language data](https://codemirror.net/6/docs/ref/#state.EditorState.languageDataAt)
        to register for this language.
        */
        languageData?: {
            [name: string]: any;
        };
    }): LRLanguage;
    /**
    Create a new instance of this language with a reconfigured
    version of its parser and optionally a new name.
    */
    configure(options: ParserConfig, name?: string): LRLanguage;
    get allowsNesting(): boolean;
}
/**
Get the syntax tree for a state, which is the current (possibly
incomplete) parse tree of the active
[language](https://codemirror.net/6/docs/ref/#language.Language), or the empty tree if there is no
language available.
*/
declare function syntaxTree(state: EditorState): Tree;
/**
Queries whether there is a full syntax tree available up to the
given document position. If there isn't, the background parse
process _might_ still be working and update the tree further, but
there is no guarantee of that—the parser will [stop
working](https://codemirror.net/6/docs/ref/#language.syntaxParserRunning) when it has spent a
certain amount of time or has moved beyond the visible viewport.
Always returns false if no language has been enabled.
*/
declare function syntaxTreeAvailable(state: EditorState, upto?: number): boolean;
/**
This class bundles a [language](https://codemirror.net/6/docs/ref/#language.Language) with an
optional set of supporting extensions. Language packages are
encouraged to export a function that optionally takes a
configuration object and returns a `LanguageSupport` instance, as
the main way for client code to use the package.
*/
declare class LanguageSupport {
    /**
    The language object.
    */
    readonly language: Language;
    /**
    An optional set of supporting extensions. When nesting a
    language in another language, the outer language is encouraged
    to include the supporting extensions for its inner languages
    in its own set of support extensions.
    */
    readonly support: Extension;
    /**
    An extension including both the language and its support
    extensions. (Allowing the object to be used as an extension
    value itself.)
    */
    extension: Extension;
    /**
    Create a language support object.
    */
    constructor(
    /**
    The language object.
    */
    language: Language, 
    /**
    An optional set of supporting extensions. When nesting a
    language in another language, the outer language is encouraged
    to include the supporting extensions for its inner languages
    in its own set of support extensions.
    */
    support?: Extension);
}
/**
Language descriptions are used to store metadata about languages
and to dynamically load them. Their main role is finding the
appropriate language for a filename or dynamically loading nested
parsers.
*/
declare class LanguageDescription {
    /**
    The name of this language.
    */
    readonly name: string;
    /**
    Alternative names for the mode (lowercased, includes `this.name`).
    */
    readonly alias: readonly string[];
    /**
    File extensions associated with this language.
    */
    readonly extensions: readonly string[];
    /**
    Optional filename pattern that should be associated with this
    language.
    */
    readonly filename: RegExp | undefined;
    private loadFunc;
    /**
    If the language has been loaded, this will hold its value.
    */
    support: LanguageSupport | undefined;
    private loading;
    private constructor();
    /**
    Start loading the the language. Will return a promise that
    resolves to a [`LanguageSupport`](https://codemirror.net/6/docs/ref/#language.LanguageSupport)
    object when the language successfully loads.
    */
    load(): Promise<LanguageSupport>;
    /**
    Create a language description.
    */
    static of(spec: {
        /**
        The language's name.
        */
        name: string;
        /**
        An optional array of alternative names.
        */
        alias?: readonly string[];
        /**
        An optional array of filename extensions associated with this
        language.
        */
        extensions?: readonly string[];
        /**
        An optional filename pattern associated with this language.
        */
        filename?: RegExp;
        /**
        A function that will asynchronously load the language.
        */
        load?: () => Promise<LanguageSupport>;
        /**
        Alternatively to `load`, you can provide an already loaded
        support object. Either this or `load` should be provided.
        */
        support?: LanguageSupport;
    }): LanguageDescription;
    /**
    Look for a language in the given array of descriptions that
    matches the filename. Will first match
    [`filename`](https://codemirror.net/6/docs/ref/#language.LanguageDescription.filename) patterns,
    and then [extensions](https://codemirror.net/6/docs/ref/#language.LanguageDescription.extensions),
    and return the first language that matches.
    */
    static matchFilename(descs: readonly LanguageDescription[], filename: string): LanguageDescription | null;
    /**
    Look for a language whose name or alias matches the the given
    name (case-insensitively). If `fuzzy` is true, and no direct
    matchs is found, this'll also search for a language whose name
    or alias occurs in the string (for names shorter than three
    characters, only when surrounded by non-word characters).
    */
    static matchLanguageName(descs: readonly LanguageDescription[], name: string, fuzzy?: boolean): LanguageDescription | null;
}
/**
Facet for overriding the unit by which indentation happens. Should
be a string consisting entirely of the same whitespace character.
When not set, this defaults to 2 spaces.
*/
declare const indentUnit: Facet<string, string>;
/**
Indentation contexts are used when calling [indentation
services](https://codemirror.net/6/docs/ref/#language.indentService). They provide helper utilities
useful in indentation logic, and can selectively override the
indentation reported for some lines.
*/
declare class IndentContext {
    /**
    The editor state.
    */
    readonly state: EditorState;
    /**
    The indent unit (number of columns per indentation level).
    */
    unit: number;
    /**
    Create an indent context.
    */
    constructor(
    /**
    The editor state.
    */
    state: EditorState, 
    /**
    @internal
    */
    options?: {
        /**
        Override line indentations provided to the indentation
        helper function, which is useful when implementing region
        indentation, where indentation for later lines needs to refer
        to previous lines, which may have been reindented compared to
        the original start state. If given, this function should
        return -1 for lines (given by start position) that didn't
        change, and an updated indentation otherwise.
        */
        overrideIndentation?: (pos: number) => number;
        /**
        Make it look, to the indent logic, like a line break was
        added at the given position (which is mostly just useful for
        implementing something like
        [`insertNewlineAndIndent`](https://codemirror.net/6/docs/ref/#commands.insertNewlineAndIndent)).
        */
        simulateBreak?: number;
        /**
        When `simulateBreak` is given, this can be used to make the
        simulated break behave like a double line break.
        */
        simulateDoubleBreak?: boolean;
    });
    /**
    Get a description of the line at the given position, taking
    [simulated line
    breaks](https://codemirror.net/6/docs/ref/#language.IndentContext.constructor^options.simulateBreak)
    into account. If there is such a break at `pos`, the `bias`
    argument determines whether the part of the line line before or
    after the break is used.
    */
    lineAt(pos: number, bias?: -1 | 1): {
        text: string;
        from: number;
    };
    /**
    Get the text directly after `pos`, either the entire line
    or the next 100 characters, whichever is shorter.
    */
    textAfterPos(pos: number, bias?: -1 | 1): string;
    /**
    Find the column for the given position.
    */
    column(pos: number, bias?: -1 | 1): number;
    /**
    Find the column position (taking tabs into account) of the given
    position in the given string.
    */
    countColumn(line: string, pos?: number): number;
    /**
    Find the indentation column of the line at the given point.
    */
    lineIndent(pos: number, bias?: -1 | 1): number;
    /**
    Returns the [simulated line
    break](https://codemirror.net/6/docs/ref/#language.IndentContext.constructor^options.simulateBreak)
    for this context, if any.
    */
    get simulatedBreak(): number | null;
}
/**
Objects of this type provide context information and helper
methods to indentation functions registered on syntax nodes.
*/
declare class TreeIndentContext extends IndentContext {
    private base;
    /**
    The position at which indentation is being computed.
    */
    readonly pos: number;
    private constructor();
    /**
    The syntax tree node to which the indentation strategy
    applies.
    */
    get node(): SyntaxNode;
    /**
    Get the text directly after `this.pos`, either the entire line
    or the next 100 characters, whichever is shorter.
    */
    get textAfter(): string;
    /**
    Get the indentation at the reference line for `this.node`, which
    is the line on which it starts, unless there is a node that is
    _not_ a parent of this node covering the start of that line. If
    so, the line at the start of that node is tried, again skipping
    on if it is covered by another such node.
    */
    get baseIndent(): number;
    /**
    Get the indentation for the reference line of the given node
    (see [`baseIndent`](https://codemirror.net/6/docs/ref/#language.TreeIndentContext.baseIndent)).
    */
    baseIndentFor(node: SyntaxNode): number;
    /**
    Continue looking for indentations in the node's parent nodes,
    and return the result of that.
    */
    continue(): number | null;
}
/**
An indentation strategy for delimited (usually bracketed) nodes.
Will, by default, indent one unit more than the parent's base
indent unless the line starts with a closing token. When `align`
is true and there are non-skipped nodes on the node's opening
line, the content of the node will be aligned with the end of the
opening node, like this:

    foo(bar,
        baz)
*/
declare function delimitedIndent({ closing, align, units }: {
    closing: string;
    align?: boolean;
    units?: number;
}): (context: TreeIndentContext) => number;
/**
Enables reindentation on input. When a language defines an
`indentOnInput` field in its [language
data](https://codemirror.net/6/docs/ref/#state.EditorState.languageDataAt), which must hold a regular
expression, the line at the cursor will be reindented whenever new
text is typed and the input from the start of the line up to the
cursor matches that regexp.

To avoid unneccesary reindents, it is recommended to start the
regexp with `^` (usually followed by `\s*`), and end it with `$`.
For example, `/^\s*\}$/` will reindent when a closing brace is
added at the start of a line.
*/
declare function indentOnInput(): Extension;
/**
Default fold-related key bindings.

 - Ctrl-Shift-[ (Cmd-Alt-[ on macOS): [`foldCode`](https://codemirror.net/6/docs/ref/#language.foldCode).
 - Ctrl-Shift-] (Cmd-Alt-] on macOS): [`unfoldCode`](https://codemirror.net/6/docs/ref/#language.unfoldCode).
 - Ctrl-Alt-[: [`foldAll`](https://codemirror.net/6/docs/ref/#language.foldAll).
 - Ctrl-Alt-]: [`unfoldAll`](https://codemirror.net/6/docs/ref/#language.unfoldAll).
*/
declare const foldKeymap: readonly KeyBinding[];
type Handlers = {
    [event: string]: (view: EditorView, line: BlockInfo, event: Event) => boolean;
};
interface FoldGutterConfig {
    /**
    A function that creates the DOM element used to indicate a
    given line is folded or can be folded.
    When not given, the `openText`/`closeText` option will be used instead.
    */
    markerDOM?: ((open: boolean) => HTMLElement) | null;
    /**
    Text used to indicate that a given line can be folded.
    Defaults to `"⌄"`.
    */
    openText?: string;
    /**
    Text used to indicate that a given line is folded.
    Defaults to `"›"`.
    */
    closedText?: string;
    /**
    Supply event handlers for DOM events on this gutter.
    */
    domEventHandlers?: Handlers;
    /**
    When given, if this returns true for a given view update,
    recompute the fold markers.
    */
    foldingChanged?: (update: ViewUpdate) => boolean;
}
/**
Create an extension that registers a fold gutter, which shows a
fold status indicator before foldable lines (which can be clicked
to fold or unfold the line).
*/
declare function foldGutter(config?: FoldGutterConfig): Extension;

/**
A highlight style associates CSS styles with highlighting
[tags](https://lezer.codemirror.net/docs/ref#highlight.Tag).
*/
declare class HighlightStyle implements Highlighter {
    /**
    The tag styles used to create this highlight style.
    */
    readonly specs: readonly TagStyle[];
    /**
    A style module holding the CSS rules for this highlight style.
    When using
    [`highlightTree`](https://lezer.codemirror.net/docs/ref#highlight.highlightTree)
    outside of the editor, you may want to manually mount this
    module to show the highlighting.
    */
    readonly module: StyleModule | null;
    readonly style: (tags: readonly Tag[]) => string | null;
    readonly scope?: (type: NodeType) => boolean;
    private constructor();
    /**
    Create a highlighter style that associates the given styles to
    the given tags. The specs must be objects that hold a style tag
    or array of tags in their `tag` property, and either a single
    `class` property providing a static CSS class (for highlighter
    that rely on external styling), or a
    [`style-mod`](https://github.com/marijnh/style-mod#documentation)-style
    set of CSS properties (which define the styling for those tags).
    
    The CSS rules created for a highlighter will be emitted in the
    order of the spec's properties. That means that for elements that
    have multiple tags associated with them, styles defined further
    down in the list will have a higher CSS precedence than styles
    defined earlier.
    */
    static define(specs: readonly TagStyle[], options?: {
        /**
        By default, highlighters apply to the entire document. You can
        scope them to a single language by providing the language
        object or a language's top node type here.
        */
        scope?: Language | NodeType;
        /**
        Add a style to _all_ content. Probably only useful in
        combination with `scope`.
        */
        all?: string | StyleSpec;
        /**
        Specify that this highlight style should only be active then
        the theme is dark or light. By default, it is active
        regardless of theme.
        */
        themeType?: "dark" | "light";
    }): HighlightStyle;
}
/**
Wrap a highlighter in an editor extension that uses it to apply
syntax highlighting to the editor content.

When multiple (non-fallback) styles are provided, the styling
applied is the union of the classes they emit.
*/
declare function syntaxHighlighting(highlighter: Highlighter, options?: {
    /**
    When enabled, this marks the highlighter as a fallback, which
    only takes effect if no other highlighters are registered.
    */
    fallback: boolean;
}): Extension;
/**
The type of object used in
[`HighlightStyle.define`](https://codemirror.net/6/docs/ref/#language.HighlightStyle^define).
Assigns a style to one or more highlighting
[tags](https://lezer.codemirror.net/docs/ref#highlight.Tag), which can either be a fixed class name
(which must be defined elsewhere), or a set of CSS properties, for
which the library will define an anonymous class.
*/
interface TagStyle {
    /**
    The tag or tags to target.
    */
    tag: Tag | readonly Tag[];
    /**
    If given, this maps the tags to a fixed class name.
    */
    class?: string;
    /**
    Any further properties (if `class` isn't given) will be
    interpreted as in style objects given to
    [style-mod](https://github.com/marijnh/style-mod#documentation).
    (The type here is `any` because of TypeScript limitations.)
    */
    [styleProperty: string]: any;
}
/**
A default highlight style (works well with light themes).
*/
declare const defaultHighlightStyle: HighlightStyle;

interface Config {
    /**
    Whether the bracket matching should look at the character after
    the cursor when matching (if the one before isn't a bracket).
    Defaults to true.
    */
    afterCursor?: boolean;
    /**
    The bracket characters to match, as a string of pairs. Defaults
    to `"()[]{}"`. Note that these are only used as fallback when
    there is no [matching
    information](https://lezer.codemirror.net/docs/ref/#common.NodeProp^closedBy)
    in the syntax tree.
    */
    brackets?: string;
    /**
    The maximum distance to scan for matching brackets. This is only
    relevant for brackets not encoded in the syntax tree. Defaults
    to 10 000.
    */
    maxScanDistance?: number;
    /**
    Can be used to configure the way in which brackets are
    decorated. The default behavior is to add the
    `cm-matchingBracket` class for matching pairs, and
    `cm-nonmatchingBracket` for mismatched pairs or single brackets.
    */
    renderMatch?: (match: MatchResult, state: EditorState) => readonly Range<Decoration>[];
}
/**
Create an extension that enables bracket matching. Whenever the
cursor is next to a bracket, that bracket and the one it matches
are highlighted. Or, when no matching bracket is found, another
highlighting style is used to indicate this.
*/
declare function bracketMatching(config?: Config): Extension;
/**
The result returned from `matchBrackets`.
*/
interface MatchResult {
    /**
    The extent of the bracket token found.
    */
    start: {
        from: number;
        to: number;
    };
    /**
    The extent of the matched token, if any was found.
    */
    end?: {
        from: number;
        to: number;
    };
    /**
    Whether the tokens match. This can be false even when `end` has
    a value, if that token doesn't match the opening token.
    */
    matched: boolean;
}

/**
Encapsulates a single line of input. Given to stream syntax code,
which uses it to tokenize the content.
*/
declare class StringStream {
    /**
    The line.
    */
    string: string;
    private tabSize;
    /**
    The current indent unit size.
    */
    indentUnit: number;
    private overrideIndent?;
    /**
    The current position on the line.
    */
    pos: number;
    /**
    The start position of the current token.
    */
    start: number;
    private lastColumnPos;
    private lastColumnValue;
    /**
    Create a stream.
    */
    constructor(
    /**
    The line.
    */
    string: string, tabSize: number, 
    /**
    The current indent unit size.
    */
    indentUnit: number, overrideIndent?: number | undefined);
    /**
    True if we are at the end of the line.
    */
    eol(): boolean;
    /**
    True if we are at the start of the line.
    */
    sol(): boolean;
    /**
    Get the next code unit after the current position, or undefined
    if we're at the end of the line.
    */
    peek(): string | undefined;
    /**
    Read the next code unit and advance `this.pos`.
    */
    next(): string | void;
    /**
    Match the next character against the given string, regular
    expression, or predicate. Consume and return it if it matches.
    */
    eat(match: string | RegExp | ((ch: string) => boolean)): string | void;
    /**
    Continue matching characters that match the given string,
    regular expression, or predicate function. Return true if any
    characters were consumed.
    */
    eatWhile(match: string | RegExp | ((ch: string) => boolean)): boolean;
    /**
    Consume whitespace ahead of `this.pos`. Return true if any was
    found.
    */
    eatSpace(): boolean;
    /**
    Move to the end of the line.
    */
    skipToEnd(): void;
    /**
    Move to directly before the given character, if found on the
    current line.
    */
    skipTo(ch: string): boolean | void;
    /**
    Move back `n` characters.
    */
    backUp(n: number): void;
    /**
    Get the column position at `this.pos`.
    */
    column(): number;
    /**
    Get the indentation column of the current line.
    */
    indentation(): number;
    /**
    Match the input against the given string or regular expression
    (which should start with a `^`). Return true or the regexp match
    if it matches.
    
    Unless `consume` is set to `false`, this will move `this.pos`
    past the matched text.
    
    When matching a string `caseInsensitive` can be set to true to
    make the match case-insensitive.
    */
    match(pattern: string | RegExp, consume?: boolean, caseInsensitive?: boolean): boolean | RegExpMatchArray | null;
    /**
    Get the current token.
    */
    current(): string;
}

/**
A stream parser parses or tokenizes content from start to end,
emitting tokens as it goes over it. It keeps a mutable (but
copyable) object with state, in which it can store information
about the current context.
*/
interface StreamParser<State> {
    /**
    A name for this language.
    */
    name?: string;
    /**
    Produce a start state for the parser.
    */
    startState?(indentUnit: number): State;
    /**
    Read one token, advancing the stream past it, and returning a
    string indicating the token's style tag—either the name of one
    of the tags in
    [`tags`](https://lezer.codemirror.net/docs/ref#highlight.tags)
    or [`tokenTable`](https://codemirror.net/6/docs/ref/#language.StreamParser.tokenTable), or such a
    name suffixed by one or more tag
    [modifier](https://lezer.codemirror.net/docs/ref#highlight.Tag^defineModifier)
    names, separated by periods. For example `"keyword"` or
    "`variableName.constant"`, or a space-separated set of such
    token types.
    
    It is okay to return a zero-length token, but only if that
    updates the state so that the next call will return a non-empty
    token again.
    */
    token(stream: StringStream, state: State): string | null;
    /**
    This notifies the parser of a blank line in the input. It can
    update its state here if it needs to.
    */
    blankLine?(state: State, indentUnit: number): void;
    /**
    Copy a given state. By default, a shallow object copy is done
    which also copies arrays held at the top level of the object.
    */
    copyState?(state: State): State;
    /**
    Compute automatic indentation for the line that starts with the
    given state and text.
    */
    indent?(state: State, textAfter: string, context: IndentContext): number | null;
    /**
    Default [language data](https://codemirror.net/6/docs/ref/#state.EditorState.languageDataAt) to
    attach to this language.
    */
    languageData?: {
        [name: string]: any;
    };
    /**
    Extra tokens to use in this parser. When the tokenizer returns a
    token name that exists as a property in this object, the
    corresponding tags will be assigned to the token.
    */
    tokenTable?: {
        [name: string]: Tag | readonly Tag[];
    };
    /**
    By default, adjacent tokens of the same type are merged in the
    output tree. Set this to false to disable that.
    */
    mergeTokens?: boolean;
}
/**
A [language](https://codemirror.net/6/docs/ref/#language.Language) class based on a CodeMirror
5-style [streaming parser](https://codemirror.net/6/docs/ref/#language.StreamParser).
*/
declare class StreamLanguage<State> extends Language {
    private constructor();
    /**
    Define a stream language.
    */
    static define<State>(spec: StreamParser<State>): StreamLanguage<State>;
    get allowsNesting(): boolean;
}

/**
Objects type used to represent individual completions.
*/
interface Completion {
    /**
    The label to show in the completion picker. This is what input
    is matched against to determine whether a completion matches (and
    how well it matches).
    */
    label: string;
    /**
    An optional override for the completion's visible label. When
    using this, matched characters will only be highlighted if you
    provide a [`getMatch`](https://codemirror.net/6/docs/ref/#autocomplete.CompletionResult.getMatch)
    function.
    */
    displayLabel?: string;
    /**
    Overrides the text that is used to sort completions. Will
    default to `label` if not given.
    */
    sortText?: string;
    /**
    An optional short piece of information to show (with a different
    style) after the label.
    */
    detail?: string;
    /**
    Additional info to show when the completion is selected. Can be
    a plain string or a function that'll render the DOM structure to
    show when invoked.
    */
    info?: string | ((completion: Completion) => CompletionInfo | Promise<CompletionInfo>);
    /**
    How to apply the completion. The default is to replace it with
    its [label](https://codemirror.net/6/docs/ref/#autocomplete.Completion.label). When this holds a
    string, the completion range is replaced by that string. When it
    is a function, that function is called to perform the
    completion. If it fires a transaction, it is responsible for
    adding the [`pickedCompletion`](https://codemirror.net/6/docs/ref/#autocomplete.pickedCompletion)
    annotation to it.
    */
    apply?: string | ((view: EditorView, completion: Completion, from: number, to: number) => void);
    /**
    The type of the completion. This is used to pick an icon to show
    for the completion. Icons are styled with a CSS class created by
    appending the type name to `"cm-completionIcon-"`. You can
    define or restyle icons by defining these selectors. The base
    library defines simple icons for `class`, `constant`, `enum`,
    `function`, `interface`, `keyword`, `method`, `namespace`,
    `property`, `text`, `type`, and `variable`.
    
    Multiple types can be provided by separating them with spaces.
    */
    type?: string;
    /**
    When this option is selected, and one of these characters is
    typed, insert the completion before typing the character.
    */
    commitCharacters?: readonly string[];
    /**
    When given, should be a number from -99 to 99 that adjusts how
    this completion is ranked compared to other completions that
    match the input as well as this one. A negative number moves it
    down the list, a positive number moves it up.
    */
    boost?: number;
    /**
    Can be used to divide the completion list into sections.
    Completions in a given section (matched by name) will be grouped
    together, with a heading above them. Options without section
    will appear above all sections. A string value is equivalent to
    a `{name}` object.
    */
    section?: string | CompletionSection;
}
/**
The type returned from
[`Completion.info`](https://codemirror.net/6/docs/ref/#autocomplete.Completion.info). May be a DOM
node, null to indicate there is no info, or an object with an
optional `destroy` method that cleans up the node.
*/
type CompletionInfo = Node | null | {
    dom: Node;
    destroy?(): void;
};
/**
Object used to describe a completion
[section](https://codemirror.net/6/docs/ref/#autocomplete.Completion.section). It is recommended to
create a shared object used by all the completions in a given
section.
*/
interface CompletionSection {
    /**
    The name of the section. If no `render` method is present, this
    will be displayed above the options.
    */
    name: string;
    /**
    An optional function that renders the section header. Since the
    headers are shown inside a list, you should make sure the
    resulting element has a `display: list-item` style.
    */
    header?: (section: CompletionSection) => HTMLElement;
    /**
    By default, sections are ordered alphabetically by name. To
    specify an explicit order, `rank` can be used. Sections with a
    lower rank will be shown above sections with a higher rank.
    
    When set to `"dynamic"`, the section's position compared to
    other dynamic sections depends on the matching score of the
    best-matching option in the sections.
    */
    rank?: number | "dynamic";
}
/**
An instance of this is passed to completion source functions.
*/
declare class CompletionContext {
    /**
    The editor state that the completion happens in.
    */
    readonly state: EditorState;
    /**
    The position at which the completion is happening.
    */
    readonly pos: number;
    /**
    Indicates whether completion was activated explicitly, or
    implicitly by typing. The usual way to respond to this is to
    only return completions when either there is part of a
    completable entity before the cursor, or `explicit` is true.
    */
    readonly explicit: boolean;
    /**
    The editor view. May be undefined if the context was created
    in a situation where there is no such view available, such as
    in synchronous updates via
    [`CompletionResult.update`](https://codemirror.net/6/docs/ref/#autocomplete.CompletionResult.update)
    or when called by test code.
    */
    readonly view?: EditorView | undefined;
    /**
    Create a new completion context. (Mostly useful for testing
    completion sources—in the editor, the extension will create
    these for you.)
    */
    constructor(
    /**
    The editor state that the completion happens in.
    */
    state: EditorState, 
    /**
    The position at which the completion is happening.
    */
    pos: number, 
    /**
    Indicates whether completion was activated explicitly, or
    implicitly by typing. The usual way to respond to this is to
    only return completions when either there is part of a
    completable entity before the cursor, or `explicit` is true.
    */
    explicit: boolean, 
    /**
    The editor view. May be undefined if the context was created
    in a situation where there is no such view available, such as
    in synchronous updates via
    [`CompletionResult.update`](https://codemirror.net/6/docs/ref/#autocomplete.CompletionResult.update)
    or when called by test code.
    */
    view?: EditorView | undefined);
    /**
    Get the extent, content, and (if there is a token) type of the
    token before `this.pos`.
    */
    tokenBefore(types: readonly string[]): {
        from: number;
        to: number;
        text: string;
        type: NodeType;
    } | null;
    /**
    Get the match of the given expression directly before the
    cursor.
    */
    matchBefore(expr: RegExp): {
        from: number;
        to: number;
        text: string;
    } | null;
    /**
    Yields true when the query has been aborted. Can be useful in
    asynchronous queries to avoid doing work that will be ignored.
    */
    get aborted(): boolean;
    /**
    Allows you to register abort handlers, which will be called when
    the query is
    [aborted](https://codemirror.net/6/docs/ref/#autocomplete.CompletionContext.aborted).
    
    By default, running queries will not be aborted for regular
    typing or backspacing, on the assumption that they are likely to
    return a result with a
    [`validFor`](https://codemirror.net/6/docs/ref/#autocomplete.CompletionResult.validFor) field that
    allows the result to be used after all. Passing `onDocChange:
    true` will cause this query to be aborted for any document
    change.
    */
    addEventListener(type: "abort", listener: () => void, options?: {
        onDocChange: boolean;
    }): void;
}
/**
Given a a fixed array of options, return an autocompleter that
completes them.
*/
declare function completeFromList(list: readonly (string | Completion)[]): CompletionSource;
/**
Wrap the given completion source so that it will only fire when the
cursor is in a syntax node with one of the given names.
*/
declare function ifIn(nodes: readonly string[], source: CompletionSource): CompletionSource;
/**
Wrap the given completion source so that it will not fire when the
cursor is in a syntax node with one of the given names.
*/
declare function ifNotIn(nodes: readonly string[], source: CompletionSource): CompletionSource;
/**
The function signature for a completion source. Such a function
may return its [result](https://codemirror.net/6/docs/ref/#autocomplete.CompletionResult)
synchronously or as a promise. Returning null indicates no
completions are available.
*/
type CompletionSource = (context: CompletionContext) => CompletionResult | null | Promise<CompletionResult | null>;
/**
Interface for objects returned by completion sources.
*/
interface CompletionResult {
    /**
    The start of the range that is being completed.
    */
    from: number;
    /**
    The end of the range that is being completed. Defaults to the
    main cursor position.
    */
    to?: number;
    /**
    The completions returned. These don't have to be compared with
    the input by the source—the autocompletion system will do its
    own matching (against the text between `from` and `to`) and
    sorting.
    */
    options: readonly Completion[];
    /**
    When given, further typing or deletion that causes the part of
    the document between ([mapped](https://codemirror.net/6/docs/ref/#state.ChangeDesc.mapPos)) `from`
    and `to` to match this regular expression or predicate function
    will not query the completion source again, but continue with
    this list of options. This can help a lot with responsiveness,
    since it allows the completion list to be updated synchronously.
    */
    validFor?: RegExp | ((text: string, from: number, to: number, state: EditorState) => boolean);
    /**
    By default, the library filters and scores completions. Set
    `filter` to `false` to disable this, and cause your completions
    to all be included, in the order they were given. When there are
    other sources, unfiltered completions appear at the top of the
    list of completions. `validFor` must not be given when `filter`
    is `false`, because it only works when filtering.
    */
    filter?: boolean;
    /**
    When [`filter`](https://codemirror.net/6/docs/ref/#autocomplete.CompletionResult.filter) is set to
    `false` or a completion has a
    [`displayLabel`](https://codemirror.net/6/docs/ref/#autocomplete.Completion.displayLabel), this
    may be provided to compute the ranges on the label that match
    the input. Should return an array of numbers where each pair of
    adjacent numbers provide the start and end of a range. The
    second argument, the match found by the library, is only passed
    when `filter` isn't `false`.
    */
    getMatch?: (completion: Completion, matched?: readonly number[]) => readonly number[];
    /**
    Synchronously update the completion result after typing or
    deletion. If given, this should not do any expensive work, since
    it will be called during editor state updates. The function
    should make sure (similar to
    [`validFor`](https://codemirror.net/6/docs/ref/#autocomplete.CompletionResult.validFor)) that the
    completion still applies in the new state.
    */
    update?: (current: CompletionResult, from: number, to: number, context: CompletionContext) => CompletionResult | null;
    /**
    When results contain position-dependent information in, for
    example, `apply` methods, you can provide this method to update
    the result for transactions that happen after the query. It is
    not necessary to update `from` and `to`—those are tracked
    automatically.
    */
    map?: (current: CompletionResult, changes: ChangeDesc) => CompletionResult | null;
    /**
    Set a default set of [commit
    characters](https://codemirror.net/6/docs/ref/#autocomplete.Completion.commitCharacters) for all
    options in this result.
    */
    commitCharacters?: readonly string[];
}
/**
This annotation is added to transactions that are produced by
picking a completion.
*/
declare const pickedCompletion: AnnotationType<Completion>;
/**
Helper function that returns a transaction spec which inserts a
completion's text in the main selection range, and any other
selection range that has the same text in front of it.
*/
declare function insertCompletionText(state: EditorState, text: string, from: number, to: number): TransactionSpec;

interface CompletionConfig {
    /**
    When enabled (defaults to true), autocompletion will start
    whenever the user types something that can be completed.
    */
    activateOnTyping?: boolean;
    /**
    When given, if a completion that matches the predicate is
    picked, reactivate completion again as if it was typed normally.
    */
    activateOnCompletion?: (completion: Completion) => boolean;
    /**
    The amount of time to wait for further typing before querying
    completion sources via
    [`activateOnTyping`](https://codemirror.net/6/docs/ref/#autocomplete.autocompletion^config.activateOnTyping).
    Defaults to 100, which should be fine unless your completion
    source is very slow and/or doesn't use `validFor`.
    */
    activateOnTypingDelay?: number;
    /**
    By default, when completion opens, the first option is selected
    and can be confirmed with
    [`acceptCompletion`](https://codemirror.net/6/docs/ref/#autocomplete.acceptCompletion). When this
    is set to false, the completion widget starts with no completion
    selected, and the user has to explicitly move to a completion
    before you can confirm one.
    */
    selectOnOpen?: boolean;
    /**
    Override the completion sources used. By default, they will be
    taken from the `"autocomplete"` [language
    data](https://codemirror.net/6/docs/ref/#state.EditorState.languageDataAt) (which should hold
    [completion sources](https://codemirror.net/6/docs/ref/#autocomplete.CompletionSource) or arrays
    of [completions](https://codemirror.net/6/docs/ref/#autocomplete.Completion)).
    */
    override?: readonly CompletionSource[] | null;
    /**
    Determines whether the completion tooltip is closed when the
    editor loses focus. Defaults to true.
    */
    closeOnBlur?: boolean;
    /**
    The maximum number of options to render to the DOM.
    */
    maxRenderedOptions?: number;
    /**
    Set this to false to disable the [default completion
    keymap](https://codemirror.net/6/docs/ref/#autocomplete.completionKeymap). (This requires you to
    add bindings to control completion yourself. The bindings should
    probably have a higher precedence than other bindings for the
    same keys.)
    */
    defaultKeymap?: boolean;
    /**
    By default, completions are shown below the cursor when there is
    space. Setting this to true will make the extension put the
    completions above the cursor when possible.
    */
    aboveCursor?: boolean;
    /**
    When given, this may return an additional CSS class to add to
    the completion dialog element.
    */
    tooltipClass?: (state: EditorState) => string;
    /**
    This can be used to add additional CSS classes to completion
    options.
    */
    optionClass?: (completion: Completion) => string;
    /**
    By default, the library will render icons based on the
    completion's [type](https://codemirror.net/6/docs/ref/#autocomplete.Completion.type) in front of
    each option. Set this to false to turn that off.
    */
    icons?: boolean;
    /**
    This option can be used to inject additional content into
    options. The `render` function will be called for each visible
    completion, and should produce a DOM node to show. `position`
    determines where in the DOM the result appears, relative to
    other added widgets and the standard content. The default icons
    have position 20, the label position 50, and the detail position
    80.
    */
    addToOptions?: {
        render: (completion: Completion, state: EditorState, view: EditorView) => Node | null;
        position: number;
    }[];
    /**
    By default, [info](https://codemirror.net/6/docs/ref/#autocomplete.Completion.info) tooltips are
    placed to the side of the selected completion. This option can
    be used to override that. It will be given rectangles for the
    list of completions, the selected option, the info element, and
    the availble [tooltip
    space](https://codemirror.net/6/docs/ref/#view.tooltips^config.tooltipSpace), and should return
    style and/or class strings for the info element.
    */
    positionInfo?: (view: EditorView, list: Rect, option: Rect, info: Rect, space: Rect) => {
        style?: string;
        class?: string;
    };
    /**
    The comparison function to use when sorting completions with the same
    match score. Defaults to using
    [`localeCompare`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare).
    */
    compareCompletions?: (a: Completion, b: Completion) => number;
    /**
    When set to true (the default is false), turn off fuzzy matching
    of completions and only show those that start with the text the
    user typed. Only takes effect for results where
    [`filter`](https://codemirror.net/6/docs/ref/#autocomplete.CompletionResult.filter) isn't false.
    */
    filterStrict?: boolean;
    /**
    By default, commands relating to an open completion only take
    effect 75 milliseconds after the completion opened, so that key
    presses made before the user is aware of the tooltip don't go to
    the tooltip. This option can be used to configure that delay.
    */
    interactionDelay?: number;
    /**
    When there are multiple asynchronous completion sources, this
    controls how long the extension waits for a slow source before
    displaying results from faster sources. Defaults to 100
    milliseconds.
    */
    updateSyncTime?: number;
}

/**
Convert a snippet template to a function that can
[apply](https://codemirror.net/6/docs/ref/#autocomplete.Completion.apply) it. Snippets are written
using syntax like this:

    "for (let ${index} = 0; ${index} < ${end}; ${index}++) {\n\t${}\n}"

Each `${}` placeholder (you may also use `#{}`) indicates a field
that the user can fill in. Its name, if any, will be the default
content for the field.

When the snippet is activated by calling the returned function,
the code is inserted at the given position. Newlines in the
template are indented by the indentation of the start line, plus
one [indent unit](https://codemirror.net/6/docs/ref/#language.indentUnit) per tab character after
the newline.

On activation, (all instances of) the first field are selected.
The user can move between fields with Tab and Shift-Tab as long as
the fields are active. Moving to the last field or moving the
cursor out of the current field deactivates the fields.

The order of fields defaults to textual order, but you can add
numbers to placeholders (`${1}` or `${1:defaultText}`) to provide
a custom order.

To include a literal `{` or `}` in your template, put a backslash
in front of it. This will be removed and the brace will not be
interpreted as indicating a placeholder.
*/
declare function snippet(template: string): (editor: {
    state: EditorState;
    dispatch: (tr: Transaction) => void;
}, completion: Completion | null, from: number, to: number) => void;
/**
A command that clears the active snippet, if any.
*/
declare const clearSnippet: StateCommand;
/**
Move to the next snippet field, if available.
*/
declare const nextSnippetField: StateCommand;
/**
Move to the previous snippet field, if available.
*/
declare const prevSnippetField: StateCommand;
/**
Check if there is an active snippet with a next field for
`nextSnippetField` to move to.
*/
declare function hasNextSnippetField(state: EditorState): boolean;
/**
Returns true if there is an active snippet and a previous field
for `prevSnippetField` to move to.
*/
declare function hasPrevSnippetField(state: EditorState): boolean;
/**
A facet that can be used to configure the key bindings used by
snippets. The default binds Tab to
[`nextSnippetField`](https://codemirror.net/6/docs/ref/#autocomplete.nextSnippetField), Shift-Tab to
[`prevSnippetField`](https://codemirror.net/6/docs/ref/#autocomplete.prevSnippetField), and Escape
to [`clearSnippet`](https://codemirror.net/6/docs/ref/#autocomplete.clearSnippet).
*/
declare const snippetKeymap: Facet<readonly KeyBinding[], readonly KeyBinding[]>;
/**
Create a completion from a snippet. Returns an object with the
properties from `completion`, plus an `apply` function that
applies the snippet.
*/
declare function snippetCompletion(template: string, completion: Completion): Completion;

/**
Returns a command that moves the completion selection forward or
backward by the given amount.
*/
declare function moveCompletionSelection(forward: boolean, by?: "option" | "page"): Command;
/**
Accept the current completion.
*/
declare const acceptCompletion: Command;
/**
Explicitly start autocompletion.
*/
declare const startCompletion: Command;
/**
Close the currently active completion.
*/
declare const closeCompletion: Command;

/**
A completion source that will scan the document for words (using a
[character categorizer](https://codemirror.net/6/docs/ref/#state.EditorState.charCategorizer)), and
return those as completions.
*/
declare const completeAnyWord: CompletionSource;

/**
Configures bracket closing behavior for a syntax (via
[language data](https://codemirror.net/6/docs/ref/#state.EditorState.languageDataAt)) using the `"closeBrackets"`
identifier.
*/
interface CloseBracketConfig {
    /**
    The opening brackets to close. Defaults to `["(", "[", "{", "'",
    '"']`. Brackets may be single characters or a triple of quotes
    (as in `"'''"`).
    */
    brackets?: string[];
    /**
    Characters in front of which newly opened brackets are
    automatically closed. Closing always happens in front of
    whitespace. Defaults to `")]}:;>"`.
    */
    before?: string;
    /**
    When determining whether a given node may be a string, recognize
    these prefixes before the opening quote.
    */
    stringPrefixes?: string[];
}
/**
Extension to enable bracket-closing behavior. When a closeable
bracket is typed, its closing bracket is immediately inserted
after the cursor. When closing a bracket directly in front of a
closing bracket inserted by the extension, the cursor moves over
that bracket.
*/
declare function closeBrackets(): Extension;
/**
Command that implements deleting a pair of matching brackets when
the cursor is between them.
*/
declare const deleteBracketPair: StateCommand;
/**
Close-brackets related key bindings. Binds Backspace to
[`deleteBracketPair`](https://codemirror.net/6/docs/ref/#autocomplete.deleteBracketPair).
*/
declare const closeBracketsKeymap: readonly KeyBinding[];
/**
Implements the extension's behavior on text insertion. If the
given string counts as a bracket in the language around the
selection, and replacing the selection with it requires custom
behavior (inserting a closing version or skipping past a
previously-closed bracket), this function returns a transaction
representing that custom behavior. (You only need this if you want
to programmatically insert brackets—the
[`closeBrackets`](https://codemirror.net/6/docs/ref/#autocomplete.closeBrackets) extension will
take care of running this for user input.)
*/
declare function insertBracket(state: EditorState, bracket: string): Transaction | null;

/**
Returns an extension that enables autocompletion.
*/
declare function autocompletion(config?: CompletionConfig): Extension;
/**
Basic keybindings for autocompletion.

 - Ctrl-Space (and Alt-\` or Alt-i on macOS): [`startCompletion`](https://codemirror.net/6/docs/ref/#autocomplete.startCompletion)
 - Escape: [`closeCompletion`](https://codemirror.net/6/docs/ref/#autocomplete.closeCompletion)
 - ArrowDown: [`moveCompletionSelection`](https://codemirror.net/6/docs/ref/#autocomplete.moveCompletionSelection)`(true)`
 - ArrowUp: [`moveCompletionSelection`](https://codemirror.net/6/docs/ref/#autocomplete.moveCompletionSelection)`(false)`
 - PageDown: [`moveCompletionSelection`](https://codemirror.net/6/docs/ref/#autocomplete.moveCompletionSelection)`(true, "page")`
 - PageUp: [`moveCompletionSelection`](https://codemirror.net/6/docs/ref/#autocomplete.moveCompletionSelection)`(false, "page")`
 - Enter: [`acceptCompletion`](https://codemirror.net/6/docs/ref/#autocomplete.acceptCompletion)
*/
declare const completionKeymap: readonly KeyBinding[];
/**
Get the current completion status. When completions are available,
this will return `"active"`. When completions are pending (in the
process of being queried), this returns `"pending"`. Otherwise, it
returns `null`.
*/
declare function completionStatus(state: EditorState): null | "active" | "pending";
/**
Returns the available completions as an array.
*/
declare function currentCompletions(state: EditorState): readonly Completion[];
/**
Return the currently selected completion, if any.
*/
declare function selectedCompletion(state: EditorState): Completion | null;
/**
Returns the currently selected position in the active completion
list, or null if no completions are active.
*/
declare function selectedCompletionIndex(state: EditorState): number | null;
/**
Create an effect that can be attached to a transaction to change
the currently selected completion.
*/
declare function setSelectedCompletion(index: number): StateEffect<unknown>;

type index_d$1_CloseBracketConfig = CloseBracketConfig;
type index_d$1_Completion = Completion;
type index_d$1_CompletionContext = CompletionContext;
declare const index_d$1_CompletionContext: typeof CompletionContext;
type index_d$1_CompletionInfo = CompletionInfo;
type index_d$1_CompletionResult = CompletionResult;
type index_d$1_CompletionSection = CompletionSection;
type index_d$1_CompletionSource = CompletionSource;
declare const index_d$1_acceptCompletion: typeof acceptCompletion;
declare const index_d$1_autocompletion: typeof autocompletion;
declare const index_d$1_clearSnippet: typeof clearSnippet;
declare const index_d$1_closeBrackets: typeof closeBrackets;
declare const index_d$1_closeBracketsKeymap: typeof closeBracketsKeymap;
declare const index_d$1_closeCompletion: typeof closeCompletion;
declare const index_d$1_completeAnyWord: typeof completeAnyWord;
declare const index_d$1_completeFromList: typeof completeFromList;
declare const index_d$1_completionKeymap: typeof completionKeymap;
declare const index_d$1_completionStatus: typeof completionStatus;
declare const index_d$1_currentCompletions: typeof currentCompletions;
declare const index_d$1_deleteBracketPair: typeof deleteBracketPair;
declare const index_d$1_hasNextSnippetField: typeof hasNextSnippetField;
declare const index_d$1_hasPrevSnippetField: typeof hasPrevSnippetField;
declare const index_d$1_ifIn: typeof ifIn;
declare const index_d$1_ifNotIn: typeof ifNotIn;
declare const index_d$1_insertBracket: typeof insertBracket;
declare const index_d$1_insertCompletionText: typeof insertCompletionText;
declare const index_d$1_moveCompletionSelection: typeof moveCompletionSelection;
declare const index_d$1_nextSnippetField: typeof nextSnippetField;
declare const index_d$1_pickedCompletion: typeof pickedCompletion;
declare const index_d$1_prevSnippetField: typeof prevSnippetField;
declare const index_d$1_selectedCompletion: typeof selectedCompletion;
declare const index_d$1_selectedCompletionIndex: typeof selectedCompletionIndex;
declare const index_d$1_setSelectedCompletion: typeof setSelectedCompletion;
declare const index_d$1_snippet: typeof snippet;
declare const index_d$1_snippetCompletion: typeof snippetCompletion;
declare const index_d$1_snippetKeymap: typeof snippetKeymap;
declare const index_d$1_startCompletion: typeof startCompletion;
declare namespace index_d$1 {
  export { index_d$1_CompletionContext as CompletionContext, index_d$1_acceptCompletion as acceptCompletion, index_d$1_autocompletion as autocompletion, index_d$1_clearSnippet as clearSnippet, index_d$1_closeBrackets as closeBrackets, index_d$1_closeBracketsKeymap as closeBracketsKeymap, index_d$1_closeCompletion as closeCompletion, index_d$1_completeAnyWord as completeAnyWord, index_d$1_completeFromList as completeFromList, index_d$1_completionKeymap as completionKeymap, index_d$1_completionStatus as completionStatus, index_d$1_currentCompletions as currentCompletions, index_d$1_deleteBracketPair as deleteBracketPair, index_d$1_hasNextSnippetField as hasNextSnippetField, index_d$1_hasPrevSnippetField as hasPrevSnippetField, index_d$1_ifIn as ifIn, index_d$1_ifNotIn as ifNotIn, index_d$1_insertBracket as insertBracket, index_d$1_insertCompletionText as insertCompletionText, index_d$1_moveCompletionSelection as moveCompletionSelection, index_d$1_nextSnippetField as nextSnippetField, index_d$1_pickedCompletion as pickedCompletion, index_d$1_prevSnippetField as prevSnippetField, index_d$1_selectedCompletion as selectedCompletion, index_d$1_selectedCompletionIndex as selectedCompletionIndex, index_d$1_setSelectedCompletion as setSelectedCompletion, index_d$1_snippet as snippet, index_d$1_snippetCompletion as snippetCompletion, index_d$1_snippetKeymap as snippetKeymap, index_d$1_startCompletion as startCompletion };
  export type { index_d$1_CloseBracketConfig as CloseBracketConfig, index_d$1_Completion as Completion, index_d$1_CompletionInfo as CompletionInfo, index_d$1_CompletionResult as CompletionResult, index_d$1_CompletionSection as CompletionSection, index_d$1_CompletionSource as CompletionSource };
}

type HighlightOptions = {
    /**
    Determines whether, when nothing is selected, the word around
    the cursor is matched instead. Defaults to false.
    */
    highlightWordAroundCursor?: boolean;
    /**
    The minimum length of the selection before it is highlighted.
    Defaults to 1 (always highlight non-cursor selections).
    */
    minSelectionLength?: number;
    /**
    The amount of matches (in the viewport) at which to disable
    highlighting. Defaults to 100.
    */
    maxMatches?: number;
    /**
    Whether to only highlight whole words.
    */
    wholeWords?: boolean;
};
/**
This extension highlights text that matches the selection. It uses
the `"cm-selectionMatch"` class for the highlighting. When
`highlightWordAroundCursor` is enabled, the word at the cursor
itself will be highlighted with `"cm-selectionMatch-main"`.
*/
declare function highlightSelectionMatches(options?: HighlightOptions): Extension;
/**
Select next occurrence of the current selection. Expand selection
to the surrounding word when the selection is empty.
*/
declare const selectNextOccurrence: StateCommand;
/**
Default search-related key bindings.

 - Mod-f: [`openSearchPanel`](https://codemirror.net/6/docs/ref/#search.openSearchPanel)
 - F3, Mod-g: [`findNext`](https://codemirror.net/6/docs/ref/#search.findNext)
 - Shift-F3, Shift-Mod-g: [`findPrevious`](https://codemirror.net/6/docs/ref/#search.findPrevious)
 - Mod-Alt-g: [`gotoLine`](https://codemirror.net/6/docs/ref/#search.gotoLine)
 - Mod-d: [`selectNextOccurrence`](https://codemirror.net/6/docs/ref/#search.selectNextOccurrence)
*/
declare const searchKeymap: readonly KeyBinding[];

/**
An update is a set of changes and effects.
*/
interface Update {
    /**
    The changes made by this update.
    */
    changes: ChangeSet;
    /**
    The effects in this update. There'll only ever be effects here
    when you configure your collab extension with a
    [`sharedEffects`](https://codemirror.net/6/docs/ref/#collab.collab^config.sharedEffects) option.
    */
    effects?: readonly StateEffect<any>[];
    /**
    The [ID](https://codemirror.net/6/docs/ref/#collab.collab^config.clientID) of the client who
    created this update.
    */
    clientID: string;
}
type CollabConfig = {
    /**
    The starting document version. Defaults to 0.
    */
    startVersion?: number;
    /**
    This client's identifying [ID](https://codemirror.net/6/docs/ref/#collab.getClientID). Will be a
    randomly generated string if not provided.
    */
    clientID?: string;
    /**
    It is possible to share information other than document changes
    through this extension. If you provide this option, your
    function will be called on each transaction, and the effects it
    returns will be sent to the server, much like changes are. Such
    effects are automatically remapped when conflicting remote
    changes come in.
    */
    sharedEffects?: (tr: Transaction) => readonly StateEffect<any>[];
};
/**
Create an instance of the collaborative editing plugin.
*/
declare function collab(config?: CollabConfig): Extension;
/**
Create a transaction that represents a set of new updates received
from the authority. Applying this transaction moves the state
forward to adjust to the authority's view of the document.
*/
declare function receiveUpdates(state: EditorState, updates: readonly Update[]): Transaction;
/**
Returns the set of locally made updates that still have to be sent
to the authority. The returned objects will also have an `origin`
property that points at the transaction that created them. This
may be useful if you want to send along metadata like timestamps.
(But note that the updates may have been mapped in the meantime,
whereas the transaction is just the original transaction that
created them.)
*/
declare function sendableUpdates(state: EditorState): readonly (Update & {
    origin: Transaction;
})[];
/**
Get the version up to which the collab plugin has synced with the
central authority.
*/
declare function getSyncedVersion(state: EditorState): number;
/**
Get this editor's collaborative editing client ID.
*/
declare function getClientID(state: EditorState): string;

type Severity = "hint" | "info" | "warning" | "error";
/**
Describes a problem or hint for a piece of code.
*/
interface Diagnostic {
    /**
    The start position of the relevant text.
    */
    from: number;
    /**
    The end position. May be equal to `from`, though actually
    covering text is preferable.
    */
    to: number;
    /**
    The severity of the problem. This will influence how it is
    displayed.
    */
    severity: Severity;
    /**
    When given, add an extra CSS class to parts of the code that
    this diagnostic applies to.
    */
    markClass?: string;
    /**
    An optional source string indicating where the diagnostic is
    coming from. You can put the name of your linter here, if
    applicable.
    */
    source?: string;
    /**
    The message associated with this diagnostic.
    */
    message: string;
    /**
    An optional custom rendering function that displays the message
    as a DOM node.
    */
    renderMessage?: (view: EditorView) => Node;
    /**
    An optional array of actions that can be taken on this
    diagnostic.
    */
    actions?: readonly Action[];
}
/**
An action associated with a diagnostic.
*/
interface Action {
    /**
    The label to show to the user. Should be relatively short.
    */
    name: string;
    /**
    When given, add an extra CSS class to the action button.
    */
    markClass?: string;
    /**
    The function to call when the user activates this action. Is
    given the diagnostic's _current_ position, which may have
    changed since the creation of the diagnostic, due to editing.
    */
    apply: (view: EditorView, from: number, to: number) => void;
}
type DiagnosticFilter = (diagnostics: readonly Diagnostic[], state: EditorState) => Diagnostic[];
interface LintConfig {
    /**
    Time to wait (in milliseconds) after a change before running
    the linter. Defaults to 750ms.
    */
    delay?: number;
    /**
    Optional predicate that can be used to indicate when diagnostics
    need to be recomputed. Linting is always re-done on document
    changes.
    */
    needsRefresh?: null | ((update: ViewUpdate) => boolean);
    /**
    Optional filter to determine which diagnostics produce markers
    in the content.
    */
    markerFilter?: null | DiagnosticFilter;
    /**
    Filter applied to a set of diagnostics shown in a tooltip. No
    tooltip will appear if the empty set is returned.
    */
    tooltipFilter?: null | DiagnosticFilter;
    /**
    Can be used to control what kind of transactions cause lint
    hover tooltips associated with the given document range to be
    hidden. By default any transactions that changes the line
    around the range will hide it. Returning null falls back to this
    behavior.
    */
    hideOn?: (tr: Transaction, from: number, to: number) => boolean | null;
    /**
    When enabled (defaults to off), this will cause the lint panel
    to automatically open when diagnostics are found, and close when
    all diagnostics are resolved or removed.
    */
    autoPanel?: boolean;
}
/**
Returns a transaction spec which updates the current set of
diagnostics, and enables the lint extension if if wasn't already
active.
*/
declare function setDiagnostics(state: EditorState, diagnostics: readonly Diagnostic[]): TransactionSpec;
/**
The type of a function that produces diagnostics.
*/
type LintSource = (view: EditorView) => readonly Diagnostic[] | Promise<readonly Diagnostic[]>;
/**
Given a diagnostic source, this function returns an extension that
enables linting with that source. It will be called whenever the
editor is idle (after its content changed).

Note that settings given here will apply to all linters active in
the editor. If `null` is given as source, this only configures the
lint extension.
*/
declare function linter(source: LintSource | null, config?: LintConfig): Extension;

type JuliaLanguageConfig = {
    /** Enable keyword completion */
    enableKeywordCompletion?: boolean;
};
declare function julia(config?: JuliaLanguageConfig): LanguageSupport;

/**
Data structure used to accumulate a block's content during [leaf
block parsing](#BlockParser.leaf).
*/
declare class LeafBlock {
    /**
    The start position of the block.
    */
    readonly start: number;
    /**
    The block's text content.
    */
    content: string;
    /**
    The block parsers active for this block.
    */
    parsers: LeafBlockParser[];
}
/**
Data structure used during block-level per-line parsing.
*/
declare class Line {
    /**
    The line's full text.
    */
    text: string;
    /**
    The base indent provided by the composite contexts (that have
    been handled so far).
    */
    baseIndent: number;
    /**
    The string position corresponding to the base indent.
    */
    basePos: number;
    /**
    The position of the next non-whitespace character beyond any
    list, blockquote, or other composite block markers.
    */
    pos: number;
    /**
    The column of the next non-whitespace character.
    */
    indent: number;
    /**
    The character code of the character after `pos`.
    */
    next: number;
    /**
    Skip whitespace after the given position, return the position of
    the next non-space character or the end of the line if there's
    only space after `from`.
    */
    skipSpace(from: number): number;
    /**
    Move the line's base position forward to the given position.
    This should only be called by composite [block
    parsers](#BlockParser.parse) or [markup skipping
    functions](#NodeSpec.composite).
    */
    moveBase(to: number): void;
    /**
    Move the line's base position forward to the given _column_.
    */
    moveBaseColumn(indent: number): void;
    /**
    Store a composite-block-level marker. Should be called from
    [markup skipping functions](#NodeSpec.composite) when they
    consume any non-whitespace characters.
    */
    addMarker(elt: Element$1): void;
    /**
    Find the column position at `to`, optionally starting at a given
    position and column.
    */
    countIndent(to: number, from?: number, indent?: number): number;
    /**
    Find the position corresponding to the given column.
    */
    findColumn(goal: number): number;
}
type BlockResult = boolean | null;
/**
Block-level parsing functions get access to this context object.
*/
declare class BlockContext implements PartialParse {
    /**
    The parser configuration used.
    */
    readonly parser: MarkdownParser;
    private line;
    private atEnd;
    private fragments;
    private to;
    stoppedAt: number | null;
    /**
    The start of the current line.
    */
    lineStart: number;
    get parsedPos(): number;
    advance(): Tree | null;
    stopAt(pos: number): void;
    private reuseFragment;
    /**
    The number of parent blocks surrounding the current block.
    */
    get depth(): number;
    /**
    Get the type of the parent block at the given depth. When no
    depth is passed, return the type of the innermost parent.
    */
    parentType(depth?: number): NodeType;
    /**
    Move to the next input line. This should only be called by
    (non-composite) [block parsers](#BlockParser.parse) that consume
    the line directly, or leaf block parser
    [`nextLine`](#LeafBlockParser.nextLine) methods when they
    consume the current line (and return true).
    */
    nextLine(): boolean;
    /**
    Retrieve the text of the line after the current one, without
    actually moving the context's current line forward.
    */
    peekLine(): string;
    private moveRangeI;
    private lineChunkAt;
    /**
    The end position of the previous line.
    */
    prevLineEnd(): number;
    /**
    Start a composite block. Should only be called from [block
    parser functions](#BlockParser.parse) that return null.
    */
    startComposite(type: string, start: number, value?: number): void;
    /**
    Add a block element. Can be called by [block
    parsers](#BlockParser.parse).
    */
    addElement(elt: Element$1): void;
    /**
    Add a block element from a [leaf parser](#LeafBlockParser). This
    makes sure any extra composite block markup (such as blockquote
    markers) inside the block are also added to the syntax tree.
    */
    addLeafElement(leaf: LeafBlock, elt: Element$1): void;
    private finish;
    private addGaps;
    /**
    Create an [`Element`](#Element) object to represent some syntax
    node.
    */
    elt(type: string, from: number, to: number, children?: readonly Element$1[]): Element$1;
    elt(tree: Tree, at: number): Element$1;
}
/**
Used in the [configuration](#MarkdownConfig.defineNodes) to define
new [syntax node
types](https://lezer.codemirror.net/docs/ref/#common.NodeType).
*/
interface NodeSpec {
    /**
    The node's name.
    */
    name: string;
    /**
    Should be set to true if this type represents a block node.
    */
    block?: boolean;
    /**
    If this is a composite block, this should hold a function that,
    at the start of a new line where that block is active, checks
    whether the composite block should continue (return value) and
    optionally [adjusts](#Line.moveBase) the line's base position
    and [registers](#Line.addMarker) nodes for any markers involved
    in the block's syntax.
    */
    composite?(cx: BlockContext, line: Line, value: number): boolean;
    /**
    Add highlighting tag information for this node. The value of
    this property may either by a tag or array of tags to assign
    directly to this node, or an object in the style of
    [`styleTags`](https://lezer.codemirror.net/docs/ref/#highlight.styleTags)'s
    argument to assign more complicated rules.
    */
    style?: Tag | readonly Tag[] | {
        [selector: string]: Tag | readonly Tag[];
    };
}
/**
Inline parsers are called for every character of parts of the
document that are parsed as inline content.
*/
interface InlineParser {
    /**
    This parser's name, which can be used by other parsers to
    [indicate](#InlineParser.before) a relative precedence.
    */
    name: string;
    /**
    The parse function. Gets the next character and its position as
    arguments. Should return -1 if it doesn't handle the character,
    or add some [element](#InlineContext.addElement) or
    [delimiter](#InlineContext.addDelimiter) and return the end
    position of the content it parsed if it can.
    */
    parse(cx: InlineContext, next: number, pos: number): number;
    /**
    When given, this parser will be installed directly before the
    parser with the given name. The default configuration defines
    inline parsers with names Escape, Entity, InlineCode, HTMLTag,
    Emphasis, HardBreak, Link, and Image. When no `before` or
    `after` property is given, the parser is added to the end of the
    list.
    */
    before?: string;
    /**
    When given, the parser will be installed directly _after_ the
    parser with the given name.
    */
    after?: string;
}
/**
Block parsers handle block-level structure. There are three
general types of block parsers:

- Composite block parsers, which handle things like lists and
  blockquotes. These define a [`parse`](#BlockParser.parse) method
  that [starts](#BlockContext.startComposite) a composite block
  and returns null when it recognizes its syntax. The node type
  used by such a block must define a
  [`composite`](#NodeSpec.composite) function as well.

- Eager leaf block parsers, used for things like code or HTML
  blocks. These can unambiguously recognize their content from its
  first line. They define a [`parse`](#BlockParser.parse) method
  that, if it recognizes the construct,
  [moves](#BlockContext.nextLine) the current line forward to the
  line beyond the end of the block,
  [add](#BlockContext.addElement) a syntax node for the block, and
  return true.

- Leaf block parsers that observe a paragraph-like construct as it
  comes in, and optionally decide to handle it at some point. This
  is used for "setext" (underlined) headings and link references.
  These define a [`leaf`](#BlockParser.leaf) method that checks
  the first line of the block and returns a
  [`LeafBlockParser`](#LeafBlockParser) object if it wants to
  observe that block.
*/
interface BlockParser {
    /**
    The name of the parser. Can be used by other block parsers to
    [specify](#BlockParser.before) precedence.
    */
    name: string;
    /**
    The eager parse function, which can look at the block's first
    line and return `false` to do nothing, `true` if it has parsed
    (and [moved past](#BlockContext.nextLine) a block), or `null` if
    it has [started](#BlockContext.startComposite) a composite block.
    */
    parse?(cx: BlockContext, line: Line): BlockResult;
    /**
    A leaf parse function. If no [regular](#BlockParser.parse) parse
    functions match for a given line, its content will be
    accumulated for a paragraph-style block. This method can return
    an [object](#LeafBlockParser) that overrides that style of
    parsing in some situations.
    */
    leaf?(cx: BlockContext, leaf: LeafBlock): LeafBlockParser | null;
    /**
    Some constructs, such as code blocks or newly started
    blockquotes, can interrupt paragraphs even without a blank line.
    If your construct can do this, provide a predicate here that
    recognizes lines that should end a paragraph (or other non-eager
    [leaf block](#BlockParser.leaf)).
    */
    endLeaf?(cx: BlockContext, line: Line, leaf: LeafBlock): boolean;
    /**
    When given, this parser will be installed directly before the
    block parser with the given name. The default configuration
    defines block parsers with names LinkReference, IndentedCode,
    FencedCode, Blockquote, HorizontalRule, BulletList, OrderedList,
    ATXHeading, HTMLBlock, and SetextHeading.
    */
    before?: string;
    /**
    When given, the parser will be installed directly _after_ the
    parser with the given name.
    */
    after?: string;
}
/**
Objects that are used to [override](#BlockParser.leaf)
paragraph-style blocks should conform to this interface.
*/
interface LeafBlockParser {
    /**
    Update the parser's state for the next line, and optionally
    finish the block. This is not called for the first line (the
    object is constructed at that line), but for any further lines.
    When it returns `true`, the block is finished. It is okay for
    the function to [consume](#BlockContext.nextLine) the current
    line or any subsequent lines when returning true.
    */
    nextLine(cx: BlockContext, line: Line, leaf: LeafBlock): boolean;
    /**
    Called when the block is finished by external circumstances
    (such as a blank line or the [start](#BlockParser.endLeaf) of
    another construct). If this parser can handle the block up to
    its current position, it should
    [finish](#BlockContext.addLeafElement) the block and return
    true.
    */
    finish(cx: BlockContext, leaf: LeafBlock): boolean;
}
/**
Objects of this type are used to
[configure](#MarkdownParser.configure) the Markdown parser.
*/
interface MarkdownConfig {
    /**
    Node props to add to the parser's node set.
    */
    props?: readonly NodePropSource[];
    /**
    Define new [node types](#NodeSpec) for use in parser extensions.
    */
    defineNodes?: readonly (string | NodeSpec)[];
    /**
    Define additional [block parsing](#BlockParser) logic.
    */
    parseBlock?: readonly BlockParser[];
    /**
    Define new [inline parsing](#InlineParser) logic.
    */
    parseInline?: readonly InlineParser[];
    /**
    Remove the named parsers from the configuration.
    */
    remove?: readonly string[];
    /**
    Add a parse wrapper (such as a [mixed-language
    parser](#common.parseMixed)) to this parser.
    */
    wrap?: ParseWrapper;
}
/**
To make it possible to group extensions together into bigger
extensions (such as the [Github-flavored Markdown](#GFM)
extension), [reconfiguration](#MarkdownParser.configure) accepts
nested arrays of [config](#MarkdownConfig) objects.
*/
type MarkdownExtension = MarkdownConfig | readonly MarkdownExtension[];
/**
A Markdown parser configuration.
*/
declare class MarkdownParser extends Parser {
    /**
    The parser's syntax [node
    types](https://lezer.codemirror.net/docs/ref/#common.NodeSet).
    */
    readonly nodeSet: NodeSet;
    createParse(input: Input, fragments: readonly TreeFragment[], ranges: readonly {
        from: number;
        to: number;
    }[]): PartialParse;
    /**
    Reconfigure the parser.
    */
    configure(spec: MarkdownExtension): MarkdownParser;
    /**
    Parse the given piece of inline text at the given offset,
    returning an array of [`Element`](#Element) objects representing
    the inline content.
    */
    parseInline(text: string, offset: number): Element$1[];
}
/**
Elements are used to compose syntax nodes during parsing.
*/
declare class Element$1 {
    /**
    The node's
    [id](https://lezer.codemirror.net/docs/ref/#common.NodeType.id).
    */
    readonly type: number;
    /**
    The start of the node, as an offset from the start of the document.
    */
    readonly from: number;
    /**
    The end of the node.
    */
    readonly to: number;
}
/**
Delimiters are used during inline parsing to store the positions
of things that _might_ be delimiters, if another matching
delimiter is found. They are identified by objects with these
properties.
*/
interface DelimiterType {
    /**
    If this is given, the delimiter should be matched automatically
    when a piece of inline content is finished. Such delimiters will
    be matched with delimiters of the same type according to their
    [open and close](#InlineContext.addDelimiter) properties. When a
    match is found, the content between the delimiters is wrapped in
    a node whose name is given by the value of this property.
    
    When this isn't given, you need to match the delimiter eagerly
    using the [`findOpeningDelimiter`](#InlineContext.findOpeningDelimiter)
    and [`takeContent`](#InlineContext.takeContent) methods.
    */
    resolve?: string;
    /**
    If the delimiter itself should, when matched, create a syntax
    node, set this to the name of the syntax node.
    */
    mark?: string;
}
/**
Inline parsing functions get access to this context, and use it to
read the content and emit syntax nodes.
*/
declare class InlineContext {
    /**
    The parser that is being used.
    */
    readonly parser: MarkdownParser;
    /**
    The text of this inline section.
    */
    readonly text: string;
    /**
    The starting offset of the section in the document.
    */
    readonly offset: number;
    /**
    Get the character code at the given (document-relative)
    position.
    */
    char(pos: number): number;
    /**
    The position of the end of this inline section.
    */
    get end(): number;
    /**
    Get a substring of this inline section. Again uses
    document-relative positions.
    */
    slice(from: number, to: number): string;
    /**
    Add a [delimiter](#DelimiterType) at this given position. `open`
    and `close` indicate whether this delimiter is opening, closing,
    or both. Returns the end of the delimiter, for convenient
    returning from [parse functions](#InlineParser.parse).
    */
    addDelimiter(type: DelimiterType, from: number, to: number, open: boolean, close: boolean): number;
    /**
    Returns true when there is an unmatched link or image opening
    token before the current position.
    */
    get hasOpenLink(): boolean;
    /**
    Add an inline element. Returns the end of the element.
    */
    addElement(elt: Element$1): number;
    /**
    Find an opening delimiter of the given type. Returns `null` if
    no delimiter is found, or an index that can be passed to
    [`takeContent`](#InlineContext.takeContent) otherwise.
    */
    findOpeningDelimiter(type: DelimiterType): number | null;
    /**
    Remove all inline elements and delimiters starting from the
    given index (which you should get from
    [`findOpeningDelimiter`](#InlineContext.findOpeningDelimiter),
    resolve delimiters inside of them, and return them as an array
    of elements.
    */
    takeContent(startIndex: number): Element$1[];
    /**
    Return the delimiter at the given index. Mostly useful to get
    additional info out of a delimiter index returned by
    [`findOpeningDelimiter`](#InlineContext.findOpeningDelimiter).
    Returns null if there is no delimiter at this index.
    */
    getDelimiterAt(index: number): {
        from: number;
        to: number;
        type: DelimiterType;
    } | null;
    /**
    Skip space after the given (document) position, returning either
    the position of the next non-space character or the end of the
    section.
    */
    skipSpace(from: number): number;
    /**
    Create an [`Element`](#Element) for a syntax node.
    */
    elt(type: string, from: number, to: number, children?: readonly Element$1[]): Element$1;
    elt(tree: Tree, at: number): Element$1;
    /**
    The opening delimiter type used by the standard link parser.
    */
    static linkStart: DelimiterType;
    /**
    Opening delimiter type used for standard images.
    */
    static imageStart: DelimiterType;
}

/**
Create a Markdown extension to enable nested parsing on code
blocks and/or embedded HTML.
*/
declare function parseCode(config: {
    /**
    When provided, this will be used to parse the content of code
    blocks. `info` is the string after the opening ` ``` ` marker,
    or the empty string if there is no such info or this is an
    indented code block. If there is a parser available for the
    code, it should return a function that can construct the
    [parse](https://lezer.codemirror.net/docs/ref/#common.PartialParse).
    */
    codeParser?: (info: string) => null | Parser;
    /**
    The parser used to parse HTML tags (both block and inline).
    */
    htmlParser?: Parser;
}): MarkdownExtension;

/**
Language support for [GFM](https://github.github.com/gfm/) plus
subscript, superscript, and emoji syntax.
*/
declare const markdownLanguage: Language;
/**
Markdown language support.
*/
declare function markdown(config?: {
    /**
    When given, this language will be used by default to parse code
    blocks.
    */
    defaultCodeLanguage?: Language | LanguageSupport;
    /**
    A source of language support for highlighting fenced code
    blocks. When it is an array, the parser will use
    [`LanguageDescription.matchLanguageName`](https://codemirror.net/6/docs/ref/#language.LanguageDescription^matchLanguageName)
    with the fenced code info to find a matching language. When it
    is a function, will be called with the info string and may
    return a language or `LanguageDescription` object.
    */
    codeLanguages?: readonly LanguageDescription[] | ((info: string) => Language | LanguageDescription | null);
    /**
    Set this to false to disable installation of the Markdown
    [keymap](https://codemirror.net/6/docs/ref/#lang-markdown.markdownKeymap).
    */
    addKeymap?: boolean;
    /**
    Markdown parser
    [extensions](https://github.com/lezer-parser/markdown#user-content-markdownextension)
    to add to the parser.
    */
    extensions?: MarkdownExtension;
    /**
    The base language to use. Defaults to
    [`commonmarkLanguage`](https://codemirror.net/6/docs/ref/#lang-markdown.commonmarkLanguage).
    */
    base?: Language;
    /**
    By default, the extension installs an autocompletion source that
    completes HTML tags when a `<` is typed. Set this to false to
    disable this.
    */
    completeHTMLTags?: boolean;
    /**
    The returned language contains
    [`pasteURLAsLink`](https://codemirror.net/6/docs/ref/#lang-markdown.pasteURLAsLink) as a support
    extension unless you set this to false.
    */
    pasteURLAsLink?: boolean;
    /**
    By default, HTML tags in the document are handled by the [HTML
    language](https://github.com/codemirror/lang-html) package with
    tag matching turned off. You can pass in an alternative language
    configuration here if you want.
    */
    htmlTagLanguage?: LanguageSupport;
}): LanguageSupport;

/**
Type used to specify tags to complete.
*/
interface TagSpec {
    /**
    Define tag-specific attributes. Property names are attribute
    names, and property values can be null to indicate free-form
    attributes, or a list of strings for suggested attribute values.
    */
    attrs?: Record<string, null | readonly string[]>;
    /**
    When set to false, don't complete global attributes on this tag.
    */
    globalAttrs?: boolean;
    /**
    Can be used to specify a list of child tags that are valid
    inside this tag. The default is to allow any tag.
    */
    children?: readonly string[];
}

type NestedLang = {
    tag: string;
    attrs?: (attrs: {
        [attr: string]: string;
    }) => boolean;
    parser: Parser;
};
type NestedAttr = {
    name: string;
    tagName?: string;
    parser: Parser;
};
/**
A language provider based on the [Lezer HTML
parser](https://github.com/lezer-parser/html), extended with the
JavaScript and CSS parsers to parse the content of `<script>` and
`<style>` tags.
*/
declare const htmlLanguage: LRLanguage;
/**
Language support for HTML, including
[`htmlCompletion`](https://codemirror.net/6/docs/ref/#lang-html.htmlCompletion) and JavaScript and
CSS support extensions.
*/
declare function html(config?: {
    /**
    By default, the syntax tree will highlight mismatched closing
    tags. Set this to `false` to turn that off (for example when you
    expect to only be parsing a fragment of HTML text, not a full
    document).
    */
    matchClosingTags?: boolean;
    /**
    By default, the parser does not allow arbitrary self-closing tags.
    Set this to `true` to turn on support for `/>` self-closing tag
    syntax.
    */
    selfClosingTags?: boolean;
    /**
    Determines whether [`autoCloseTags`](https://codemirror.net/6/docs/ref/#lang-html.autoCloseTags)
    is included in the support extensions. Defaults to true.
    */
    autoCloseTags?: boolean;
    /**
    Add additional tags that can be completed.
    */
    extraTags?: Record<string, TagSpec>;
    /**
    Add additional completable attributes to all tags.
    */
    extraGlobalAttributes?: Record<string, null | readonly string[]>;
    /**
    Register additional languages to parse the content of specific
    tags. If given, `attrs` should be a function that, given an
    object representing the tag's attributes, returns `true` if this
    language applies.
    */
    nestedLanguages?: NestedLang[];
    /**
    Register additional languages to parse attribute values with.
    */
    nestedAttributes?: NestedAttr[];
}): LanguageSupport;

/**
A language provider based on the [Lezer CSS
parser](https://github.com/lezer-parser/css), extended with
highlighting and indentation information.
*/
declare const cssLanguage: LRLanguage;
/**
Language support for CSS.
*/
declare function css(): LanguageSupport;

/**
A language provider based on the [Lezer JavaScript
parser](https://github.com/lezer-parser/javascript), extended with
highlighting and indentation information.
*/
declare const javascriptLanguage: LRLanguage;
/**
JavaScript support. Includes [snippet](https://codemirror.net/6/docs/ref/#lang-javascript.snippets)
and local variable completion.
*/
declare function javascript(config?: {
    jsx?: boolean;
    typescript?: boolean;
}): LanguageSupport;

/**
Configuration for an [SQL Dialect](https://codemirror.net/6/docs/ref/#lang-sql.SQLDialect).
*/
type SQLDialectSpec = {
    /**
    A space-separated list of keywords for the dialect.
    */
    keywords?: string;
    /**
    A space-separated string of built-in identifiers for the dialect.
    */
    builtin?: string;
    /**
    A space-separated string of type names for the dialect.
    */
    types?: string;
    /**
    Controls whether regular strings allow backslash escapes.
    */
    backslashEscapes?: boolean;
    /**
    Controls whether # creates a line comment.
    */
    hashComments?: boolean;
    /**
    Controls whether `//` creates a line comment.
    */
    slashComments?: boolean;
    /**
    When enabled `--` comments are only recognized when there's a
    space after the dashes.
    */
    spaceAfterDashes?: boolean;
    /**
    When enabled, things quoted with "$$" are treated as
    strings, rather than identifiers.
    */
    doubleDollarQuotedStrings?: boolean;
    /**
    When enabled, things quoted with double quotes are treated as
    strings, rather than identifiers.
    */
    doubleQuotedStrings?: boolean;
    /**
    Enables strings like `_utf8'str'` or `N'str'`.
    */
    charSetCasts?: boolean;
    /**
    Enables string quoting syntax like `q'[str]'`, as used in
    PL/SQL.
    */
    plsqlQuotingMechanism?: boolean;
    /**
    The set of characters that make up operators. Defaults to
    `"*+\-%<>!=&|~^/"`.
    */
    operatorChars?: string;
    /**
    The set of characters that start a special variable name.
    Defaults to `"?"`.
    */
    specialVar?: string;
    /**
    The characters that can be used to quote identifiers. Defaults
    to `"\""`. Add `[` for MSSQL-style bracket quoted identifiers.
    */
    identifierQuotes?: string;
    /**
    Controls whether identifiers are case-insensitive. Identifiers
    with upper-case letters are quoted when set to false (which is
    the default).
    */
    caseInsensitiveIdentifiers?: boolean;
    /**
    Controls whether bit values can be defined as 0b1010. Defaults
    to false.
    */
    unquotedBitLiterals?: boolean;
    /**
    Controls whether bit values can contain other characters than 0 and 1.
    Defaults to false.
    */
    treatBitsAsBytes?: boolean;
};
/**
Represents an SQL dialect.
*/
declare class SQLDialect {
    /**
    The language for this dialect.
    */
    readonly language: LRLanguage;
    /**
    The spec used to define this dialect.
    */
    readonly spec: SQLDialectSpec;
    private constructor();
    /**
    Returns the language for this dialect as an extension.
    */
    get extension(): Extension;
    /**
    Reconfigure the parser used by this dialect. Returns a new
    dialect object.
    */
    configureLanguage(options: ParserConfig, name?: string): SQLDialect;
    /**
    Define a new dialect.
    */
    static define(spec: SQLDialectSpec): SQLDialect;
}
/**
The type used to describe a level of the schema for
[completion](https://codemirror.net/6/docs/ref/#lang-sql.SQLConfig.schema). Can be an array of
options (columns), an object mapping table or schema names to
deeper levels, or a `{self, children}` object that assigns a
completion option to use for its parent property, when the default option
(its name as label and type `"type"`) isn't suitable.
*/
type SQLNamespace = {
    [name: string]: SQLNamespace;
} | {
    self: Completion;
    children: SQLNamespace;
} | readonly (Completion | string)[];
/**
Options used to configure an SQL extension.
*/
interface SQLConfig {
    /**
    The [dialect](https://codemirror.net/6/docs/ref/#lang-sql.SQLDialect) to use. Defaults to
    [`StandardSQL`](https://codemirror.net/6/docs/ref/#lang-sql.StandardSQL).
    */
    dialect?: SQLDialect;
    /**
    You can use this to define the schemas, tables, and their fields
    for autocompletion.
    */
    schema?: SQLNamespace;
    /**
    @hide
    */
    tables?: readonly Completion[];
    /**
    @hide
    */
    schemas?: readonly Completion[];
    /**
    When given, columns from the named table can be completed
    directly at the top level.
    */
    defaultTable?: string;
    /**
    When given, tables prefixed with this schema name can be
    completed directly at the top level.
    */
    defaultSchema?: string;
    /**
    When set to true, keyword completions will be upper-case.
    */
    upperCaseKeywords?: boolean;
    /**
    Can be used to customize the completions generated for keywords.
    */
    keywordCompletion?: (label: string, type: string) => Completion;
}
/**
SQL language support for the given SQL dialect, with keyword
completion, and, if provided, schema-based completion as extra
extensions.
*/
declare function sql(config?: SQLConfig): LanguageSupport;
/**
Dialect for [PostgreSQL](https://www.postgresql.org).
*/
declare const PostgreSQL: SQLDialect;

/**
A language provider based on the [Lezer Python
parser](https://github.com/lezer-parser/python), extended with
highlighting and indentation information.
*/
declare const pythonLanguage: LRLanguage;
/**
Python language support.
*/
declare function python(): LanguageSupport;

/**
A changed range.
*/
declare class Change {
    /**
    The start of the change in document A.
    */
    readonly fromA: number;
    /**
    The end of the change in document A. This is equal to `fromA`
    in case of insertions.
    */
    readonly toA: number;
    /**
    The start of the change in document B.
    */
    readonly fromB: number;
    /**
    The end of the change in document B. This is equal to `fromB`
    for deletions.
    */
    readonly toB: number;
    constructor(
    /**
    The start of the change in document A.
    */
    fromA: number, 
    /**
    The end of the change in document A. This is equal to `fromA`
    in case of insertions.
    */
    toA: number, 
    /**
    The start of the change in document B.
    */
    fromB: number, 
    /**
    The end of the change in document B. This is equal to `fromB`
    for deletions.
    */
    toB: number);
}
/**
Options passed to diffing functions.
*/
interface DiffConfig {
    /**
    When given, this limits the depth of full (expensive) diff
    computations, causing them to give up and fall back to a faster
    but less precise approach when there is more than this many
    changed characters in a scanned range. This should help avoid
    quadratic running time on large, very different inputs.
    */
    scanLimit?: number;
    /**
    When set, this makes the algorithm periodically check how long
    it has been running, and if it has taken more than the given
    number of milliseconds, it aborts detailed diffing in falls back
    to the imprecise algorithm.
    */
    timeout?: number;
}
/**
Compute the difference between two strings.
*/
declare function diff(a: string, b: string, config?: DiffConfig): readonly Change[];
/**
Compute the difference between the given strings, and clean up the
resulting diff for presentation to users by dropping short
unchanged ranges, and aligning changes to word boundaries when
appropriate.
*/
declare function presentableDiff(a: string, b: string, config?: DiffConfig): readonly Change[];

/**
A chunk describes a range of lines which have changed content in
them. Either side (a/b) may either be empty (when its `to` is
equal to its `from`), or points at a range starting at the start
of the first changed line, to 1 past the end of the last changed
line. Note that `to` positions may point past the end of the
document. Use `endA`/`endB` if you need an end position that is
certain to be a valid document position.
*/
declare class Chunk {
    /**
    The individual changes inside this chunk. These are stored
    relative to the start of the chunk, so you have to add
    `chunk.fromA`/`fromB` to get document positions.
    */
    readonly changes: readonly Change[];
    /**
    The start of the chunk in document A.
    */
    readonly fromA: number;
    /**
    The end of the chunk in document A. This is equal to `fromA`
    when the chunk covers no lines in document A, or is one unit
    past the end of the last line in the chunk if it does.
    */
    readonly toA: number;
    /**
    The start of the chunk in document B.
    */
    readonly fromB: number;
    /**
    The end of the chunk in document A.
    */
    readonly toB: number;
    /**
    This is set to false when the diff used to compute this chunk
    fell back to fast, imprecise diffing.
    */
    readonly precise: boolean;
    constructor(
    /**
    The individual changes inside this chunk. These are stored
    relative to the start of the chunk, so you have to add
    `chunk.fromA`/`fromB` to get document positions.
    */
    changes: readonly Change[], 
    /**
    The start of the chunk in document A.
    */
    fromA: number, 
    /**
    The end of the chunk in document A. This is equal to `fromA`
    when the chunk covers no lines in document A, or is one unit
    past the end of the last line in the chunk if it does.
    */
    toA: number, 
    /**
    The start of the chunk in document B.
    */
    fromB: number, 
    /**
    The end of the chunk in document A.
    */
    toB: number, 
    /**
    This is set to false when the diff used to compute this chunk
    fell back to fast, imprecise diffing.
    */
    precise?: boolean);
    /**
    Returns `fromA` if the chunk is empty in A, or the end of the
    last line in the chunk otherwise.
    */
    get endA(): number;
    /**
    Returns `fromB` if the chunk is empty in B, or the end of the
    last line in the chunk otherwise.
    */
    get endB(): number;
    /**
    Build a set of changed chunks for the given documents.
    */
    static build(a: Text, b: Text, conf?: DiffConfig): readonly Chunk[];
    /**
    Update a set of chunks for changes in document A. `a` should
    hold the updated document A.
    */
    static updateA(chunks: readonly Chunk[], a: Text, b: Text, changes: ChangeDesc, conf?: DiffConfig): readonly Chunk[];
    /**
    Update a set of chunks for changes in document B.
    */
    static updateB(chunks: readonly Chunk[], a: Text, b: Text, changes: ChangeDesc, conf?: DiffConfig): readonly Chunk[];
}

/**
Get the changed chunks for the merge view that this editor is part
of, plus the side it is on if it is part of a `MergeView`. Returns
null if the editor doesn't have a merge extension active or the
merge view hasn't finished initializing yet.
*/
declare function getChunks(state: EditorState): {
    chunks: readonly Chunk[];
    side: "a" | "b" | null;
} | null;
/**
Move the selection to the next changed chunk.
*/
declare const goToNextChunk: StateCommand;
/**
Move the selection to the previous changed chunk.
*/
declare const goToPreviousChunk: StateCommand;

/**
Configuration options to `MergeView` that can be provided both
initially and to [`reconfigure`](https://codemirror.net/6/docs/ref/#merge.MergeView.reconfigure).
*/
interface MergeConfig {
    /**
    Controls whether editor A or editor B is shown first. Defaults
    to `"a-b"`.
    */
    orientation?: "a-b" | "b-a";
    /**
    Controls whether revert controls are shown between changed
    chunks.
    */
    revertControls?: "a-to-b" | "b-to-a";
    /**
    When given, this function is called to render the button to
    revert a chunk.
    */
    renderRevertControl?: () => HTMLElement;
    /**
    By default, the merge view will mark inserted and deleted text
    in changed chunks. Set this to false to turn that off.
    */
    highlightChanges?: boolean;
    /**
    Controls whether a gutter marker is shown next to changed lines.
    */
    gutter?: boolean;
    /**
    When given, long stretches of unchanged text are collapsed.
    `margin` gives the number of lines to leave visible after/before
    a change (default is 3), and `minSize` gives the minimum amount
    of collapsible lines that need to be present (defaults to 4).
    */
    collapseUnchanged?: {
        margin?: number;
        minSize?: number;
    };
    /**
    Pass options to the diff algorithm. By default, the merge view
    sets [`scanLimit`](https://codemirror.net/6/docs/ref/#merge.DiffConfig.scanLimit) to 500.
    */
    diffConfig?: DiffConfig;
}
/**
Configuration options given to the [`MergeView`](https://codemirror.net/6/docs/ref/#merge.MergeView)
constructor.
*/
interface DirectMergeConfig extends MergeConfig {
    /**
    Configuration for the first editor (the left one in a
    left-to-right context).
    */
    a: EditorStateConfig;
    /**
    Configuration for the second editor.
    */
    b: EditorStateConfig;
    /**
    Parent element to append the view to.
    */
    parent?: Element | DocumentFragment;
    /**
    An optional root. Only necessary if the view is mounted in a
    shadow root or a document other than the global `document`
    object.
    */
    root?: Document | ShadowRoot;
}
/**
A merge view manages two editors side-by-side, highlighting the
difference between them and vertically aligning unchanged lines.
If you want one of the editors to be read-only, you have to
configure that in its extensions.

By default, views are not scrollable. Style them (`.cm-mergeView`)
with a height and `overflow: auto` to make them scrollable.
*/
declare class MergeView {
    /**
    The first editor.
    */
    a: EditorView;
    /**
    The second editor.
    */
    b: EditorView;
    /**
    The outer DOM element holding the view.
    */
    dom: HTMLElement;
    private editorDOM;
    private revertDOM;
    private revertToA;
    private revertToLeft;
    private renderRevert;
    private diffConf;
    /**
    The current set of changed chunks.
    */
    chunks: readonly Chunk[];
    private measuring;
    /**
    Create a new merge view.
    */
    constructor(config: DirectMergeConfig);
    private dispatch;
    /**
    Reconfigure an existing merge view.
    */
    reconfigure(config: MergeConfig): void;
    private setupRevertControls;
    private scheduleMeasure;
    private measure;
    private updateRevertButtons;
    private renderRevertButton;
    private revertClicked;
    /**
    Destroy this merge view.
    */
    destroy(): void;
}

interface UnifiedMergeConfig {
    /**
    The other document to compare the editor content with.
    */
    original: Text | string;
    /**
    By default, the merge view will mark inserted and deleted text
    in changed chunks. Set this to false to turn that off.
    */
    highlightChanges?: boolean;
    /**
    Controls whether a gutter marker is shown next to changed lines.
    */
    gutter?: boolean;
    /**
    By default, deleted chunks are highlighted using the main
    editor's language. Since these are just fragments, not full
    documents, this doesn't always work well. Set this option to
    false to disable syntax highlighting for deleted lines.
    */
    syntaxHighlightDeletions?: boolean;
    /**
    When enabled (off by default), chunks that look like they
    contain only inline changes will have the changes displayed
    inline, rather than as separate deleted/inserted lines.
    */
    allowInlineDiffs?: boolean;
    /**
    Deleted blocks larger than this size do not get
    syntax-highlighted. Defaults to 3000.
    */
    syntaxHighlightDeletionsMaxLength?: number;
    /**
    Controls whether accept/reject buttons are displayed for each
    changed chunk. Defaults to true. When set to a function, that
    function is used to render the buttons.
    */
    mergeControls?: boolean | ((type: "reject" | "accept", action: (e: MouseEvent) => void) => HTMLElement);
    /**
    Pass options to the diff algorithm. By default, the merge view
    sets [`scanLimit`](https://codemirror.net/6/docs/ref/#merge.DiffConfig.scanLimit) to 500.
    */
    diffConfig?: DiffConfig;
    /**
    When given, long stretches of unchanged text are collapsed.
    `margin` gives the number of lines to leave visible after/before
    a change (default is 3), and `minSize` gives the minimum amount
    of collapsible lines that need to be present (defaults to 4).
    */
    collapseUnchanged?: {
        margin?: number;
        minSize?: number;
    };
}
/**
Create an extension that causes the editor to display changes
between its content and the given original document. Changed
chunks will be highlighted, with uneditable widgets displaying the
original text displayed above the new text.
*/
declare function unifiedMergeView(config: UnifiedMergeConfig): (Extension | StateField<DecorationSet>)[];
/**
The state effect used to signal changes in the original doc in a
unified merge view.
*/
declare const updateOriginalDoc: StateEffectType<{
    doc: Text;
    changes: ChangeSet;
}>;
/**
Create an effect that, when added to a transaction on a unified
merge view, will update the original document that's being compared against.
*/
declare function originalDocChangeEffect(state: EditorState, changes: ChangeSet): StateEffect<{
    doc: Text;
    changes: ChangeSet;
}>;
/**
Get the original document from a unified merge editor's state.
*/
declare function getOriginalDoc(state: EditorState): Text;
/**
In a [unified](https://codemirror.net/6/docs/ref/#merge.unifiedMergeView) merge view, accept the
chunk under the given position or the cursor. This chunk will no
longer be highlighted unless it is edited again.
*/
declare function acceptChunk(view: EditorView, pos?: number): boolean;
/**
In a [unified](https://codemirror.net/6/docs/ref/#merge.unifiedMergeView) merge view, reject the
chunk under the given position or the cursor. Reverts that range
to the content it has in the original document.
*/
declare function rejectChunk(view: EditorView, pos?: number): boolean;

/**
A state effect that expands the section of collapsed unchanged
code starting at the given position.
*/
declare const uncollapseUnchanged: StateEffectType<number>;
/**
Query whether the given view is displayed next to another editor
in a merge view. Returns `null` if it isn't, and a pair of editors
(one of which will be the view itself) otherwise.
*/
declare function mergeViewSiblings(view: EditorView): {
    a: EditorView;
    b: EditorView;
} | null;

type index_d_Change = Change;
declare const index_d_Change: typeof Change;
type index_d_Chunk = Chunk;
declare const index_d_Chunk: typeof Chunk;
type index_d_DiffConfig = DiffConfig;
type index_d_DirectMergeConfig = DirectMergeConfig;
type index_d_MergeConfig = MergeConfig;
type index_d_MergeView = MergeView;
declare const index_d_MergeView: typeof MergeView;
declare const index_d_acceptChunk: typeof acceptChunk;
declare const index_d_diff: typeof diff;
declare const index_d_getChunks: typeof getChunks;
declare const index_d_getOriginalDoc: typeof getOriginalDoc;
declare const index_d_goToNextChunk: typeof goToNextChunk;
declare const index_d_goToPreviousChunk: typeof goToPreviousChunk;
declare const index_d_mergeViewSiblings: typeof mergeViewSiblings;
declare const index_d_originalDocChangeEffect: typeof originalDocChangeEffect;
declare const index_d_presentableDiff: typeof presentableDiff;
declare const index_d_rejectChunk: typeof rejectChunk;
declare const index_d_uncollapseUnchanged: typeof uncollapseUnchanged;
declare const index_d_unifiedMergeView: typeof unifiedMergeView;
declare const index_d_updateOriginalDoc: typeof updateOriginalDoc;
declare namespace index_d {
  export { index_d_Change as Change, index_d_Chunk as Chunk, index_d_MergeView as MergeView, index_d_acceptChunk as acceptChunk, index_d_diff as diff, index_d_getChunks as getChunks, index_d_getOriginalDoc as getOriginalDoc, index_d_goToNextChunk as goToNextChunk, index_d_goToPreviousChunk as goToPreviousChunk, index_d_mergeViewSiblings as mergeViewSiblings, index_d_originalDocChangeEffect as originalDocChangeEffect, index_d_presentableDiff as presentableDiff, index_d_rejectChunk as rejectChunk, index_d_uncollapseUnchanged as uncollapseUnchanged, index_d_unifiedMergeView as unifiedMergeView, index_d_updateOriginalDoc as updateOriginalDoc };
  export type { index_d_DiffConfig as DiffConfig, index_d_DirectMergeConfig as DirectMergeConfig, index_d_MergeConfig as MergeConfig };
}

declare const toml: StreamParser<unknown>

export { Annotation, ChangeSet, Compartment, Decoration, EditorSelection, EditorState, EditorView, Facet, HighlightStyle, MatchDecorator, NodeProp, NodeWeakMap, PostgreSQL, Prec, SelectionRange, StateEffect, StateEffectType, StateField, StreamLanguage, Text, Transaction, Tree, TreeCursor, ViewPlugin, ViewUpdate, WidgetType, index_d$1 as autocomplete, bracketMatching, closeBrackets, closeBracketsKeymap, collab, combineConfig, completionKeymap, css, cssLanguage, defaultHighlightStyle, defaultKeymap, delimitedIndent, drawSelection, foldGutter, foldKeymap, getClientID, getSyncedVersion, highlightActiveLine, highlightSelectionMatches, highlightSpecialChars, history, historyKeymap, html, htmlLanguage, indentLess, indentMore, indentOnInput, indentUnit, invertedEffects, javascript, javascriptLanguage, julia, keymap, lineNumbers, linter, markdown, markdownLanguage, index_d as merge, moveLineDown, moveLineUp, parseCode, parseMixed, placeholder, python, pythonLanguage, receiveUpdates, rectangularSelection, searchKeymap, selectNextOccurrence, sendableUpdates, setDiagnostics, showTooltip, sql, syntaxHighlighting, syntaxTree, syntaxTreeAvailable, tags, toml, tooltips };
export type { Diagnostic, Tooltip };
