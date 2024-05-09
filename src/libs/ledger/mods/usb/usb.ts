import { ApduRequest, ApduRequestInit, ApduResponse } from "@hazae41/apdu"
import { Opaque, Readable, Writable } from "@hazae41/binary"
import { Bytes } from "@hazae41/bytes"
import { HIDContainer, HIDFrame } from "../hid"

export const VENDOR_ID = 0x2c97
export const PACKET_SIZE = 64

export class DeviceNotFoundError extends Error {
  readonly #class = DeviceNotFoundError
  readonly name = this.#class.name

  constructor(options?: ErrorOptions) {
    super(`Could not find device`, options)
  }

  static from(cause: unknown) {
    return new DeviceNotFoundError({ cause })
  }
}

export class DeviceOpenError extends Error {
  readonly #class = DeviceOpenError
  readonly name = this.#class.name

  constructor(options?: ErrorOptions) {
    super(`Could not open device`, options)
  }

  static from(cause: unknown) {
    return new DeviceOpenError({ cause })
  }
}


export class DeviceConfigError extends Error {
  readonly #class = DeviceConfigError
  readonly name = this.#class.name

  constructor(options?: ErrorOptions) {
    super(`Could not configure device`, options)
  }

  static from(cause: unknown) {
    return new DeviceConfigError({ cause })
  }
}

export class DeviceResetError extends Error {
  readonly #class = DeviceResetError
  readonly name = this.#class.name

  constructor(options?: ErrorOptions) {
    super(`Could not reset device`, options)
  }

  static from(cause: unknown) {
    return new DeviceResetError({ cause })
  }
}

export class DeviceInterfaceNotFoundError extends Error {
  readonly #class = DeviceInterfaceNotFoundError
  readonly name = this.#class.name

  constructor(options?: ErrorOptions) {
    super(`Could not find device interface`, options)
  }

  static from(cause: unknown) {
    return new DeviceInterfaceNotFoundError({ cause })
  }
}

export class DeviceInterfaceClaimError extends Error {
  readonly #class = DeviceInterfaceClaimError
  readonly name = this.#class.name

  constructor(options?: ErrorOptions) {
    super(`Could not claim device interface`, options)
  }

  static from(cause: unknown) {
    return new DeviceInterfaceClaimError({ cause })
  }
}

export class DeviceTransferOutError extends Error {
  readonly #class = DeviceTransferOutError
  readonly name = this.#class.name

  constructor(options?: ErrorOptions) {
    super(`Could not transfer data to device`, options)
  }

  static from(cause: unknown) {
    return new DeviceTransferOutError({ cause })
  }
}

export class DeviceTransferInError extends Error {
  readonly #class = DeviceTransferInError
  readonly name = this.#class.name

  constructor(options?: ErrorOptions) {
    super(`Could not transfer data from device`, options)
  }

  static from(cause: unknown) {
    return new DeviceTransferInError({ cause })
  }
}

export async function requestOrThrow() {
  const devices = await navigator.usb.getDevices()
  const device = devices.find(x => x.vendorId === VENDOR_ID)

  if (device != null)
    return device

  return await navigator.usb.requestDevice({ filters: [{ vendorId: VENDOR_ID }] })
}

export async function connectOrThrow(device: USBDevice) {
  await device.open()

  if (device.configuration == null)
    await device.selectConfiguration(1)

  await device.reset()

  const iface = device.configurations[0].interfaces.find(({ alternates }) => alternates.some(x => x.interfaceClass === 255))

  if (iface == null)
    throw new DeviceInterfaceNotFoundError()

  await device.claimInterface(iface.interfaceNumber)

  return new USBConnector(device, iface)
}

export class USBConnector {
  readonly #channel = Math.floor(Math.random() * 0xffff)

  constructor(
    readonly device: USBDevice,
    readonly iface: USBInterface
  ) { }

  async #transferOutOrThrow(frame: HIDFrame<Opaque>): Promise<void> {
    await this.device.transferOut(3, Writable.writeToBytesOrThrow(frame))
  }

  async #transferInOrThrow(length: number): Promise<HIDFrame<Opaque>> {
    const result = await this.device.transferIn(3, length)

    if (result.data == null)
      throw new DeviceTransferInError()

    const bytes = Bytes.fromView(result.data)
    const frame = Readable.readFromBytesOrThrow(HIDFrame, bytes)

    return frame
  }

  async #sendOrThrow<T extends Writable>(fragment: T): Promise<void> {
    const container = HIDContainer.newOrThrow(fragment)
    const bytes = Writable.writeToBytesOrThrow(container)

    const frames = HIDFrame.splitOrThrow(this.#channel, bytes)

    let frame = frames.next()

    for (; !frame.done; frame = frames.next())
      await this.#transferOutOrThrow(frame.value)

    return frame.value
  }

  async *#receiveOrThrow(): AsyncGenerator<HIDFrame<Opaque>, never, unknown> {
    while (true)
      yield await this.#transferInOrThrow(64)
  }

  async requestOrThrow<T extends Writable>(init: ApduRequestInit<T>): Promise<ApduResponse<Opaque>> {
    const request = ApduRequest.fromOrThrow(init)
    await this.#sendOrThrow(request)

    const bytes = await HIDFrame.unsplitOrThrow(this.#channel, this.#receiveOrThrow())
    const response = Readable.readFromBytesOrThrow(ApduResponse, bytes)

    return response
  }

}