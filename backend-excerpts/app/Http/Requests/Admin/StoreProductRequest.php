<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class StoreProductRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    protected function prepareForValidation()
    {
        $this->merge([
            'is_new_arrival' => filter_var($this->is_new_arrival, FILTER_VALIDATE_BOOLEAN),
            'is_visible'     => filter_var($this->is_visible ?? true, FILTER_VALIDATE_BOOLEAN),
            'discount'       => $this->discount ?? 0,
        ]);
    }

    public function rules(): array
    {
        return [
            'name'           => ['required', 'string', 'max:300'],
            
            'retail_price'   => ['required', 'numeric', 'min:0'],
            'cost_price'     => ['required', 'numeric', 'min:0'],
            'discount'       => ['nullable', 'numeric', 'min:0'],
            
            'stock'          => ['required', 'integer', 'min:0'],
            'category_id'    => ['required', 'integer', 'exists:categories,id'],
            
            'brand_id'       => ['required', 'integer', 'exists:brands,id'],
            
            'description'    => ['nullable', 'string'],
            'specifications' => ['nullable', 'string'],
            'features'       => ['nullable', 'string'],
            'instructions'   => ['nullable', 'string'],
            
            'sku'            => ['nullable', 'string', 'unique:products,sku'],
            
            'is_new_arrival' => ['boolean'],
            'is_visible'     => ['boolean'],

            'images'         => ['nullable', 'array'],
            'images.*'       => ['image', 'mimes:jpeg,png,jpg,webp', 'max:4096'],
        ];
    }
}