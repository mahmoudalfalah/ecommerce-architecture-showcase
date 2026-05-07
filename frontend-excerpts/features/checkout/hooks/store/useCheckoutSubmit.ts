import toast from 'react-hot-toast';

import { useMutation } from '@tanstack/react-query';
import type { AxiosError } from 'axios';


import type { City, District } from '@/features/locations/types/locations.types';

import { useContactInfo } from '@/features/store-settings';

import { checkoutServices } from '../../services/store/checkout.service';

import { generateWhatsAppMessage } from '../utils/checkout.utils';

import { CHECKOUT_ERROR_MAPPING } from '../configs/checkout.configs';

import type {
  CheckoutFormData,
  SubmitOrderPayload,
  UseCheckoutSubmitArgs,
} from '../../types/checkout.types';


export const useCheckoutSubmit = ({
  cities,
  districts,
  hydratedItems,
  rawOrders,
  onSuccess,
  onStockError
}: UseCheckoutSubmitArgs) => {
  const { whatsappLink } = useContactInfo();

  const orderMutation = useMutation({
    mutationFn: checkoutServices.submitOrder,
    onSuccess: (data, variables) => {
      const orderNumber = data.orderNumber;

      const cityLabel =
        cities.find((c: City) => c.id === Number(variables.cityId))?.name || 'unknown';
      const districtLabel =
        districts.find((d: District) => d.id === Number(variables.districtId))?.name || 'unknown';

      const itemsList = hydratedItems
        .map((item) => {
          const orderItem = rawOrders.find((o) => o.productId === String(item.productId));
          return `- ${item.name} (Quantity: ${orderItem?.quantity || 0})`;
        })
        .join('\n');

      const message = generateWhatsAppMessage({
        orderNumber,
        customerName: variables.customerName,
        customerPhone: variables.customerPhone,
        cityLabel,
        districtLabel,
        itemsList,
      });

      onSuccess({
        orderNumber,
        whatsappUrl: `${whatsappLink}?text=${encodeURIComponent(message)}`,
      });
    },
    onError: (error: AxiosError<{ error_code?: string }>) => {
      if (error?.response?.status === 422) {
        const errorCode = error?.response?.data?.error_code;
        const mappedError = errorCode ? CHECKOUT_ERROR_MAPPING[errorCode] : undefined;

        if (mappedError) {
          onStockError(mappedError.title, mappedError.message);
          return;
        }
      }

      toast.error('Failed to submit order. Please check your information.');
    },
  });

  const handleValidationAndSubmit = (data: CheckoutFormData) => {
    const payload: SubmitOrderPayload = {
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      cityId: Number(data.cityId || 0),
      districtId: Number(data.districtId || 0),
      address: data.address,
      products: rawOrders,
      notes: data.notes || '',
    };

    orderMutation.mutate(payload);
  };

  return { submitOrder: handleValidationAndSubmit, isSubmitting: orderMutation.isPending };
};
