<?php

namespace App\Filters\Store;

use App\Core\Filters\QueryFilter;

class ProductFilter extends QueryFilter
{
    public function categories(array $slugs): void
    {
        $this->builder->whereHas('category', function ($query) use ($slugs) {
            $query->whereIn('slug', $slugs);
        });
    }

    public function brands(array $slugs): void
    {
        $this->builder->whereHas('brand', function ($query) use ($slugs) {
            $query->whereIn('slug', $slugs);
        });
    }

    public function minBudget($value): void
    {
        if ($value !== null && $value !== '') {
            $this->builder->where('retail_price', '>=', (int)($value * 100));
        }
    }

    public function maxBudget($value): void
    {
        if ($value !== null && $value !== '') {
            $this->builder->where('retail_price', '<=', (int)($value * 100));
        }
    }

    public function newArrivals($value): void
    {
        if (filter_var($value, FILTER_VALIDATE_BOOLEAN)) {
            $this->builder->where('is_new_arrival', true);
        }
    }

    public function random($value): void
    {
        if (filter_var($value, FILTER_VALIDATE_BOOLEAN)) {
            $this->builder->inRandomOrder();
        }
    }

    public function discount($value): void
    {
        if (filter_var($value, FILTER_VALIDATE_BOOLEAN)) {
            $this->builder->where('discount', '>', 0);
        }
    }

    public function sortByPrice(string $direction): void
    {
        $this->builder->orderBy('retail_price', $direction);
    }

    public function applyDefaultSorting(): void
    {
        if (!$this->request->has('sort_by_price')) {
            $this->builder->orderBy('created_at', 'desc');
        }
    }
}