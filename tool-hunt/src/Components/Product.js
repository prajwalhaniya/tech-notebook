import React from "react";
import "./Product.css";
import ReactLogo from "./reactlogo.png";
import { Button } from "@material-ui/core";
import Badge from "@mui/material/Badge";
import { Rating } from "@mui/material";
import MapsUgcIcon from "@mui/icons-material/MapsUgc";

function Product() {
    return (
        <div className="product">
            <div className="product__image">
                <img src={ReactLogo} alt="logo" />
            </div>

            <div className="product__description">
                <div className="product__heading">
                    <span>React</span>
                </div>
                <p>
                    React is a free and open-source front-end JavaScript library
                    for building user interfaces based on UI components. It is
                    maintained by Meta and a community of individual developers
                    and companies. React can be used as a base in the
                    development of single-page or mobile applications.
                </p>
                <div className="product_badge">
                    <Badge badgeContent={10} color="primary">
                        <MapsUgcIcon color="primary"></MapsUgcIcon>
                    </Badge>
                </div>
                <div className="product_rating">
                    <Rating defaultValue={4} />
                </div>
            </div>
        </div>
    );
}

export default Product;
