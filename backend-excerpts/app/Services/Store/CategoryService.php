<?php 

namespace App\Services\Store;

use App\Models\Category;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;

class CategoryService 
{
    public function getCategories(array $data, ?array $productIds = null): LengthAwarePaginator|Collection
    {
        $query = Category::query();

        if (!empty($data['is_productable'])) {
            $query->where('is_productable', true);
        }

        if (!empty($data['parents_only'])) {
            $query->where('parent_id', null);
        }

        if (!empty($productIds)) {
            $query->whereHas('products', function($q) use ($productIds) {
                $q->whereIn('id', $productIds);
            });
        }

        $paginate = filter_var($data['paginate'] ?? false, FILTER_VALIDATE_BOOLEAN);

        if ($paginate) {
            $perPage = $data['per_page'] ?? 10;
            return $query->paginate($perPage);
        }

        if (isset($data['limit'])) {
            $query->limit($data['limit']);
        }

        return $query->get();
    }

    public function getCategoryTree(): array
    {
        $parents = Category::all();
        $grouped = $parents->groupBy('parent_id');

        return $this->recursiveCategories(null, $grouped);
    }

    private function recursiveCategories($parentId, $categories): array
    {
        $currentCats = $categories[$parentId] ?? collect();

        $results = [];
        foreach ($currentCats as $cat) {
            if ($cat->is_productable) {
                $results[] = $cat;
                continue;
            }
            $cat->childrenTree = $this->recursiveCategories($cat->id, $categories);
            $results[] = $cat;
        }
        return $results;
    }
}