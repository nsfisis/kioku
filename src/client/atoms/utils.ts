import { atom, type Getter, type WritableAtom } from "jotai";

// Symbol to identify reload action
const RELOAD = Symbol("reload");

/**
 * A WritableAtom that returns T (or Promise<T> before hydration) and accepts
 * an optional T value for hydration, or undefined to trigger reload.
 */
export type ReloadableAtom<T> = WritableAtom<T | Promise<T>, [T?], void>;

/**
 * Creates an async atom that can be reloaded by calling its setter.
 * Read the atom to get the data (suspends while loading).
 * Set the atom with no args to trigger a reload.
 * Set the atom with a value to hydrate (useful for testing).
 */
export function createReloadableAtom<T>(
	getter: (get: Getter) => Promise<T>,
): ReloadableAtom<T> {
	const refetchKeyAtom = atom(0);
	// Stores hydrated value - undefined means not hydrated
	const hydratedValueAtom = atom<{ value: T } | undefined>(undefined);

	return atom(
		// Not using async here - returns T synchronously when hydrated, Promise<T> when fetching
		(get): T | Promise<T> => {
			// Check for hydrated value first (sync path - avoids Suspense)
			const hydrated = get(hydratedValueAtom);
			if (hydrated !== undefined) {
				return hydrated.value;
			}
			// Async path - will trigger Suspense
			get(refetchKeyAtom);
			return getter(get);
		},
		(_get, set, action?: T | typeof RELOAD) => {
			if (action === undefined || action === RELOAD) {
				// Trigger reload: clear hydrated value and bump refetch key
				set(hydratedValueAtom, undefined);
				set(refetchKeyAtom, (k) => k + 1);
			} else {
				// Hydrate with value
				set(hydratedValueAtom, { value: action });
			}
		},
	);
}

// Track all atom family caches for test cleanup
const atomFamilyCaches: Map<unknown, unknown>[] = [];

/**
 * Creates a reloadable atom family for parameterized async data.
 * Each unique parameter gets its own cached atom with reload capability.
 */
export function createReloadableAtomFamily<T, P extends string | number>(
	getter: (param: P, get: Getter) => Promise<T>,
): (param: P) => ReloadableAtom<T> {
	const cache = new Map<P, ReloadableAtom<T>>();
	atomFamilyCaches.push(cache);

	return (param: P): ReloadableAtom<T> => {
		let reloadableAtom = cache.get(param);
		if (!reloadableAtom) {
			reloadableAtom = createReloadableAtom((get) => getter(param, get));
			cache.set(param, reloadableAtom);
		}
		return reloadableAtom;
	};
}

/**
 * Clears all atom family caches. Call this in test beforeEach/afterEach
 * to ensure tests don't share cached atoms.
 */
export function clearAtomFamilyCaches() {
	for (const cache of atomFamilyCaches) {
		cache.clear();
	}
}
