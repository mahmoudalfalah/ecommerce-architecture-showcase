import { useCallback, useEffect } from 'react';

import { ACTIONTYPES, useCart } from '@/app/providers/CartProvider';

import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';

import type { HydratedCartItem } from '../../types/cart.types';

export const useCartActions = () => {
  const { state, dispatch } = useCart();

  useEffect(() => {
    const handleStorageEvent = (event: StorageEvent) => {
      if (event.key === 'cart') {
        dispatch({ type: ACTIONTYPES.SYNC });
      }
    };
    window.addEventListener('storage', handleStorageEvent);
    return () => window.removeEventListener('storage', handleStorageEvent);
  }, [dispatch]);

  const clearCart = useCallback(() => {
    dispatch({ type: ACTIONTYPES.CLEAR });
  }, [dispatch]);

  const removeItem = useCallback(
    (key: string) => {
      dispatch({ type: ACTIONTYPES.REMOVE, data: { key } });
    },
    [dispatch],
  );

  const removeMultipleItems = useCallback(
    (keys: (string | number)[]) => {
      dispatch({ type: ACTIONTYPES.REMOVE_MULTIPLE, data: { keys: keys.map(String) } });
    },
    [dispatch],
  );

  const addToCart = useCallback(
    (productId: number | string, quantity: number) => {
      dispatch({ type: ACTIONTYPES.ADD, data: { productId, quantity } });
    },
    [dispatch],
  );

  const rawUpdateQuantity = useCallback(
    (key: string, quantity: number) => {
      dispatch({ type: ACTIONTYPES.UPDATE_QUANTITY, data: { key, quantity } });
    },
    [dispatch],
  );

  const debouncedUpdateQuantity = useDebouncedCallback(rawUpdateQuantity, 600);

  const calculateTotalPrice = useCallback(
    (hydratedItems: HydratedCartItem[]) => {
      return hydratedItems.reduce((total: number, item: HydratedCartItem) => {
        const key = String(item.productId);
        const qty = state.get(key)?.quantity || 1;
        return total + (item.price ?? 0) * qty;
      }, 0);
    },
    [state],
  );

  const syncGhosts = useCallback(
    (validIds: string[], invisibleIds: string[]) => {
      dispatch({
        type: ACTIONTYPES.SYNC_GHOSTS,
        data: { validIds, invisibleIds },
      });
    },
    [dispatch],
  );

  return {
    state,
    clearCart,
    removeItem,
    removeMultipleItems,
    addToCart,
    debouncedUpdateQuantity,
    calculateTotalPrice,
    syncGhosts,
  };
};
