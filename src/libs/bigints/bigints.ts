import { FixedNumber } from "ethers"

export namespace BigInts {

  export function float(x: bigint, d = 180) {
    return FixedNumber
      .fromValue(x, d)
      .round(3)
      .toUnsafeFloat()
  }

  export function tryFloat(x?: bigint, d = 18) {
    if (x === undefined) return

    return FixedNumber
      .fromValue(x, d)
      .round(3)
      .toUnsafeFloat()
  }

  export function stringify(value: bigint) {
    return `0x${value.toString(16)}`
  }

  export function parse(value: string) {
    return BigInt(value)
  }

}

