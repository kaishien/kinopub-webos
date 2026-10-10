/** Cache key of a full item; shared by the item screen and the player, which refetches links on failure. */
export const itemQueryKey = (id: number) => ['item', id] as const
