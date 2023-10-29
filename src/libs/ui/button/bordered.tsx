import { Outline } from "@/libs/icons/icons";
import { Base } from "./base";
import { Shrinker } from "./shrink";

export namespace Bordered {

  export const className =
    `text-contrast border border-contrast hovered-or-clicked-or-focused-or-selected:text-default hovered-or-clicked-or-focused-or-selected:border-opposite`

  export function Test() {
    return <div className="p-1">
      <button className={`${Base.className} ${className} po-md`}>
        <div className={`${Shrinker.className}`}>
          <Outline.GlobeAltIcon className="s-sm" />
          Hello world
        </div>
      </button>
      <div className="h-1" />
      <button className={`${Base.className} ${className} po-md`}>
        <div className={`${Shrinker.className}`}>
          Hello world
        </div>
      </button>
    </div>
  }

}