---
sidebar_position: 3
---

# Decorator

```go
package main

import "fmt"

type Notifier interface {
    Send(msg string)
}

type EmailNotifier struct{}

func (e *EmailNotifier) Send(msg string) {
    fmt.Println("Email: ", msg)
}

type SMSDecorator struct {
    Notifier
}

func (s *SMSDecorator) Send(msg string) {
    s.Notifier.Send(msg)
    fmt.Println("SMS:", msg)
}

func main() {
    var n Notifier = &EmailNotifier{}
    n = &SMSDecorator{Notifier: n}

    n.Send("Order Confirmed")
}
```