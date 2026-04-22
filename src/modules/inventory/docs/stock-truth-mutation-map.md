## Stock truth mutation map (current code truth)

This document lists every **operational stock mutation** callsite currently found in the codebase that mutates
`InventoryRepo` branch on-hand truth via `InventoryRepo.incrementStock(...)`.

It is intentionally **code-location based** (files + function names), because those callsites effectively define
the current allowed movement types in the local-first model.

### Source of stock truth

- **Stock truth row**: `StockRecord.onHandQty` per `(branchId, productId)`
- **Store**: browser localStorage JSON under `seigen.inventory:v1:db`

Files:
- `src/modules/inventory/services/inventory-repo.ts`
- `src/modules/inventory/services/storage.ts`

### Mutation callsites (by movement type)

#### Sales (decrement on-hand)
- **Desktop/terminal POS**: `finalizeSale()` decrements on-hand for each sale line.
  - File: `src/modules/pos/services/sales-service.ts`
- **Consignment agent cash sale**: `completeAgentCashSale()` decrements stall on-hand per cart line.
  - File: `src/modules/consignment-agent/services/agent-sales.service.ts`

#### Receiving (increment on-hand)
- **Goods receiving**: `ReceivingService.receiveAgainstPurchaseOrder()` increments on-hand per receipt line.
  - File: `src/modules/inventory/services/receiving-service.ts`

#### Stock adjustments (variance posting)
- **Stocktake**: `postStocktake()` increments on-hand by variance (`counted - system`) per line.
  - File: `src/modules/inventory/services/stocktake-service.ts`

#### Consignment movements (paired movements)
- **Legacy direct issue helper**: `issueConsignmentStock()` decrements principal and increments stall.
  - File: `src/modules/consignment/services/consignment-operations.ts`
- **Issue invoice workflow**:
  - Reserve at submit: decrements principal on-hand (`pending_approval`)
  - Release on reject/cancel: increments principal on-hand
  - Transfer on approve: increments stall on-hand
  - File: `src/modules/consignment/services/consignment-issue-invoice.service.ts`

#### Assembly/disassembly (manufacturing ops)
- **Assembly build**: decrements components, increments parent output.
- **Disassembly**: decrements parent, increments outputs.
  - File: `src/modules/inventory/services/assembly-service.ts`

### Notes / non-goals

- This map is about **operational on-hand truth**. It does not list:
  - projection signals (e.g., storefront `stock_signal`)
  - BI/custody ledgers that are not `InventoryRepo` on-hand rows

