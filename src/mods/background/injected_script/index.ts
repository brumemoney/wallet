import "@hazae41/symbol-dispose-polyfill";

import { Future } from "@hazae41/future";
import { RpcCounter, RpcRequestPreinit, RpcResponse, RpcResponseInit } from "@hazae41/jsonrpc";

declare global {
  interface Window {
    ethereum?: EIP1193Provider
  }
}

interface EIP1193Provider {
  /**
   * No definition? :(
   */
}

interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo;
  provider: EIP1193Provider;
}

interface EIP6963AnnounceProviderEvent extends CustomEvent {
  type: "eip6963:announceProvider";
  detail: EIP6963ProviderDetail;
}

interface EIP6963RequestProviderEvent extends CustomEvent {
  type: "eip6963:requestProvider";
}

declare global {
  interface DedicatedWorkerGlobalScopeEventMap {
    "eip6963:announceProvider": EIP6963AnnounceProviderEvent,
    "eip6963:requestProvider": EIP6963RequestProviderEvent
  }
}

type EthereumEventKey = `ethereum:${string}`
type BrumeEventKey = `brume#${string}`

type Listener = (...params: any[]) => void

declare global {
  interface DedicatedWorkerGlobalScopeEventMap {
    [k: BrumeEventKey]: CustomEvent<string>
    [k: EthereumEventKey]: CustomEvent<string>
  }
}

const icon = new Future<string>()

const onLogo = (event: CustomEvent<string>) => {
  icon.resolve(JSON.parse(event.detail))
}

window.addEventListener("brume#icon", onLogo, { passive: true, once: true })

class Provider {

  readonly #counter = new RpcCounter()

  readonly #listenersByEvent = new Map<string, Set<Listener>>()

  /**
   * @deprecated
   */
  autoRefreshOnNetworkChange = false

  /**
   * @deprecated
   */
  #connected = false

  /**
   * @deprecated
   */
  #accounts = new Array<string>()

  /**
   * @deprecated
   */
  #chainId = "0x1"

  /**
   * @deprecated
   */
  #networkVersion = "1"

  /**
   * @deprecated
   */
  #listenerCount = 0

  constructor() {
    /**
     * Fix for that poorly-coded app that does `const { request } = provider`
     */
    this.request = this.request.bind(this)
    this.send = this.send.bind(this)
    this.sendAsync = this.sendAsync.bind(this)
    this.enable = this.enable.bind(this)
    this.isConnected = this.isConnected.bind(this)
    this.on = this.on.bind(this)
    this.off = this.off.bind(this)
    this.once = this.once.bind(this)
    this.emit = this.emit.bind(this)
    this.addListener = this.addListener.bind(this)
    this.removeListener = this.removeListener.bind(this)
    this.prependListener = this.prependListener.bind(this)
    this.prependOnceListener = this.prependOnceListener.bind(this)
    this.removeAllListeners = this.removeAllListeners.bind(this)
    this.eventNames = this.eventNames.bind(this)
    this.listeners = this.listeners.bind(this)
    this.rawListeners = this.rawListeners.bind(this)
    this.listenerCount = this.listenerCount.bind(this)
    this.getMaxListeners = this.getMaxListeners.bind(this)
    this.setMaxListeners = this.setMaxListeners.bind(this)

    this.#reemit("connect")
    this.#reemit("disconnect")
    this.#reemit("accountsChanged")
    this.#reemit("#accountsChanged")
    this.#reemit("chainChanged")
    this.#reemit("networkChanged")

    this.on("connect", () => {
      this.#connected = true
    })

    this.on("disconnect", () => {
      this.#connected = false
    })

    this.on("accountsChanged", (accounts: string[]) => {
      this.#accounts = accounts
    })

    this.on("chainChanged", (chainId: string) => {
      this.#chainId = chainId
    })

    this.on("networkChanged", (networkVersion: string) => {
      this.#networkVersion = networkVersion
    })

    /**
     * Fix for that poorly-coded app that reloads on `accountsChanged`
     */
    this.on("#accountsChanged", (accounts: string[]) => {
      this.#accounts = accounts
    })

    /**
     * Fix that old app that needs to reload on network change
     */
    this.on("networkChanged", () => {
      if (!this.autoRefreshOnNetworkChange)
        return
      location.reload()
    })

    /**
     * Force update of `isConnected`, `selectedAddress`, `chainId` `networkVersion`
     */
    this.tryRequest({ method: "eth_accounts" }).then(r => r.ignore())
  }

  get isBrume() {
    return true
  }

  get isMetaMask() {
    return true
  }

  /**
   * @deprecated
   */
  isConnected() {
    return this.#connected
  }

  /**
   * @deprecated
   */
  get chainId() {
    return this.#chainId
  }

  /**
   * @deprecated
   */
  get networkVersion() {
    return this.#networkVersion
  }

  /**
   * @deprecated
   */
  get selectedAddress() {
    return this.#accounts[0]
  }

  /**
   * @deprecated
   */
  eventNames() {
    return ["connect", "disconnect", "chainChanged", "accountsChanged", "networkChanged"] as const
  }

  /**
   * @deprecated
   */
  getMaxListeners() {
    return Number.MAX_SAFE_INTEGER
  }

  /**
   * @deprecated
   */
  setMaxListeners(x: number) {
    return this
  }

  /**
   * @deprecated
   */
  listenerCount() {
    return this.#listenerCount
  }

  /**
   * @deprecated
   */
  listeners(key: string) {
    const listeners = this.#listenersByEvent.get(key)

    if (listeners == null)
      return []
    return [...listeners]
  }

  /**
   * @deprecated
   */
  rawListeners(key: string) {
    return this.listeners(key)
  }

  /**
   * @deprecated
   */
  async enable() {
    /**
     * Enable compatibility mode for that old app that needs to reload on network change
     */
    this.autoRefreshOnNetworkChange = true

    return await this.request({ method: "eth_requestAccounts" })
  }

  async tryRequest(init: RpcRequestPreinit<unknown>) {
    const request = this.#counter.prepare(init)

    const future = new Future<RpcResponse<unknown>>()

    const onResponse = (e: CustomEvent<string>) => {
      const init = JSON.parse(e.detail) as RpcResponseInit<unknown>

      if (init.id !== request.id)
        return

      const response = RpcResponse.from(init)
      future.resolve(response)
    }

    try {
      window.addEventListener("ethereum:response", onResponse)

      const detail = JSON.stringify(request)
      const event = new CustomEvent("ethereum:request", { detail })
      window.dispatchEvent(event)

      return await future.promise
    } finally {
      window.removeEventListener("ethereum:response", onResponse)
    }
  }

  async request(init: RpcRequestPreinit<unknown>) {
    const result = await this.tryRequest(init)

    if (result.isErr())
      throw result.inner
    return result.inner
  }

  async #send(init: RpcRequestPreinit<unknown>, callback: (err: unknown, ok: unknown) => void) {
    const response = await this.tryRequest(init)

    if (response.isErr())
      callback(response.inner, response)
    else
      callback(null, response)
  }

  /**
   * @deprecated
   */
  send(init: RpcRequestPreinit<unknown>, callback?: (err: unknown, ok: unknown) => void) {
    if (callback != null)
      return this.#send(init, callback)
    if (init.method === "eth_accounts")
      return { result: this.#accounts }
    if (init.method === "eth_coinbase")
      return { result: this.#accounts[0] }
    if (init.method === "net_version")
      return { result: this.#networkVersion }
    if (init.method === "eth_uninstallFilter")
      throw new Error(`Unimplemented method ${init.method}`)
    throw new Error(`Asynchronous method ${init.method} requires a callback`)
  }

  /**
   * @deprecated
   */
  sendAsync(init: RpcRequestPreinit<unknown>, callback: (err: unknown, ok: unknown) => void) {
    this.#send(init, callback)
  }

  #reemit(key: string) {
    this.#listenersByEvent.set(key, new Set())

    window.addEventListener(`ethereum:${key}`, (e: CustomEvent<string>) => {
      this.emit(key, JSON.parse(e.detail))
    }, { passive: true })
  }

  emit(key: string, ...params: any[]) {
    const listeners = this.#listenersByEvent.get(key)

    if (listeners == null)
      return

    for (const listener of listeners)
      listener(...params)

    return
  }

  on(key: string, listener: Listener) {
    this.addListener(key, listener)
  }

  off(key: string, listener: Listener) {
    this.removeListener(key, listener)
  }

  once(key: string, listener: Listener) {
    const listener2 = (...params: any[]) => {
      listener(...params)
      this.off(key, listener2)
    }

    this.on(key, listener2)
  }

  addListener(key: string, listener: Listener) {
    const listeners = this.#listenersByEvent.get(key)

    if (listeners == null)
      return

    this.#listenerCount -= listeners.size

    listeners.add(listener)

    this.#listenerCount += listeners.size
  }

  removeListener(key: string, listener: Listener) {
    const listeners = this.#listenersByEvent.get(key)

    if (listeners == null)
      return

    if (!listeners.delete(listener))
      return

    this.#listenerCount--
  }

  removeAllListeners(key: string) {
    const listeners = this.#listenersByEvent.get(key)

    if (listeners == null)
      return

    this.#listenerCount -= listeners.size

    listeners.clear()
  }

  prependListener(key: string, listener: Listener) {
    const listeners = this.#listenersByEvent.get(key)

    if (listeners == null)
      return

    this.#listenerCount -= listeners.size

    const original = [...listeners]

    listeners.clear()
    listeners.add(listener)

    for (const listener of original)
      listeners.add(listener)

    this.#listenerCount += listeners.size
  }

  prependOnceListener(key: string, listener: Listener) {
    const listener2 = (...params: any[]) => {
      listener(...params)
      this.off(key, listener2)
    }

    this.prependListener(key, listener2)
  }

}

const provider = new Provider()

/**
 * EIP1193
 */
window.ethereum = provider

/**
 * EIP6963
 */
{
  async function announce() {
    const info: EIP6963ProviderInfo = Object.freeze({
      uuid: "e750a98c-ff2d-4fc4-b6e2-faf4d13d1add",
      name: "Brume Wallet",
      icon: await icon.promise,
      rdns: "money.brume"
    })

    const detail: EIP6963ProviderDetail = Object.freeze({ info, provider })
    const event = new CustomEvent("eip6963:announceProvider", { detail })

    window.dispatchEvent(event)
  }

  function onAnnounceRequest(event: EIP6963RequestProviderEvent) {
    announce()
  }

  window.addEventListener("eip6963:requestProvider", onAnnounceRequest, { passive: true })

  announce();
}
