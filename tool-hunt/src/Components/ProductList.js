import React from "react";
import "./ProductList.css";
import Product from "./Product";

function ProductList() {
    return (
        <div className="product__list">
            <Product />
            <hr />
            <Product />
            <hr />
            <Product />
            <hr />
            <Product />
            <hr />
        </div>
    );
}

export default ProductList;
