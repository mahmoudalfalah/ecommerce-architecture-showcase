<?php 

namespace App\Core\Filters;

use Illuminate\Support\Str;
use Illuminate\Http\Request;
use Illuminate\Database\Eloquent\Builder;

abstract class QueryFilter {
    protected Request $request;
    protected Builder $builder;

    public function __construct(Request $request) {
        $this->request = $request;
    }

    public function apply(Builder $builder) {
        $this->builder = $builder;
        foreach ($this->request->all() as $name => $value) {
            $methodName = Str::camel($name);
            if (method_exists($this, $methodName) && !is_null($value) && $value !== '') {
                $this->$methodName($value);
            }
        }
        return $this->builder;
    }
}