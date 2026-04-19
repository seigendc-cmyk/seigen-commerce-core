/** URL query value that selects the Item List tab on `/dashboard/inventory`. */
export const INVENTORY_TAB_QUERY_ITEM_LIST = "item-list";

/** Navigate here after add/save product to land on Item List. */
export const HREF_INVENTORY_ITEM_LIST = `/dashboard/inventory?tab=${INVENTORY_TAB_QUERY_ITEM_LIST}` as const;
