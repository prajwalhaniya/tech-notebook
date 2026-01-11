---
sidebar_position: 1
---
# Singleton

```go
package main

import (
    "fmt"
    "sync"
)

type Config struct {
    AppName string
}

var (
    instance *Config
    once sync.Once
)

func GetConfig() *Config {
    once.Do(func() {
        fmt.Println("Creating config instance")
        instance = &Config{AppName: "MyApp"}
    })
    return instance
}

func main() {
    c1 := GetConfig()
    c2 := GetConfig()

    fmt.Println(c1 == c2)
}
```