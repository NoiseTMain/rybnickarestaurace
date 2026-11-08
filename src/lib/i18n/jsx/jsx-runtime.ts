import * as R from "react/jsx-runtime";
import { translateProps } from "./translate-props";

export const Fragment = R.Fragment;
export function jsx(type: unknown, props: unknown, key?: unknown) {
  return (R.jsx as (t: unknown, p: unknown, k?: unknown) => unknown)(type, translateProps(type, props), key);
}
export function jsxs(type: unknown, props: unknown, key?: unknown) {
  return (R.jsxs as (t: unknown, p: unknown, k?: unknown) => unknown)(type, translateProps(type, props), key);
}
export type { JSX } from "react/jsx-runtime";
