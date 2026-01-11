---
sidebar_position: 2
---

# Factory

```go
package main

import "fmt"

type PaymentMethod interface {
    Pay(amount int)
}

type CardPayment struct {}

func (c *CardPayment) Pay(amount int) {
    fmt.Println("Pay via card")
}

type UpiPayment struct {}

func (c *UpiPayment) Pay(amount int) {
    fmt.Println("Pay via UPI")
}

func PaymentFactory(method string) PaymentMethod {
    switch method{
    case "card":
        return &CardPayment{}
    case "upi":
        return &UpiPayment{}
    default:
        return nil
    }
} 

func main() {
    p := PaymentFactory("upi")
    p.Pay(500)
}
```