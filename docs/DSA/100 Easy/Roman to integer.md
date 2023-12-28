---
sidebar_position: 3
---
Convert the given roman numeral string into integer

```js
const romanToInt = function(s) {
    const romanNumerals = {
        I: 1,
        V: 5,
        X: 10,
        L: 50,
        C: 100,
        D: 500,
        M: 1000
    }

    let result = 0;

    for (let i = 0; i < s.length; i++) {
        const currentValue = romanNumerals[s[i]];
        const nextValue = romanNumerals[s[i + 1]];
        
        if (nextValue > currentValue) {
            result += (nextValue - currentValue);
            i++;
        } else {
            result += currentValue;
        }
    }
    return result;
};
```