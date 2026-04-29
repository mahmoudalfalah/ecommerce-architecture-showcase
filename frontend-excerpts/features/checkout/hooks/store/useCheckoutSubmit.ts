import toast from 'react-hot-toast';

import { useMutation } from '@tanstack/react-query';

import { useContactInfo } from '@/features/store-settings';

import { checkoutServices } from '../services/store/checkout.service';

import { generateWhatsAppMessage } from '../utils/checkout.utils';

import { CHECKOUT_ERROR_MAPPING, REQUIRED_CHECKOUT_FIELDS } from '../configs/checkout.configs';

export const useCheckoutSubmit = (
  cities: any[],
  districts: any[],
  hydratedItems: any[],
  rawOrders: any[],
  onSuccessCallback: (payload: any) => void,
  onStockError: (title: string, message: string) => void,
) => {
  const { whatsappLink } = useContactInfo();

  const orderMutation = useMutation({
    mutationFn: checkoutServices.submitOrder,
    onSuccess: (data, variables) => {
      const orderId = data.orderNumber;

      const cityLabel =
        cities?.find((c: any) => String(c.id) === String(variables.cityId))?.name ||
        variables.cityId;
      const districtLabel =
        districts?.find((d: any) => String(d.id) === String(variables.districtId))?.name ||
        variables.districtId;

      const itemsList = hydratedItems
        .map((item: any) => {
          const orderItem = rawOrders.find(
            (o) => String(o.productId || o.product_id) === String(item.productId),
          );
          return `- ${item.name} (Quantity: ${orderItem?.quantity || 0})`;
        })
        .join('\n');

      const message = generateWhatsAppMessage({
        orderId,
        customerName: variables.customerName,
        customerPhone: variables.customerPhone,
        cityLabel,
        districtLabel,
        itemsList,
      });

      onSuccessCallback({
        orderId,
        whatsappUrl: `${whatsappLink}?text=${encodeURIComponent(message)}`,
      });
    },
    onError: (error: any) => {
      console.error(error);

      if (error?.response?.status === 422) {
        const errorCode = error?.response?.data?.error_code;
        const mappedError = CHECKOUT_ERROR_MAPPING[errorCode];

        if (mappedError) {
          onStockError(mappedError.title, mappedError.message);
          return;
        }
      }

      toast.error('Failed to submit order. Please check your information.', {
        id: 'submit-api-error',
      });
    },
  });

  const handleValidationAndSubmit = (data: any) => {
    if (REQUIRED_CHECKOUT_FIELDS.some((field) => !data[field])) {
      return toast.error('Please fill in all required fields', { id: 'submit-validation-error' });
    }

    const payload = {
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      cityId: parseInt(data.cityId),
      districtId: parseInt(data.districtId),
      address: data.address,

      products: rawOrders,
      discountValue: data.discountValue || 0,
      notes: data.notes || '',
    };

    orderMutation.mutate(payload);
  };

  return { submitOrder: handleValidationAndSubmit, isSubmitting: orderMutation.isPending };
};
