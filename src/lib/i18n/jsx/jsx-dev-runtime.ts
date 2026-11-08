import * as R from "react/jsx-dev-runtime";
import { translateProps } from "./translate-props";

export const Fragment = R.Fragment;
export function jsxDEV(type: unknown, props: unknown, key: unknown, isStatic: boolean, source: unknown, self: unknown) {
  return (R.jsxDEV as (...a: unknown[]) => unknown)(type, translateProps(type, props), key, isStatic, source, self);
}
export type { JSX } from "react/jsx-dev-runtime";
