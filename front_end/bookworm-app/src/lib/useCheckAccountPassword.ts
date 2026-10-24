import { useStore } from "../store/context";

/** Returns a checker: true if a value is the signed-in account's password. */
export function useCheckAccountPassword() {
  const { state } = useStore();
  return (value: string) => Boolean(state.account && value === state.account.password);
}
