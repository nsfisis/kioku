import type { WritableAtom } from "jotai";
import { useHydrateAtoms } from "jotai/utils";
import type { ReactNode } from "react";

type AnyWritableAtom = WritableAtom<unknown, unknown[], unknown>;

/**
 * Component that hydrates Jotai atoms with initial values before rendering children.
 * Use this in tests to pre-populate async atoms, bypassing Suspense.
 */
export function HydrateAtoms({
	initialValues,
	children,
}: {
	initialValues: Iterable<readonly [AnyWritableAtom, unknown]>;
	children: ReactNode;
}) {
	useHydrateAtoms([...initialValues]);
	return <>{children}</>;
}
