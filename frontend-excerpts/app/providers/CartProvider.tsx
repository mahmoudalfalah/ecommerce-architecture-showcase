import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import React from 'react';

import type { CartItem } from '@/features/cart/types/cart.types';

type CartContextType = {
  state: Map<string, CartItem>;
  dispatch: React.Dispatch<CartAction>;
  totalVisibleItems: number;
};

type CartAction =
  | { type: 'add'; data: { productId: string | number; quantity: number } }
  | { type: 'clear' }
  | { type: 'SYNC' }
  | { type: 'UPDATE_QUANTITY'; data: { key: string; quantity: number } }
  | { type: 'REMOVE'; data: { key: string } }
  | { type: 'REMOVE_MULTIPLE'; data: { keys: string[] } }
  | { type: 'SYNC_GHOSTS'; data: { validIds: string[]; invisibleIds: string[] } };

const cartContext = createContext<CartContextType | undefined>(undefined);

const ACTIONTYPES = {
  ADD: 'add',
  CLEAR: 'clear',
  SYNC: 'SYNC',
  UPDATE_QUANTITY: 'UPDATE_QUANTITY',
  REMOVE: 'REMOVE',
  REMOVE_MULTIPLE: 'REMOVE_MULTIPLE',
  SYNC_GHOSTS: 'SYNC_GHOSTS',
} as const;

const fetchCart = (): Map<string, CartItem> => {
  const cart = localStorage.getItem('cart');
  if (!cart) return new Map();
  const cartArray = JSON.parse(cart);
  if (!cartArray.length) return new Map();
  const cartMap = new Map<string, CartItem>();

  cartArray.forEach((item: CartItem) => {
    const key = String(item.productId);
    cartMap.set(key, item);
  });
  return cartMap;
};

const cartReducer = (state: Map<string, CartItem>, action: CartAction): Map<string, CartItem> => {
  switch (action.type) {
    case ACTIONTYPES.ADD: {
      const newMap = new Map(state);
      const key = String(action.data.productId);

      if (newMap.has(key)) {
        const product = newMap.get(key);
        const updatedObj = {
          ...product,
          quantity: Number(product?.quantity || 0) + Number(action.data.quantity),
        };
        newMap.set(key, updatedObj as CartItem);
      } else {
        const updatedObj = {
          ...action.data,
          quantity: Number(action.data.quantity),
          productId: action.data.productId,
        };
        newMap.set(key, updatedObj);
      }
      return newMap;
    }
    case ACTIONTYPES.CLEAR: {
      const newMap = new Map<string, CartItem>();
      state.forEach((item, key) => {
        if (item.isGhosted) {
          newMap.set(key, item);
        }
      });
      return newMap;
    }
    case ACTIONTYPES.REMOVE: {
      const newMap = new Map(state);
      newMap.delete(String(action.data.key));
      return newMap;
    }
    case ACTIONTYPES.REMOVE_MULTIPLE: {
      const newMap = new Map(state);
      action.data.keys.forEach((key: string) => {
        newMap.delete(String(key));
      });
      return newMap;
    }
    case ACTIONTYPES.SYNC:
      return fetchCart();
    case ACTIONTYPES.UPDATE_QUANTITY: {
      const newMap = new Map(state);
      const { key, quantity } = action.data;

      if (newMap.has(key)) {
        const product = newMap.get(key);
        const updatedObj = {
          ...product,
          quantity: Number(quantity),
        };
        newMap.set(key, updatedObj as CartItem);
      }
      return newMap;
    }
    case ACTIONTYPES.SYNC_GHOSTS: {
      const newMap = new Map(state);
      const { validIds, invisibleIds } = action.data;

      let changed = false;

      newMap.forEach((item, key) => {
        if (invisibleIds.includes(key) && !item.isGhosted) {
          newMap.set(key, { ...item, isGhosted: true });
          changed = true;
        } else if (validIds.includes(key) && item.isGhosted) {
          newMap.set(key, { ...item, isGhosted: false });
          changed = true; // State actually mutated
        }
      });

      return changed ? newMap : state;
    }
    default:
      return state;
  }
};

type CartProviderProps = {
  children: React.ReactNode;
};

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, undefined, fetchCart);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify([...state.values()]));
  }, [state]);

  const totalVisibleItems = useMemo(() => {
    return [...state.values()].reduce((total, item) => {
      if (item.isGhosted) return total;
      return total + item.quantity;
    }, 0);
  }, [state]);

  return (
    <cartContext.Provider value={{ state, dispatch, totalVisibleItems }}>
      {children}
    </cartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(cartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
export { ACTIONTYPES };
