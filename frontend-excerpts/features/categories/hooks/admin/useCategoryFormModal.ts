import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';

import { compressImage } from '@/lib/image';

import { useCategoriesList } from '../../hooks/admin/useCategoriesList';
import type { Category, CategoryFormValues } from '../../types/category.types';

import { CATEGORY_FORM_FIELDS } from '../../configs/form.configs';

export const useCategoryFormModal = (
  categoryData: Category | undefined,
  onAction: (payload: FormData, categoryId?: number) => void,
) => {
  const { register, handleSubmit, control, reset, formState, setValue } = useForm<CategoryFormValues>();

  const formFields = useMemo(() => {
    return categoryData
      ? CATEGORY_FORM_FIELDS.filter((field) => field.name !== 'is_productable')
      : CATEGORY_FORM_FIELDS;
  }, [categoryData]);

  const { categories: rawCategories, isPending: isLoadingCategoriesParents } = useCategoriesList({
    is_productable: 0,
    paginate: 0,
  });

  const categoriesParents = useMemo(() => {
    const defaultOption = { id: 0, label: 'No Parent' };
    if (!rawCategories || rawCategories.length === 0) return [defaultOption];

    const validParents = rawCategories
      .filter((cat: Category) => !categoryData || cat.id !== categoryData.id)
      .map((cat: Category) => ({ id: cat.id, label: cat.name }));

    return [defaultOption, ...validParents];
  }, [rawCategories, categoryData]);

  const onSubmit = async (data: CategoryFormValues) => {
    const formData = new FormData();

    formData.append('name', data.name);

    formData.append('is_productable', data.is_productable ? '1' : '0');

    if (data.parent_id && data.parent_id !== 0) {
      formData.append('parent_id', data.parent_id.toString());
    } else {
      formData.append('parent_id', '');
    }
    const imageField = data.image && data.image[0];

    /**
     * 🟣 FRONT-END LOGIC:
     */
    if (imageField instanceof File) {
      // 🟣 User uploaded a new file
      try {
        const compressedImg = await compressImage(imageField);
        formData.append('image', compressedImg || imageField);
      } catch (error) {
        formData.append('image', imageField);
      }
    } else if (!imageField && categoryData?.image) {
      // 🟣 User removed the existing image
      formData.append('image', '');
    }
    onAction(formData, categoryData?.id ? Number(categoryData.id) : undefined);
  };

  useEffect(() => {
    if (categoryData) {
      // 🟢 Force image to array format if it arrives as a string
      const formattedImage = categoryData.image
        ? Array.isArray(categoryData.image)
          ? categoryData.image
          : [categoryData.image]
        : [];

      reset({
        ...categoryData,
        parent_id: Number(categoryData.parent_id || categoryData.parentId || 0),
        is_productable: !!categoryData.isProductable,
        image: formattedImage, // 🟢 Passed safely as an array
      });
    } else {
      reset({ name: '', is_productable: false, parent_id: 0, image: [] });
    }
  }, [categoryData, reset]);

  return {
    formApi: { register, handleSubmit, control, formState, setValue },
    state: { formFields, categoriesParents, isLoadingCategoriesParents },
    handlers: { onSubmit },
  };
};
