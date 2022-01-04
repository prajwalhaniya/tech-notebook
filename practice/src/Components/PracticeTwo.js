import React, { useState } from "react";

function PracticeTwo() {
    const [items, setItems] = useState([]);

    const addItem = () => {
        setItems([
            ...items,
            {
                id: items.length,
                value: Math.floor(Math.random() * 10) + 1,
            },
        ]);
    };

    return (
        <div>
            <button onClick={addItem}>Click Me </button>
            <ul>
                {items.map((item) => (
                    <li key={item.id}>{item.value}</li>
                ))}
            </ul>
        </div>
    );
}

export default PracticeTwo;
