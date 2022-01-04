import React, { useState, useEffect } from "react";

function PracticeThree() {
    const [count, setCount] = useState(0);

    useEffect(() => {
        document.title = `useEffect Demo ${count}`;
    });

    return (
        <div>
            <button onClick={() => setCount(count + 1)}>
                useEffect Demo {count}
            </button>
        </div>
    );
}

export default PracticeThree;
