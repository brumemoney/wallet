import { Fixed } from "@hazae41/cubane"
import { SimplePairDataV3, StoredPairData } from "../ethereum/mods/chain"

export namespace UniswapV2 {

  export function computeOrThrow(pair: StoredPairData, reserves: [bigint, bigint]) {
    const [reserve0, reserve1] = reserves

    const quantity0 = new Fixed(reserve0, pair.token0.decimals)
    const quantity1 = new Fixed(reserve1, pair.token1.decimals)

    if (pair.reversed)
      return quantity0.div(quantity1)

    return quantity1.div(quantity0)
  }

}

export namespace UniswapV3 {

  export function computeOrThrow(pair: SimplePairDataV3, sqrtPriceX96: Fixed.From<0>) {
    const sqrtPriceX96BigInt = Fixed.from(sqrtPriceX96).value

    const priceX96BigInt = sqrtPriceX96BigInt ** 2n

    const a = new Fixed(priceX96BigInt, pair.token1.decimals)
    const b = new Fixed(((2n ** 96n) ** 2n), pair.token0.decimals)

    if (pair.reversed)
      return a.div(b)

    return b.div(a)
  }

}