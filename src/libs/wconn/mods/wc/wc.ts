import { chainDataByChainId } from "@/libs/ethereum/mods/chain";
import { Base16 } from "@hazae41/base16";
import type { Uint8Array } from "@hazae41/bytes";
import { Bytes } from "@hazae41/bytes";
import { Future } from "@hazae41/future";
import { RpcRequestPreinit } from "@hazae41/jsonrpc";
import { None, Option, Some } from "@hazae41/option";
import { Ok } from "@hazae41/result";
import { X25519 } from "@hazae41/x25519";
import { CryptoClient, WcReceiptAndPromise } from "../crypto/client";
import { IrnBrume } from "../irn/irn";

export interface WcMetadata {
  readonly name: string
  readonly description: string
  readonly url: string
  readonly icons: string[]
}

export interface WcSessionProposeParams {
  readonly proposer: {
    /**
     * base16
     */
    readonly publicKey: string
    readonly metadata: WcMetadata
  }

  readonly relays: {
    readonly protocol: string
  }[]

  readonly requiredNamespaces: any
  readonly optionalNamespaces: any
}

export interface WcSessionSettleParams {
  readonly controller: {
    /**
     * base16
     */
    readonly publicKey: string
    readonly metadata: WcMetadata
  }

  readonly relay: {
    readonly protocol: string
  }

  readonly namespaces: any
  readonly requiredNamespaces: any
  readonly optionalNamespaces: any

  readonly pairingTopic: string
  readonly expiry: number
}

export interface WcSessionRequestParams<T = unknown> {
  /**
   * namespace:decimal
   */
  readonly chainId: `${string}:${string}`
  readonly request: RpcRequestPreinit<T>
}

export class WcProposal {

  constructor(
    readonly client: CryptoClient,
    readonly metadata: WcMetadata
  ) { }

}

export class WcSession {

  constructor(
    readonly client: CryptoClient,
    readonly metadata: WcMetadata
  ) { }

  async closeOrThrow(reason: unknown): Promise<void> {
    const params = { code: 6000, message: "User disconnected." }
    await this.client.requestOrThrow({ method: "wc_sessionDelete", params })
    await this.client.irn.closeOrThrow(reason)
  }

}

export interface WcPairParams {
  readonly protocol: "wc:"
  readonly version: "2"
  readonly pairingTopic: string
  readonly relayProtocol: "irn"
  readonly symKey: Uint8Array<32>
}

export interface WcSessionParams {
  readonly protocol: "wc:"
  readonly version: "2"
  readonly sessionTopic: string
  readonly relayProtocol: "irn"
  readonly symKey: Uint8Array<32>
}

export namespace Wc {

  export const RELAY = "wss://relay.walletconnect.org"

  export function parseOrThrow(url: URL): WcPairParams {
    const { protocol, pathname, searchParams } = url

    if (protocol !== "wc:")
      throw new Error(`Invalid protocol`)

    const [pairingTopic, version] = pathname.split("@")

    if (version !== "2")
      throw new Error(`Invalid version`)

    const relayProtocol = Option.unwrap(searchParams.get("relay-protocol"))

    if (relayProtocol !== "irn")
      throw new Error(`Invalid relay protocol`)

    const symKeyHex = Option.unwrap(searchParams.get("symKey"))
    const symKeyRaw = Base16.get().padStartAndDecodeOrThrow(symKeyHex).copyAndDispose()
    const symKey = Bytes.castOrThrow(symKeyRaw, 32)

    return { protocol, pairingTopic, version, relayProtocol, symKey }
  }

  export async function pairOrThrow(irn: IrnBrume, params: WcPairParams, address: string): Promise<[WcSession, WcReceiptAndPromise<boolean>]> {
    const { pairingTopic, symKey } = params

    const pairing = CryptoClient.createOrThrow(pairingTopic, symKey, irn)

    const relay = { protocol: "irn" }

    const selfPrivate = await X25519.get().PrivateKey.tryRandom().then(r => r.unwrap())
    const selfPublic = selfPrivate.tryGetPublicKey().unwrap()

    using selfPublicMemory = await selfPublic.tryExport().then(r => r.unwrap())
    const selfPublicHex = Base16.get().encodeOrThrow(selfPublicMemory)

    await irn.subscribeOrThrow(pairingTopic)

    const proposal = await pairing.events.wait("request", async (future: Future<RpcRequestPreinit<WcSessionProposeParams>>, request) => {
      if (request.method !== "wc_sessionPropose")
        return new None()
      future.resolve(request as RpcRequestPreinit<WcSessionProposeParams>)
      return new Some(new Ok({ relay, responderPublicKey: selfPublicHex }))
    }).inner

    using peerPublicMemory = Base16.get().padStartAndDecodeOrThrow(proposal.params.proposer.publicKey)
    const peerPublic = await X25519.get().PublicKey.tryImport(peerPublicMemory).then(r => r.unwrap())

    const sharedRef = await selfPrivate.tryCompute(peerPublic).then(r => r.unwrap())
    using sharedSlice = sharedRef.tryExport().unwrap()

    const hdfk_key = await crypto.subtle.importKey("raw", sharedSlice.bytes, "HKDF", false, ["deriveBits"])
    const hkdf_params = { name: "HKDF", hash: "SHA-256", info: new Uint8Array(), salt: new Uint8Array() }

    const sessionKey = new Uint8Array(await crypto.subtle.deriveBits(hkdf_params, hdfk_key, 8 * 32)) as Uint8Array<32>
    const sessionDigest = new Uint8Array(await crypto.subtle.digest("SHA-256", sessionKey))
    const sessionTopic = Base16.get().encodeOrThrow(sessionDigest)
    const session = CryptoClient.createOrThrow(sessionTopic, sessionKey, irn)

    await irn.subscribeOrThrow(sessionTopic)

    {
      const { proposer, requiredNamespaces, optionalNamespaces } = proposal.params

      const namespaces = {
        eip155: {
          chains: Object.values(chainDataByChainId).map(chain => `eip155:${chain.chainId}`),
          methods: ["eth_sendTransaction", "personal_sign", "eth_signTypedData", "eth_signTypedData_v4"],
          events: ["chainChanged", "accountsChanged"],
          accounts: Object.values(chainDataByChainId).map(chain => `eip155:${chain.chainId}:${address}`)
        }
      }

      const metadata = { name: "Brume", description: "Brume", url: location.origin, icons: [] }
      const controller = { publicKey: selfPublicHex, metadata }
      const expiry = Math.floor((Date.now() + (7 * 24 * 60 * 60 * 1000)) / 1000)
      const params: WcSessionSettleParams = { relay, namespaces, requiredNamespaces, optionalNamespaces, pairingTopic, controller, expiry }

      const settlement = await session.requestOrThrow<boolean>({ method: "wc_sessionSettle", params })

      return [new WcSession(session, proposer.metadata), settlement]
    }
  }

}