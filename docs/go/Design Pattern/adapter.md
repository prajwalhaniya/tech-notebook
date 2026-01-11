---
sidebar_position: 4
---
# Adapter

```
package main

import "fmt"

type Charger interface {
	ChargePhone()
}

type OldCharger struct{}
func (o *OldCharger) PlugIn() {
	fmt.Println("Charging with old charger")
}

type ChargerAdapter struct {
	old *OldCharger
}

func (a *ChargerAdapter) ChargePhone() {
	a.old.PlugIn()
}

func main() {
	old := &OldCharger{}
	var charger Charger = &ChargerAdapter{old: old}

	charger.ChargePhone()
}
```