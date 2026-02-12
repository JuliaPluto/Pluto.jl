type TypedArray =
    | Int8Array
    | Uint8Array
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | Uint8ClampedArray
    | Float32Array
    | Float64Array
    | BigInt64Array
    | BigUint64Array

type Constructor = new (...args: any) => any

interface MsgPackCodec {
    addExtPacker<T extends Constructor>(type: number, Class: T, packer: (value: InstanceType<T>) => TypedArray): void
    addExtUnpacker<T>(type: number, unpacker: (array: Uint8Array) => T): void
}

declare const msgpack: {
    createCodec(): MsgPackCodec
    encode(value: any, options: { codec?: MsgPackCodec }): Uint8Array<ArrayBuffer>
    decode(buffer: Uint8Array, options: { codec?: MsgPackCodec }): any
}

export default msgpack
