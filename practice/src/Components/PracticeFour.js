import React, { useState } from "react";
import { useEffect } from "react/cjs/react.development";

function PracticeFour() {
    const [x, setX] = useState(0);
    const [y, setY] = useState(0);

    const logMousePosition = (e) => {
        console.log("Mouse event");
        setX(e.clientX);
        setY(e.clientY);
    };
    useEffect(() => {
        console.log("useEffect call");
        window.addEventListener("mousemove", logMousePosition);
    }, []);

    return (
        <div>
            <h2>
                Mouse X:{x} Y:{y}
            </h2>
        </div>
    );
}

export default PracticeFour;
