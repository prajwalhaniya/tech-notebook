import "./App.css";
import PracticeFive from "./Components/PracticeFive";
import PracticeFour from "./Components/PracticeFour";
import PracticeOne from "./Components/PracticeOne";
import PracticeThree from "./Components/PracticeThree";
import PracticeTwo from "./Components/PracticeTwo";

function App() {
    return (
        <div className="App">
            <PracticeOne></PracticeOne>
            <hr />
            <PracticeTwo />
            <hr />
            <h3>useEffect Hook Demo</h3>
            <PracticeThree />
            <hr />
            <h2>Calculating Mouse position</h2>
            <PracticeFour />
            <hr />
            <h2>Fetching data using useEffect with axios</h2>
            <PracticeFive />
        </div>
    );
}

export default App;
