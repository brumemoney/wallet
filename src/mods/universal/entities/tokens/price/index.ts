import { SimpleContractTokenData, SimplePairDataV3 } from "@/libs/ethereum/mods/chain"
import { Records } from "@/libs/records"
import { EthereumChainfulRpcRequestPreinit } from "@/mods/background/service_worker/entities/wallets/data"
import { EthereumContext } from "@/mods/universal/context/ethereum"
import { Fixed } from "@hazae41/cubane"
import { createQuery, Data, Fetched, FetcherMore, QueryStorage } from "@hazae41/glacier"
import { Nullable, Option } from "@hazae41/option"
import { FactoryV3, PairV3 } from "../../pairs/v3"

export namespace PriceV3 {

  export type K = EthereumChainfulRpcRequestPreinit<unknown>
  export type D = Fixed.From
  export type F = Error

  export function keyOrThrow(chainId: number, token: SimpleContractTokenData, block: string) {
    return {
      chainId: chainId,
      method: "eth_get",
      params: [{
        to: token.address,
        data: "price/v3/3000"
      }, block]
    }
  }

  export function queryOrThrow(context: Nullable<EthereumContext>, token: Nullable<SimpleContractTokenData>, block: Nullable<string>, storage: QueryStorage) {
    if (context == null)
      return
    if (token == null)
      return
    if (block == null)
      return

    const fetcher = (request: K, more: FetcherMore) => Fetched.runOrDoubleWrap(async () => {
      const wethData = Records.getOrThrow(FactoryV3.wethByChainId, context.chain.chainId)
      const wethTokenPairFetched = await FactoryV3.GetPool.queryOrThrow(context, token, wethData, 3000, block, storage)!.fetch().then(r => Option.wrap(r.getAny().real?.current).getOrThrow())

      if (wethTokenPairFetched.isErr())
        return wethTokenPairFetched

      const wethTokenPairData: SimplePairDataV3 = { version: 3, address: wethTokenPairFetched.get(), chainId: context.chain.chainId, token0: token, token1: wethData, reversed: false }
      const wethTokenPriceFetched = await PairV3.Price.queryOrThrow(context, wethTokenPairData, block, storage)!.fetch().then(r => Option.wrap(r.getAny().real?.current).getOrThrow())

      if (wethTokenPriceFetched.isErr())
        return wethTokenPriceFetched

      const usdcWethPairData = Records.getOrThrow(FactoryV3.usdcWethPoolByChainId, context.chain.chainId)
      const usdcWethPriceFetched = await PairV3.Price.queryOrThrow(context, usdcWethPairData, block, storage)!.fetch().then(r => Option.wrap(r.getAny().real?.current).getOrThrow())

      if (usdcWethPriceFetched.isErr())
        return usdcWethPriceFetched

      const wethTokenPrice = Fixed.from(wethTokenPriceFetched.get())
      const usdcWethPrice = Fixed.from(usdcWethPriceFetched.get())

      const usdcTokenPrice = wethTokenPrice.mul(usdcWethPrice)

      return new Data(usdcTokenPrice)
    })

    return createQuery<K, D, F>({
      key: keyOrThrow(context.chain.chainId, token, block),
      fetcher,
      storage
    })
  }

}