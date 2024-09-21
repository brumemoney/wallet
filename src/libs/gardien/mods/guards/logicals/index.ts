import { Guard } from "../../guard"
import { Intersect, Super } from "../../super"
import { ArrayGuard, ElementsGuard } from "../arrays"
import { StringGuard } from "../strings"

export class UnionGuard<I, A, B> {

  constructor(
    readonly left: Guard<I, A>,
    readonly right: Guard<I, B>
  ) { }

  asOrThrow(value: I): (A | B) {
    let cause = []

    try {
      return this.left.asOrThrow(value)
    } catch (e: unknown) {
      cause.push(e)
    }

    try {
      return this.right.asOrThrow(value)
    } catch (e: unknown) {
      cause.push(e)
    }

    throw new Error(undefined, { cause })
  }

}

export class InterGuard<A extends Guard.Overloaded<any, any, any>, B extends Guard.Overloaded<Guard.Overloaded.Output<A>, Guard.Overloaded.Output<A>, any>> {

  constructor(
    readonly left: A,
    readonly right: B
  ) { }

  asOrThrow<X extends Guard.Overloaded.Strong<B>>(value: X): Guard.Overloaded.Output<B>

  asOrThrow<X extends Guard.Overloaded.Weak<A>>(value: Super<X, Intersect<X, Guard.Overloaded.Strong<B>>>): Guard.Overloaded.Output<B>

  asOrThrow(value: Guard.Overloaded.Weak<A>): Guard.Overloaded.Output<B> {
    return this.right.asOrThrow(this.left.asOrThrow(value))
  }

}

new InterGuard(ArrayGuard, new ElementsGuard(StringGuard)).asOrThrow([] as const)