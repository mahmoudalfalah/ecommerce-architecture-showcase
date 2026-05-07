import toast from 'react-hot-toast';
import type { AxiosError } from 'axios';

import { handleApiError } from '@/lib/error-handler';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { ProductSubmitPayload } from '../../types/product-form-types';

import { productsServices } from '../../services/admin/products.service';

import { productsKeys } from '../../configs/query-keys.configs';

export const useProductMutations = () => {
  const queryClient = useQueryClient();

  const toggleVisibility = useMutation({
    mutationFn: productsServices.toggleProductVisibility,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productsKeys.lists() });
      toast.success('Product visibility toggled successfully');
    },
    onError: (error: AxiosError<{ message: string }>) => toast.error(handleApiError(error, 'Failed to toggle product visibility')),
  });

  const deleteProducts = useMutation({
    mutationFn: productsServices.deleteProducts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: productsKeys.stats() });
      toast.success('Product deleted successfully');
    },
    onError: (error: AxiosError<{ message: string }>) => toast.error(handleApiError(error, 'Failed to delete product')),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: productsKeys.all });
  };

  const createProduct = useMutation({
    mutationFn: productsServices.createProduct,
    onSuccess: () => {
      invalidateAll();
      toast.success('Product added successfully');
    },
    onError: (error: AxiosError<{ message: string }>) => toast.error(handleApiError(error, 'Failed to add product')),
  });

  const updateProduct = useMutation({
    mutationFn: ({ payload, id }: { payload: ProductSubmitPayload; id: string }) =>
      productsServices.updateProduct(payload, id),
    onSuccess: () => {
      invalidateAll();
      toast.success('Product updated successfully');
    },
    onError: (error: AxiosError<{ message: string }>) => toast.error(handleApiError(error, 'Failed to update product')),
  });

  const submitProduct = (
    payload: ProductSubmitPayload,
    productId?: string,
    callbacks?: { onSuccess?: () => void },
  ) => {
    if (productId) {
      updateProduct.mutate({ payload, id: productId }, { onSuccess: callbacks?.onSuccess });
    } else {
      createProduct.mutate(payload, { onSuccess: callbacks?.onSuccess });
    }
  };

  return {
    toggleVisibility,
    deleteProducts,
    createProduct,
    updateProduct,
    submitProduct,
    isSubmitting: createProduct.isPending || updateProduct.isPending,
  };
};
