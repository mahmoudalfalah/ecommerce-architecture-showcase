# Auto Parts E-Commerce — Architecture Showcase

> Sanitized, white-labeled excerpt of a private production codebase — built for a Libyan auto parts retailer.
> The full repo stays private per client agreement. What's here are the files I found most worth talking about.

**Live:** [autoparts.malfalah.com](https://autoparts.malfalah.com) &nbsp;|&nbsp; **Admin:** [autoparts.malfalah.com/admin](https://autoparts.malfalah.com/admin) &nbsp;|&nbsp; `demo@malfalah.com` / `logindemo` *(read-only)*

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white&labelColor=20232a)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white&labelColor=1a1a2e)
![Laravel](https://img.shields.io/badge/Laravel-12-FF2D20?logo=laravel&logoColor=white&labelColor=1a1a1a)
![TanStack Query](https://img.shields.io/badge/TanStack_Query-5-FF4154?logo=reactquery&logoColor=white&labelColor=1a1a1a)
![Meilisearch](https://img.shields.io/badge/Meilisearch-Scout-A742F5?logo=meilisearch&logoColor=white&labelColor=1a1a1a)
![Vite](https://img.shields.io/badge/Vite-SWC-646CFF?logo=vite&logoColor=white&labelColor=1a1a1a)

---

## Screenshots

| Admin Dashboard | Store — Desktop | Store — Mobile |
|---|---|---|
| ![Dashboard](mockups_and_screenshots/dashboard_laptop.png) | ![Desktop](mockups_and_screenshots/desktop_view.png) | ![Mobile](mockups_and_screenshots/mobile_view.png) |

---

## Backend

### `QueryFilter.php` + `ProductFilter.php` — the filter pipeline

`QueryFilter.php` is an abstract class I built to reuse across any domain that needs filtering. It uses `Str::camel($name)` to convert incoming query parameters to method names automatically — so `sort_by_price` calls `sortByPrice()`. No if-chains, no switch statements.

```php
$methodName = Str::camel($name); // "sort_by_price" → "sortByPrice"
if (method_exists($this, $methodName) && !is_null($value) && $value !== '') {
    $this->$methodName($value);
}
```

`ProductFilter.php` extends it. The interesting part: once I decide to add a new filter, I just add a new method — and it gets picked up automatically thanks to `Str::camel`. I don't touch `QueryFilter` at all. That's OCP in practice.

---

### Avoiding God Controllers

To keep controllers clean I split the HTTP layer into:

- **Requests** — handle validation and data preparation before it reaches the controller. Ex: `StoreProductRequest.php`
- **Controllers** — traffic cops. They receive the request and pass it to the right service and return the result back through the resource.
- **Services** — the business logic lives here.
- **Filters** — instead of long if-chains, filters are smart classes responsible for applying filters only [SRP]. Need a new filter? Add a new method [OCP].
- **Resources** — they handle shaping the response data for the frontend, passing the data in a silver platter.

---

### `Order.php` — connecting the filter to the model

The `scopeFilter` method is what allows chaining `->filter($filter)` directly on the model — it's the bridge between the QueryFilter and Eloquent. The same file also has `toSearchableArray()` which defines the fields Meilisearch will index for order search (customer name, phone, order number, status).

---

### `OrderService.php` — the most interesting backend file

**Pessimistic locking.** The whole order placement is inside a `DB::transaction`. I chain `->lockForUpdate()` on the target products so two customers checking out the same low-stock product at the same time can't both go through. Without this you get overselling. And because the whole thing is a transaction, we either fully place the order or fully fail — no partial effects like decrementing stock without actually creating the order.

**No N+1.** I fetch all products included in the order in one query and use `keyBy('id')` — so inside the loop I access each product directly by ID instead of querying for each one inside the loop.

**Stock checking.** Stock can change at any moment during the customer's checkout journey — when they land on the product page, when they're in the cart, in the tiny milliseconds between the cart page and the checkout page, or even after they submit and before the order is created. To handle this, I made multiple checks at different points. One of them is inside `placeOrder` — if stock is insufficient at that final point, I throw `ERR_INSUFFICIENT_STOCK` and the transaction rolls back.

---

### `ProductService.php` (Admin) — search with a fallback

I use Meilisearch for search, but in case Meilisearch fails silently I fall back to a regular SQL `LIKE` query — the user never sees a 500. The `$queryCallback` closure is reused in both paths so the active filters stay applied regardless of which search path runs.

Other things in this file: prices are stored as integers to avoid floating-point precision issues. Product updates run inside transactions to avoid data corruption where some parts get updated and others don't. Eager loading to avoid N+1 — example is the `getProduct` method.

---

### `StatisticsService.php` (Admin)

The biggest trap here is the N+1 query problem. I used aggregate queries (`selectRaw` with conditional aggregation) to avoid it — one query gives me all the order KPIs, one join query gives me revenue, cost, and net profit. No loops over result sets on the PHP side.

---

## Frontend

### Hook layering pattern

 I don't put that logic inside the component. I use hooks, utils, etc. - and if a component is complicated — like having multiple states or effects, I follow this pattern:

```
UI Component → useUIComponent (no queries) → useWhateverItNeeds (may make queries) → service.ts
```

Real example from this project:

```
ProductManagementPage → useProductManagementPage → [useProductMutations, useModalManager, ...] → products.service.ts
```

The cart follows the same pattern. `CartPage` is just a UI component — its only responsibility is to show UI. The logic is handled by other files.

This is also why `OrdersManagementPage.tsx` is only 91 lines long, despite having a table with row selection, pagination, search, status filtering, and a modal. Everything is somewhere else.

> Some files like `useCartPage.ts` are not included here as the full repo is kept private.

---

### `CartProvider.tsx` — cart state across the whole app

I used React Context for the cart to avoid prop drilling — which would have become a nightmare since cart state is used in many components.

One challenge I went through: if a customer adds Product A (qty: 5) to their cart and keeps the Product A page open, then opens the cart in a new tab and removes Product A, then goes back to the Product A page and adds it again (qty: 3) — the cart ends up with qty: 8 (stale 5 + new 3). The reason is that the cart state in the Product A page was stale — it was fetched before the change happened in the other tab.

To handle this, I used `window` storage events. Whenever the cart performs any action, the local storage updates causing a storage event. All components that rely on cart state listen for that event and call the `SYNC` dispatch action to refresh their state. So when the cart is cleared in the other tab, the Product A page receives the event and syncs — without needing a page refresh.


---

### `useCartHydration.ts` — reconciling localStorage against the live API

This hook calls the cart service on mount. The hydration request hits Laravel, which tells us if any product in the cart has problems. There are 3 main problems:

1. **Product was deleted** — remove it permanently from the cart and show the customer a modal notification, not a toast. This is a notification that requires the user's attention.
2. **Product becomes invisible** — remove it temporarily from the cart. But if the admin turns it back to visible, it must return to all customers' carts (in case they added it before). This way it doesn't become a disaster if an admin toggled a product to invisible by mistake.
3. **Requested stock is not available** — disable the checkout action and show a UI effect on that specific product card so the customer changes the desired quantity.

---

### `useProductMutations.ts` — TanStack Query mutations

The old style for API calls is `useEffect`, but it has problems if not done carefully — the biggest being effect duplication, especially when dependencies shift between values like `undefined` and `null`. I use TanStack Query instead, which solves those problems and gives caching out of the box.

One thing I configured intentionally: I disabled `refetchOnWindowFocus` — it caused UI issues when users kept switching tabs, especially in the dashboard where order data is sensitive.

`useProductMutations.ts` shows how I handle mutations — I structure query keys in a hierarchy so invalidating a parent key automatically busts all its sub keys.

---

### `DataTable.tsx` + `dataTable.types.ts` — one table for the whole dashboard

Dashboard tables involve row selection, pagination, and sorting. That can be handled with regular React state but it becomes unnecessarily complicated code. Instead I used TanStack Table and built one reusable `DataTable` component that every admin table in the project uses.

The component is fully generic (`TData extends WithId`) so each feature passes its own data shape without losing type safety. One of the tricks was in the ColumnMeta type; since I was adding skeletons in the meta, I had to inform TypeScript. I used type augmentation to add the extra field to the ColumnMeta default interface.
And for augmentation, normally we use .d.ts files, but in this case I kept it inside the types file as the augmentation is applied only for this component which is a shared global component.

---
### `axios.ts` + `AuthProvider.tsx` — API config and session handling

Instead of using the legacy `fetch`, I use Axios — automatic JSON parsing, better error handling, and most importantly interceptors.

Two interceptors in `axios.ts`:

**Request interceptor** — automatically sets `Content-Type: application/json` only when the body is a plain object, leaving `FormData` requests untouched so file uploads don't break.

**Response interceptor** — when an admin route returns 401 or 403, Instead of handling auth logic inline, it dispatches a custom `auth:session-expired` DOM event. Since axios has no access to React state, this event is the bridge — `AuthProvider` listens for it and calls `expireLocalSession()` which clears the local auth state without making any API call. The reason we don't call any endpoint here is that Laravel already rejected us — the session is gone server-side, there's nothing to destroy. This is different from logout, where we do hit the Laravel endpoint first to destroy the session, then clear the local state.

Individual requests can set a `silent` flag to opt out of that event — for example, `checkAuth` uses `silent: true` because a 401 there means the user isn't logged in and we just navigate them to login, not trigger the expiry flow.

---

### Other decisions worth mentioning

**Framer Motion** — handling opening animations is easy with CSS, but the problem is with components that unmount, like modals. To match industry standards I used Framer Motion.

**React Hook Form** — handling complicated forms like the product form or category form can get tricky, especially around optimization. Without it you get a re-render on every keystroke. React Hook Form gives me control over the whole form and fixes that. Check `useCategoryFormModal.ts`.

**Recursive categories** — a category can be a subcategory of a subcategory of a subcategory... all under one parent. I used recursion to handle that. Check `CategoryService.php` (store version).

**CSS Modules** — clean CSS that avoids class name clashing.

---

## Full Project Structure

<details>
<summary>Frontend (React)</summary>

```
src/
├── app/
│   ├── App.tsx
│   ├── AppRoutes.tsx
│   ├── errors/
│   ├── guards/
│   ├── providers/
│   └── routes/
├── components/
│   ├── shared/        # Complex shared components (DataTable, etc.)
│   └── ui/            # Atomic UI primitives (Button, Input, etc.)
├── configs/
├── features/
│   ├── auth/
│   ├── cart/
│   ├── categories/
│   ├── checkout/
│   ├── orders/
│   ├── products/
│   ├── statistics/
│   └── ...
├── hooks/
├── layouts/
│   ├── AdminLayout/
│   └── StoreLayout/
├── lib/
├── services/
├── styles/
├── types/
└── utils/
```

Each feature follows this internal structure:

```
feature-name/
├── components/      # admin/ | store/ | shared/
├── configs/
├── hooks/           # admin/ | store/ | shared/
├── pages/           # admin/ | store/
├── services/        # admin/ | store/
├── types/
└── index.ts
```

Both admin and storefront logic are separated within each feature — `admin/`, `store/`, `shared/`.

</details>

<details>
<summary>Backend (Laravel)</summary>

```
app/
├── Core/Filters/          # Abstract QueryFilter base
├── Enums/                 # PHP Enums (OrderStatus, etc.)
├── Filters/
│   ├── Admin/
│   └── Store/
├── Http/
│   ├── Controllers/
│   │   ├── Admin/
│   │   ├── Store/
│   │   └── Shared/
│   ├── Requests/
│   │   ├── Admin/
│   │   └── Store/
│   └── Resources/
│       ├── Admin/
│       ├── Store/
│       └── Shared/
├── Models/
└── Services/
    ├── Admin/
    ├── Store/
    └── Shared/
```

Request lifecycle:

```
Request → Middleware → FormRequest → Controller → Service → Model
                                                      ↓
Response ← Resource ←─────────────────────────────────┘
```

</details>

---

> The full production codebase is private per client agreement. Available for technical review upon request.
