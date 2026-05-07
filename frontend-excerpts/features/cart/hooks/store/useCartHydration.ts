import { useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';

import { cartServices } from '../../services/store/cart.service';

import { cartKeys } from '../../configs/query-keys.configs';
import type { CartItem, HydratedCartItem, UseCartHydrationReturn } from '../../types/cart.types';

export const useCartHydration = (rawItems: Pick<CartItem, 'productId' | 'quantity'>[]): UseCartHydrationReturn => {
  const {
    data: response,
    isLoading,
    isPending,
    isFetching,
  } = useQuery({
    queryKey: [...cartKeys.hydrate(), rawItems],
    queryFn: () => cartServices.hydrateCart(rawItems),
    enabled: rawItems.length > 0,
  });

  const hydratedItems = response?.data || [];
  const deletedIds = response?.deleted_ids || [];
  const invisibleIds = response?.invisible_ids || [];

  const { totalPrice, hasStockError } = useMemo(() => {
    if (!hydratedItems.length) return { totalPrice: 0, hasStockError: false };

    let total = 0;
    let stockError = false;

    hydratedItems.forEach((item: HydratedCartItem) => {
      const requestedItem = rawItems.find(
        (o: Pick<CartItem, 'productId' | 'quantity'>) => String(o.productId) === String(item.productId),
      );

      const qty = requestedItem ? parseInt(String(requestedItem.quantity), 10) : 1;

      total += item.salePrice * qty;

      if (qty > item.availableQuantity || item.availableQuantity === 0) {
        stockError = true;
      }
    });

    return { totalPrice: total, hasStockError: stockError };
  }, [hydratedItems, rawItems]);

  return {
    hydratedItems,
    deletedIds,
    invisibleIds,
    totalPrice,
    hasStockError,
    isFetching,
    isLoading: (isLoading || isPending) && rawItems.length > 0,
  };
};
