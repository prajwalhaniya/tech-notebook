import "./App.css";
import ProductList from "./Components/ProductList";

function App() {
    return (
        <div className="app">
            <div className="app__heading">
                {" "}
                <h1>Popular tools</h1>
                <hr />
            </div>

            <ProductList />
        </div>
    );
}

export default App;
