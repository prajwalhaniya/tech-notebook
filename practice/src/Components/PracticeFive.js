import React, { useState, useEffect } from "react";
import axios from "axios";

function PracticeFive() {
    const [post, setPost] = useState({});
    const [id, setId] = useState(1);
    const [idFromButtonClick, setIdOnButtonClick] = useState(1);

    useEffect(() => {
        axios
            .get(
                `https://jsonplaceholder.typicode.com/posts/${idFromButtonClick}`
            )
            .then((res) => {
                console.log(res);
                setPost(res.data);
            })
            .catch((err) => {
                console.log(err);
            });
    }, [idFromButtonClick]);

    const setButtonId = () => {
        setIdOnButtonClick(id);
    };
    return (
        <div>
            <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
            ></input>
            <button onClick={setButtonId}>Fetch Post</button>
            <div>
                <h4>{post.title}</h4>
            </div>
            {/* <ul>
                {post.map((post) => (
                    <li id={post.id}>{post.title}</li>
                ))}
            </ul> */}
        </div>
    );
}

export default PracticeFive;
