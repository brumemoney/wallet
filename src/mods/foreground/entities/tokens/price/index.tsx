import { Errors } from "@/libs/errors/errors"
import { SimpleContractTokenData } from "@/libs/ethereum/mods/chain"
import { useUserStorageContext } from "@/mods/foreground/storage/user"
import { PriceV3 } from "@/mods/universal/entities/tokens/price"
import { useError, useFetch, useQuery, useVisible } from "@hazae41/glacier"
import { Nullable } from "@hazae41/option"
import { FgEthereumContext } from "../../wallets/data"

export function useTokenV3Price(context: Nullable<FgEthereumContext>, token: Nullable<SimpleContractTokenData>, block: Nullable<string>) {
  const storage = useUserStorageContext().getOrThrow()
  const query = useQuery(PriceV3.queryOrThrow, [context, token, block, storage])
  useFetch(query)
  useVisible(query)
  useError(query, Errors.onQueryError)
  return query
}